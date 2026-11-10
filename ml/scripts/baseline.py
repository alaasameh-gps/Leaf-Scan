"""Baseline references for the plant-disease task.

Two cheap always-available baselines are computed on the test split:
  1. majority class  - always predict the most frequent training class
  2. stratified random - predict according to the training class distribution

Optionally (--features) a frozen-imageNet-features + logistic-regression model is
trained as a stronger reference point.

Usage (Windows PowerShell, from the project root):
    py -3.12 ml/scripts/baseline.py
    py -3.12 ml/scripts/baseline.py --features --limit-per-class 60 --tag smoke
"""

from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib import data, paths  # noqa: E402

import numpy as np  # noqa: E402
import torch  # noqa: E402
from torch.utils.data import DataLoader  # noqa: E402

from train import LeafDataset, build_model, build_transforms, compute_metrics, subsample  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--splits", default=str(paths.SPLITS_FILE))
    parser.add_argument("--data-dir", default=str(paths.EXTRACTED_DIR))
    parser.add_argument("--class-index", default=str(paths.CLASS_INDEX_FILE))
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--limit-per-class", type=int, default=0)
    parser.add_argument("--features", action="store_true", help="Also fit a logistic-regression feature baseline")
    parser.add_argument("--arch", default="mobilenet_v3_small")
    parser.add_argument("--tag", default="test")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    split_payload = data.read_json(Path(args.splits))
    class_index = data.read_json(Path(args.class_index))
    name_to_index = class_index["name_to_index"]
    classes = class_index["classes"]
    num_classes = len(classes)
    index_to_name = {i: name for name, i in name_to_index.items()}

    rng = random.Random(args.seed)
    train_paths = subsample(split_payload["splits"]["train"], args.limit_per_class, args.seed)
    test_paths = subsample(split_payload["splits"]["test"], args.limit_per_class, args.seed)
    root = Path(args.data_dir)
    train_paths = [p for p in train_paths if (root / p).exists()]
    test_paths = [p for p in test_paths if (root / p).exists()]
    if not train_paths or not test_paths:
        print("ERROR: no images on disk. Run extract_dataset.py and make_splits.py first.")
        return 2

    train_labels = [name_to_index[p.split("/")[0]] for p in train_paths]
    test_labels = [name_to_index[p.split("/")[0]] for p in test_paths]

    counts = np.bincount(train_labels, minlength=num_classes)
    majority = int(counts.argmax())
    majority_pred = [majority] * len(test_labels)
    majority_metrics = compute_metrics(test_labels, majority_pred, num_classes)

    distribution = counts / counts.sum()
    random_pred = rng.choices(range(num_classes), weights=distribution.tolist(), k=len(test_labels))
    random_metrics = compute_metrics(test_labels, random_pred, num_classes)

    results: dict = {
        "seed": args.seed,
        "train_images": len(train_paths),
        "test_images": len(test_paths),
        "majority_class": {"class": index_to_name[majority], "metrics": majority_metrics},
        "stratified_random": {"metrics": random_metrics},
        "note": "Baselines are computed on the same splits used for training/evaluation.",
    }

    print(f"majority class -> {index_to_name[majority]}")
    print(f"  accuracy {majority_metrics['accuracy']:.4f} | f1 macro {majority_metrics['f1_macro']:.4f}")
    print(f"stratified random")
    print(f"  accuracy {random_metrics['accuracy']:.4f} | f1 macro {random_metrics['f1_macro']:.4f}")

    if args.features:
        from sklearn.linear_model import LogisticRegression

        device = torch.device("cpu")
        _, eval_tf = build_transforms(224)
        backbone = build_model(args.arch, num_classes, pretrained=True)
        backbone.classifier = torch.nn.Identity()
        backbone.eval().to(device)

        def extract(paths_list: list[str]) -> np.ndarray:
            dataset = LeafDataset(root, paths_list, name_to_index, eval_tf)
            loader = DataLoader(dataset, batch_size=32, shuffle=False)
            vectors = []
            with torch.no_grad():
                for inputs, _ in loader:
                    vectors.append(backbone(inputs).cpu().numpy())
            return np.concatenate(vectors, axis=0)

        print("Extracting frozen ImageNet features ...")
        X_train = extract(train_paths)
        X_test = extract(test_paths)
        clf = LogisticRegression(max_iter=2000, n_jobs=-1)
        clf.fit(X_train, train_labels)
        feature_pred = clf.predict(X_test).tolist()
        feature_metrics = compute_metrics(test_labels, feature_pred, num_classes)
        results["frozen_features_logreg"] = {"arch": args.arch, "metrics": feature_metrics}
        print(f"frozen features + logistic regression")
        print(f"  accuracy {feature_metrics['accuracy']:.4f} | f1 macro {feature_metrics['f1_macro']:.4f}")

    out_path = Path(args.out) if args.out else paths.ARTIFACTS_DIR / f"baseline_metrics_{args.tag}.json"
    data.write_json(out_path, results)
    print(f"written to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
