"""Create reproducible train/val/test splits with exact-duplicate de-duplication.

Duplicate images (identical bytes) are grouped and assigned to a single split so
the same picture cannot leak between train and test.

Usage (Windows PowerShell, from the project root):
    py -3.12 ml/scripts/make_splits.py
    py -3.12 ml/scripts/make_splits.py --dedupe-off
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib import data, paths  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default=str(paths.EXTRACTED_DIR))
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--val-ratio", type=float, default=0.15)
    parser.add_argument("--test-ratio", type=float, default=0.15)
    parser.add_argument("--dedupe-off", action="store_true")
    parser.add_argument("--out", default=str(paths.SPLITS_FILE))
    parser.add_argument("--class-index-out", default=str(paths.CLASS_INDEX_FILE))
    args = parser.parse_args()

    root = Path(args.data_dir)
    mapping = data.discover_images(root)
    print(f"Found {len(mapping)} classes under {root}")

    payload = data.split_dataset(
        mapping,
        root,
        seed=args.seed,
        val_ratio=args.val_ratio,
        test_ratio=args.test_ratio,
        dedupe=not args.dedupe_off,
    )
    payload["root"] = str(root)

    index = data.build_class_index(list(mapping.keys()))
    data.write_json(Path(args.out), payload)
    data.write_json(Path(args.class_index_out), index)

    for bucket in ("train", "val", "test"):
        print(f"{bucket:>5}: {len(payload['splits'][bucket])} images")
    removed = sum(stats["duplicates_removed"] for stats in payload["class_stats"].values())
    print(f"Duplicate images removed: {removed}")
    print(f"Split file : {args.out}")
    print(f"Class index: {args.class_index_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
