"""Extract the plant-disease dataset (fully or as a stratified subset).

The source archive is never modified. Output goes to ml/data/ which is
git-ignored.

Usage (Windows PowerShell, from the project root):
    # small smoke-test subset (24 images per class, ~1k images)
    py -3.12 ml/scripts/extract_dataset.py --per-class 24

    # full non-augmented dataset (needs ~0.9 GB free disk space)
    py -3.12 ml/scripts/extract_dataset.py --per-class 0
"""

from __future__ import annotations

import argparse
import collections
import random
import sys
import time
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib import data, paths, zip_source  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", default=str(paths.DATASET_ZIP))
    parser.add_argument(
        "--variant",
        default=paths.WITHOUT_AUGMENTATION,
        choices=[paths.WITHOUT_AUGMENTATION, paths.WITH_AUGMENTATION],
    )
    parser.add_argument("--out", default=None, help="Output directory (default ml/data/<variant>)")
    parser.add_argument(
        "--per-class",
        type=int,
        default=24,
        help="Images to take per class; 0 extracts everything",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--force", action="store_true", help="Re-extract even if the folder is populated")
    args = parser.parse_args()

    out_dir = Path(args.out) if args.out else paths.DATA_DIR / args.variant
    out_dir.mkdir(parents=True, exist_ok=True)

    outer = zip_source.open_outer_zip(args.zip)
    with zip_source.inner_zip(outer, args.variant) as inner:
        images = zip_source.list_images(inner)
        by_class: dict[str, list[zipfile.ZipInfo]] = collections.defaultdict(list)
        for info in images:
            class_name = zip_source.class_name_from_member(info.filename)
            if class_name:
                by_class[class_name].append(info)

        rng = random.Random(args.seed)
        selected: list[tuple[str, zipfile.ZipInfo]] = []
        for class_name in sorted(by_class):
            members = sorted(by_class[class_name], key=lambda i: i.filename)
            rng.shuffle(members)
            keep = members if args.per_class == 0 else members[: args.per_class]
            for info in keep:
                selected.append((class_name, info))

        required = sum(info.file_size for _, info in selected)
        free = zip_source.free_disk_bytes(paths.PROJECT_ROOT)
        print(f"Selected {len(selected)} images from {len(by_class)} classes")
        print(f"Required disk: {zip_source.human_bytes(required)} | free: {zip_source.human_bytes(free)}")
        if required > free * 0.9:
            print("ERROR: not enough free disk space for this extraction.")
            print("Free up space, choose a smaller --per-class value, or set PLANT_DATA_DIR to another drive.")
            return 2

        existing = sum(1 for _ in out_dir.rglob("*") if _.is_file())
        if existing and not args.force:
            print(f"Output already contains {existing} files. Use --force to re-extract. Nothing to do.")
            return 0

        start = time.time()
        written = 0
        for class_name, info in selected:
            filename = Path(info.filename).name
            target = out_dir / class_name / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            with inner.open(info) as source, target.open("wb") as destination:
                destination.write(source.read())
            written += 1
            if written % 500 == 0:
                print(f"  extracted {written}/{len(selected)} ...")

    counts = {name: len(files) for name, files in data.discover_images(out_dir).items()}
    print(f"Extracted {written} images to {out_dir} in {time.time() - start:.1f}s")
    print(f"Classes: {len(counts)} (min {min(counts.values())}, max {max(counts.values())})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
