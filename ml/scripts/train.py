"""Train the plant-leaf classifier with transfer learning (PyTorch).

Works on CPU or GPU. Reads the splits produced by make_splits.py and writes a
checkpoint to ml/models/ plus a training history to ml/artifacts/.

Usage (Windows PowerShell, from the project root):
    # smoke test on a tiny subset (fast, CPU friendly)
    py -3.12 ml/scripts/train.py --smoke

    # full training run
    py -3.12 ml/scripts/train.py --epochs 12 --batch-size 32

    # cap images per class (useful when disk/RAM/time are limited)
    py -3.12 ml/scripts/train.py --limit-per-class 200
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib import data, paths  # noqa: E402

import numpy as np  # noqa: E402
import torch  # noqa: E402
from PIL import Image  # noqa: E402
from torch import nn  # noqa: E402
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler  # noqa: E402
from torchvision import models, transforms  # noqa: E402

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def build_model(arch: str, num_classes: int, pretrained: bool = True) -> nn.Module:
    if arch == "mobilenet_v3_small":
        weights = models.MobileNet_V3_Small_Weights.IMAGENET1K_V1 if pretrained else None
        model = models.mobilenet_v3_small(weights=weights)
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_classes)
        return model
    if arch == "efficientnet_b0":
        weights = models.EfficientNet_B0_Weights.IMAGENET1K_V1 if pretrained else None
        model = models.efficientnet_b0(weights=weights)
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_classes)
        return model
    if arch == "resnet18":
        weights = models.ResNet18_Weights.IMAGENET1K_V1 if pretrained else None
        model = models.resnet18(weights=weights)
        model.fc = nn.Linear(model.fc.in_features, num_classes)
        return model
    raise ValueError(f"Unsupported arch: {arch}")


def freeze_backbone(model: nn.Module, arch: str) -> list[nn.Parameter]:
    head_names = {"mobilenet_v3_small": "classifier", "efficientnet_b0": "classifier", "resnet18": "fc"}
    head = head_names[arch]
    trainable: list[nn.Parameter] = []
    for name, param in model.named_parameters():
        if name.startswith(head):
            param.requires_grad = True
            trainable.append(param)
        else:
            param.requires_grad = False
    return trainable


def unfreeze_all(model: nn.Module) -> list[nn.Parameter]:
    params = []
    for param in model.parameters():
        param.requires_grad = True
        params.append(param)
    return params


def build_transforms(image_size: int):
    train_tf = transforms.Compose(
        [
            transforms.RandomResizedCrop(image_size, scale=(0.7, 1.0), ratio=(0.8, 1.25)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomVerticalFlip(p=0.15),
            transforms.RandomRotation(20),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.02),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )
    eval_tf = transforms.Compose(
        [
            transforms.Resize(int(image_size * 1.14)),
            transforms.CenterCrop(image_size),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )
    return train_tf, eval_tf


class LeafDataset(Dataset):
    def __init__(self, root: Path, relpaths: list[str], name_to_index: dict[str, int], transform):
        self.root = root
        self.relpaths = relpaths
        self.name_to_index = name_to_index
        self.transform = transform

    def __len__(self) -> int:
        return len(self.relpaths)

    def class_name(self, index: int) -> str:
        return self.relpaths[index].split("/")[0]

    def __getitem__(self, index: int):
        relpath = self.relpaths[index]
        class_name = relpath.split("/")[0]
        with Image.open(self.root / relpath) as image:
            image = image.convert("RGB")
            tensor = self.transform(image)
        return tensor, self.name_to_index[class_name]


def subsample(relpaths: list[str], limit_per_class: int, seed: int) -> list[str]:
    if limit_per_class <= 0:
        return relpaths
    rng = random.Random(seed)
    grouped: dict[str, list[str]] = {}
    for relpath in relpaths:
        grouped.setdefault(relpath.split("/")[0], []).append(relpath)
    kept: list[str] = []
    for class_name, files in grouped.items():
        files = sorted(files)
        rng.shuffle(files)
        kept.extend(files[:limit_per_class])
    return sorted(kept)


def compute_metrics(y_true: list[int], y_pred: list[int], num_classes: int) -> dict:
    from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_macro": float(precision_score(y_true, y_pred, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(y_true, y_pred, average="macro", zero_division=0)),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "f1_weighted": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
    }


def run_epoch(model, loader, criterion, optimizer, device, train: bool, num_classes: int):
    model.train() if train else model.eval()
    total_loss = 0.0
    y_true: list[int] = []
    y_pred: list[int] = []
    context = torch.enable_grad() if train else torch.no_grad()
    with context:
        for inputs, targets in loader:
            inputs = inputs.to(device)
            targets = targets.to(device)
            if train:
                optimizer.zero_grad(set_to_none=True)
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            if train:
                loss.backward()
                optimizer.step()
            total_loss += loss.item() * inputs.size(0)
            y_true.extend(targets.detach().cpu().tolist())
            y_pred.extend(outputs.detach().argmax(1).cpu().tolist())
    metrics = compute_metrics(y_true, y_pred, num_classes)
    metrics["loss"] = total_loss / max(1, len(loader.dataset))
    return metrics


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(paths.TRAIN_CONFIG_FILE))
    parser.add_argument("--splits", default=str(paths.SPLITS_FILE))
    parser.add_argument("--data-dir", default=str(paths.EXTRACTED_DIR))
    parser.add_argument("--class-index", default=str(paths.CLASS_INDEX_FILE))
    parser.add_argument("--out", default=str(paths.MODEL_PATH))
    parser.add_argument("--arch", default=None)
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=None)
    parser.add_argument("--learning-rate", type=float, default=None)
    parser.add_argument("--limit-per-class", type=int, default=None)
    parser.add_argument("--num-workers", type=int, default=None)
    parser.add_argument("--smoke", action="store_true", help="2 epochs on a small subset")
    parser.add_argument("--no-pretrained", action="store_true", help="Do not download ImageNet weights")
    parser.add_argument("--seed", type=int, default=None)
    args = parser.parse_args()

    config = data.read_json(Path(args.config))
    overrides = {
        "arch": args.arch,
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "limit_per_class": args.limit_per_class,
        "num_workers": args.num_workers,
        "seed": args.seed,
    }
    for key, value in overrides.items():
        if value is not None:
            config[key] = value
    if args.smoke:
        config["smoke_test"] = True
        config["epochs"] = min(config["epochs"], 2)
        if not args.limit_per_class:
            config["limit_per_class"] = 40

    set_seed(int(config["seed"]))
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device} | arch: {config['arch']} | seed: {config['seed']}")

    split_payload = data.read_json(Path(args.splits))
    class_index = data.read_json(Path(args.class_index))
    name_to_index = class_index["name_to_index"]
    num_classes = len(class_index["classes"])
    root = Path(args.data_dir)
    if not root.exists():
        print(f"ERROR: extracted dataset not found at {root}")
        print("Run: py -3.12 ml/scripts/extract_dataset.py --per-class 24")
        return 2

    limit_per_class = int(config.get("limit_per_class", 0))
    train_paths = subsample(split_payload["splits"]["train"], limit_per_class, int(config["seed"]))
    val_paths = subsample(split_payload["splits"]["val"], limit_per_class, int(config["seed"]))
    test_paths = subsample(split_payload["splits"]["test"], limit_per_class, int(config["seed"]))

    missing = [p for p in (train_paths + val_paths) if not (root / p).exists()]
    if missing:
        print(f"ERROR: {len(missing)} files listed in the splits are missing on disk (first: {missing[0]})")
        print("Re-run: py -3.12 ml/scripts/make_splits.py")
        return 2

    train_tf, eval_tf = build_transforms(int(config["image_size"]))
    train_ds = LeafDataset(root, train_paths, name_to_index, train_tf)
    val_ds = LeafDataset(root, val_paths, name_to_index, eval_tf)
    print(f"Train: {len(train_ds)} | Val: {len(val_ds)} | Classes: {num_classes}")

    sampler = None
    if config.get("use_class_weights", True):
        counts = np.zeros(num_classes, dtype=np.int64)
        for relpath in train_paths:
            counts[name_to_index[relpath.split("/")[0]]] += 1
        weights = np.zeros_like(counts, dtype=np.float64)
        for index, count in enumerate(counts):
            weights[index] = 1.0 / max(1, count)
        sample_weights = torch.as_tensor([weights[name_to_index[p.split("/")[0]]] for p in train_paths], dtype=torch.double)
        sampler = WeightedRandomSampler(sample_weights, num_samples=len(train_paths), replacement=True)

    batch_size = int(config["batch_size"])
    num_workers = int(config.get("num_workers", 0))
    train_loader = DataLoader(
        train_ds,
        batch_size=batch_size,
        sampler=sampler,
        shuffle=sampler is None,
        num_workers=num_workers,
        drop_last=False,
    )
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=num_workers)

    model = build_model(config["arch"], num_classes, pretrained=not args.no_pretrained).to(device)
    criterion = nn.CrossEntropyLoss(label_smoothing=float(config.get("label_smoothing", 0.0)))

    freeze_epochs = int(config.get("freeze_backbone_epochs", 0))
    params = freeze_backbone(model, config["arch"]) if freeze_epochs > 0 else unfreeze_all(model)
    optimizer = torch.optim.AdamW(params, lr=float(config["learning_rate"]), weight_decay=float(config["weight_decay"]))
    scheduler = None
    if config.get("scheduler") == "cosine":
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
            optimizer, T_max=max(1, int(config["epochs"])), eta_min=float(config["learning_rate"]) * 0.05
        )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    history: list[dict] = []
    best_f1 = -1.0
    best_epoch = -1
    epochs_without_improvement = 0
    started = time.time()

    for epoch in range(1, int(config["epochs"]) + 1):
        if freeze_epochs and epoch == freeze_epochs + 1:
            print(f"Unfreezing backbone weights at epoch {epoch}")
            params = unfreeze_all(model)
            optimizer = torch.optim.AdamW(
                params, lr=float(config["learning_rate"]) * 0.5, weight_decay=float(config["weight_decay"])
            )
            if scheduler is not None:
                scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
                    optimizer,
                    T_max=max(1, int(config["epochs"]) - epoch + 1),
                    eta_min=float(config["learning_rate"]) * 0.05,
                )

        train_metrics = run_epoch(model, train_loader, criterion, optimizer, device, True, num_classes)
        val_metrics = run_epoch(model, val_loader, criterion, optimizer, device, False, num_classes)
        if scheduler is not None:
            scheduler.step()

        record = {"epoch": epoch, "train": train_metrics, "val": val_metrics}
        history.append(record)
        print(
            f"epoch {epoch:>2}/{config['epochs']} | "
            f"train loss {train_metrics['loss']:.4f} acc {train_metrics['accuracy']:.4f} f1 {train_metrics['f1_macro']:.4f} | "
            f"val loss {val_metrics['loss']:.4f} acc {val_metrics['accuracy']:.4f} f1 {val_metrics['f1_macro']:.4f}"
        )

        if val_metrics["f1_macro"] > best_f1:
            best_f1 = val_metrics["f1_macro"]
            best_epoch = epoch
            epochs_without_improvement = 0
            torch.save(
                {
                    "arch": config["arch"],
                    "state_dict": model.state_dict(),
                    "class_index": class_index,
                    "config": config,
                    "image_size": int(config["image_size"]),
                    "normalization": {"mean": IMAGENET_MEAN, "std": IMAGENET_STD},
                    "best_epoch": epoch,
                    "val_metrics": val_metrics,
                    "trained_on": {"train_images": len(train_ds), "val_images": len(val_ds), "classes": num_classes},
                },
                out_path,
            )
            print(f"  saved new best checkpoint (val f1 {best_f1:.4f}) -> {out_path}")
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= int(config["early_stopping_patience"]):
                print(f"Early stopping at epoch {epoch} (no improvement for {epochs_without_improvement} epochs)")
                break

    summary = {
        "arch": config["arch"],
        "config": config,
        "device": str(device),
        "best_epoch": best_epoch,
        "best_val_f1_macro": best_f1,
        "history": history,
        "train_images": len(train_ds),
        "val_images": len(val_ds),
        "smoke_test": bool(config.get("smoke_test")),
        "duration_seconds": round(time.time() - started, 1),
        "checkpoint": str(out_path),
        "test_split_size": len(test_paths),
    }
    data.write_json(paths.ARTIFACTS_DIR / "training_history.json", summary)
    print(f"Training finished in {summary['duration_seconds']}s. Best val macro-F1: {best_f1:.4f}")
    if config.get("smoke_test"):
        print("NOTE: this was a smoke test on a subset. Metrics do NOT represent production quality.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
