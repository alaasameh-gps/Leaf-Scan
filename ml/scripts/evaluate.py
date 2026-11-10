"""Evaluate a trained checkpoint on the held-out test split.

Produces accuracy, macro/weighted precision, recall, F1, top-3 accuracy,
a per-class report and a confusion-matrix image + CSV.

Usage (Windows PowerShell, from the project root):
    py -3.12 ml/scripts/evaluate.py
    py -3.12 ml/scripts/evaluate.py --limit-per-class 40 --tag smoke
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib import data, paths  # noqa: E402

import numpy as np  # noqa: E402
import torch  # noqa: E402
from torch.utils.data import DataLoader  # noqa: E402

from train import (  # noqa: E402  (same folder script)
    LeafDataset,
    build_model,
    build_transforms,
    compute_metrics,
    set_seed,
    subsample,
)


def save_confusion_matrix(matrix: np.ndarray, labels: list[str], out_png: Path, out_csv: Path) -> None:
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with out_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["predicted ->"] + labels)
        for label, row in zip(labels, matrix):
            writer.writerow([label] + row.tolist())

    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        size = max(8, len(labels) * 0.42)
        figure, axis = plt.subplots(figsize=(size, size))
        image = axis.imshow(matrix, cmap="viridis")
        axis.set_xticks(range(len(labels)), labels, rotation=90, fontsize=6)
        axis.set_yticks(range(len(labels)), labels, fontsize=6)
        axis.set_xlabel("Predicted")
        axis.set_ylabel("True")
        axis.set_title("Confusion matrix (test split)")
        figure.colorbar(image, fraction=0.046)
        figure.tight_layout()
        figure.savefig(out_png, dpi=150)
        plt.close(figure)
    except Exception as exc:  # pragma: no cover
        print(f"Could not render confusion matrix image: {exc}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", default=str(paths.MODEL_PATH))
    parser.add_argument("--splits", default=str(paths.SPLITS_FILE))
    parser.add_argument("--data-dir", default=str(paths.EXTRACTED_DIR))
    parser.add_argument("--class-index", default=str(paths.CLASS_INDEX_FILE))
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--limit-per-class", type=int, default=0)
    parser.add_argument("--num-workers", type=int, default=0)
    parser.add_argument("--tag", default="test")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    checkpoint_path = Path(args.checkpoint)
    if not checkpoint_path.exists():
        print(f"ERROR: checkpoint not found at {checkpoint_path}")
        print("Train first: py -3.12 ml/scripts/train.py --smoke")
        return 2

    checkpoint = torch.load(checkpoint_path, map_location="cpu")
    class_index = checkpoint.get("class_index") or data.read_json(Path(args.class_index))
    classes = class_index["classes"]
    name_to_index = class_index["name_to_index"]
    config = checkpoint.get("config", {})
    set_seed(int(config.get("seed", 42)))

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    split_payload = data.read_json(Path(args.splits))
    root = Path(args.data_dir)
    _, eval_tf = build_transforms(int(checkpoint.get("image_size", 224)))
    test_paths = subsample(split_payload["splits"]["test"], args.limit_per_class, int(config.get("seed", 42)))
    test_paths = [p for p in test_paths if (root / p).exists()]
    if not test_paths:
        print("ERROR: no test images on disk. Run extract_dataset.py and make_splits.py first.")
        return 2

    dataset = LeafDataset(root, test_paths, name_to_index, eval_tf)
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=False, num_workers=args.num_workers)
    print(f"Evaluating {len(dataset)} test images on {device}")

    model = build_model(checkpoint["arch"], len(classes), pretrained=False)
    model.load_state_dict(checkpoint["state_dict"])
    model.to(device).eval()

    y_true: list[int] = []
    y_pred: list[int] = []
    top3_hits = 0
    confidences: list[float] = []
    with torch.no_grad():
        for inputs, targets in loader:
            outputs = model(inputs.to(device))
            probabilities = torch.softmax(outputs, dim=1).cpu()
            predictions = probabilities.argmax(1)
            y_true.extend(targets.tolist())
            y_pred.extend(predictions.tolist())
            confidences.extend(probabilities.max(1).values.tolist())
            topk = probabilities.topk(min(3, probabilities.size(1)), dim=1).indices
            top3_hits += int((topk == targets.view(-1, 1)).any(dim=1).sum().item())

    from sklearn.metrics import classification_report, confusion_matrix

    metrics = compute_metrics(y_true, y_pred, len(classes))
    metrics["top3_accuracy"] = top3_hits / max(1, len(y_true))
    metrics["mean_confidence"] = float(np.mean(confidences)) if confidences else 0.0
    metrics["test_images"] = len(y_true)
    matrix = confusion_matrix(y_true, y_pred, labels=list(range(len(classes))))
    report = classification_report(
        y_true, y_pred, labels=list(range(len(classes))), target_names=classes, output_dict=True, zero_division=0
    )
    per_class = {
        name: {
            "precision": float(values["precision"]),
            "recall": float(values["recall"]),
            "f1": float(values["f1-score"]),
            "support": int(values["support"]),
        }
        for name, values in report.items()
        if name in classes
    }

    tag = args.tag
    out_path = Path(args.out) if args.out else paths.ARTIFACTS_DIR / f"eval_metrics_{tag}.json"
    payload = {
        "checkpoint": str(checkpoint_path),
        "tag": tag,
        "device": str(device),
        "overall": metrics,
        "per_class": per_class,
        "trained_on": checkpoint.get("trained_on"),
        "best_epoch": checkpoint.get("best_epoch"),
        "note": (
            "Metrics come from a smoke-test subset and understate production performance."
            if config.get("smoke_test")
            else "Held-out test split metrics."
        ),
    }
    data.write_json(out_path, payload)
    save_confusion_matrix(
        matrix, classes, paths.ARTIFACTS_DIR / f"confusion_matrix_{tag}.png", paths.ARTIFACTS_DIR / f"confusion_matrix_{tag}.csv"
    )

    print(f"accuracy        : {metrics['accuracy']:.4f}")
    print(f"precision macro : {metrics['precision_macro']:.4f}")
    print(f"recall macro    : {metrics['recall_macro']:.4f}")
    print(f"f1 macro        : {metrics['f1_macro']:.4f}")
    print(f"f1 weighted     : {metrics['f1_weighted']:.4f}")
    print(f"top-3 accuracy  : {metrics['top3_accuracy']:.4f}")
    print(f"metrics written to {out_path}")
    print(f"confusion matrix  to {paths.ARTIFACTS_DIR / f'confusion_matrix_{tag}.png'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
