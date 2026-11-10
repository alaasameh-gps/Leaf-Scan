"""Inspect the shipped Mendeley plant-disease archive.

Reports class counts, image formats, sampled dimensions, corrupted files and
duplicate images without extracting (or modifying) the archive.

Usage (Windows PowerShell, from the project root):
    py -3.12 ml/scripts/inspect_dataset.py
    py -3.12 ml/scripts/inspect_dataset.py --sample-per-class 40
"""

from __future__ import annotations

import argparse
import collections
import io
import sys
import time
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib import classes, data, paths, zip_source  # noqa: E402

try:
    from PIL import Image
except ImportError:  # pragma: no cover - pillow is a hard requirement
    Image = None


def inspect_variant(archive: zipfile.ZipFile, variant: str, sample_per_class: int, do_hash: bool) -> dict:
    images = zip_source.list_images(archive)
    by_class: dict[str, list[zipfile.ZipInfo]] = collections.defaultdict(list)
    unknown = []
    for info in images:
        class_name = zip_source.class_name_from_member(info.filename)
        if class_name is None:
            unknown.append(info.filename)
        else:
            by_class[class_name].append(info)

    extensions = collections.Counter(Path(i.filename).suffix.lower() for i in images)
    class_report = {}
    sampled_shapes = collections.Counter()
    corrupted: list[str] = []

    for class_name in sorted(by_class):
        members = by_class[class_name]
        entries = [i for i in members if i.filename.lower().endswith(paths.IMAGE_EXTENSIONS)]
        sample = entries[:sample_per_class]
        if sample_per_class == 0:
            sample = entries
        for info in sample:
            if Image is None:
                break
            try:
                with archive.open(info) as handle:
                    with Image.open(io.BytesIO(handle.read())) as image:
                        image.verify()
                with archive.open(info) as handle:
                    with Image.open(io.BytesIO(handle.read())) as image:
                        sampled_shapes[(image.size, image.mode)] += 1
            except Exception:
                corrupted.append(info.filename)
        crop, condition = classes.split_label(class_name)
        class_report[class_name] = {
            "crop": crop,
            "condition": condition or None,
            "is_healthy": classes.is_healthy(class_name),
            "is_background": classes.is_background(class_name),
            "count": len(entries),
            "unique_hashes": None,
            "duplicates": None,
        }

    duplicate_groups: list[list[str]] = []
    if do_hash and Image is not None:
        hash_map: dict[str, list[str]] = collections.defaultdict(list)
        hashes_by_class: dict[str, set] = collections.defaultdict(set)
        for info in images:
            with archive.open(info) as handle:
                digest = data.file_sha1_from_stream(handle)
            hash_map[digest].append(info.filename)
            class_name = zip_source.class_name_from_member(info.filename)
            if class_name:
                hashes_by_class[class_name].add(digest)
        for digest, members in hash_map.items():
            if len(members) > 1:
                duplicate_groups.append(members)
        for class_name, digests in hashes_by_class.items():
            duplicates = len(by_class.get(class_name, [])) - len(digests)
            class_report[class_name]["unique_hashes"] = len(digests)
            class_report[class_name]["duplicates"] = duplicates
        total_duplicate_files = sum(len(group) - 1 for group in duplicate_groups)

    counts = [entry["count"] for entry in class_report.values()]
    report = {
        "variant": variant,
        "total_images": len(images),
        "total_classes": len(class_report),
        "extensions": dict(extensions),
        "unknown_members": unknown[:20],
        "uncompressed_bytes": sum(i.file_size for i in images),
        "class_counts": {k: v["count"] for k, v in class_report.items()},
        "class_report": class_report,
        "sampled_shapes": {f"{size} {mode}": count for (size, mode), count in sampled_shapes.most_common()},
        "corrupted_images": corrupted[:50],
        "corrupted_count": len(corrupted),
        "duplicate_groups": duplicate_groups[:200],
        "duplicate_group_count": len(duplicate_groups),
        "duplicate_files_removable": (
            sum(len(group) - 1 for group in duplicate_groups) if do_hash and Image is not None else None
        ),
        "min_class_count": min(counts) if counts else 0,
        "max_class_count": max(counts) if counts else 0,
    }
    if do_hash and Image is not None:
        report["duplicate_files_removable"] = total_duplicate_files
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", default=str(paths.DATASET_ZIP), help="Path to the downloaded archive")
    parser.add_argument(
        "--variant",
        default="both",
        choices=["both", paths.WITHOUT_AUGMENTATION, paths.WITH_AUGMENTATION],
    )
    parser.add_argument("--sample-per-class", type=int, default=15, help="0 inspects every image")
    parser.add_argument("--no-hash", action="store_true", help="Skip duplicate hashing (faster)")
    parser.add_argument("--out", default=str(paths.DATASET_REPORT_FILE))
    args = parser.parse_args()

    start = time.time()
    zip_path = Path(args.zip)
    free = zip_source.free_disk_bytes(paths.PROJECT_ROOT)
    print(f"Archive: {zip_path}")
    print(f"Free disk space on project drive: {zip_source.human_bytes(free)}")

    variants = (
        [paths.WITHOUT_AUGMENTATION, paths.WITH_AUGMENTATION]
        if args.variant == "both"
        else [args.variant]
    )

    outer = zip_source.open_outer_zip(zip_path)
    combined = {
        "archive": str(zip_path),
        "archive_bytes": zip_path.stat().st_size,
        "free_disk_bytes": free,
        "members": outer.namelist(),
        "variants": {},
    }
    keep_going = True

    for variant in variants:
        if not keep_going:
            break
        print(f"\n=== {variant} ===")
        with zip_source.inner_zip(outer, variant) as inner:
            report = inspect_variant(inner, variant, args.sample_per_class, not args.no_hash)
        combined["variants"][variant] = report

        print(f"  images           : {report['total_images']}")
        print(f"  classes          : {report['total_classes']}")
        print(f"  extensions       : {report['extensions']}")
        print(f"  uncompressed size: {zip_source.human_bytes(report['uncompressed_bytes'])}")
        print(f"  class imbalance    : min={report['min_class_count']} max={report['max_class_count']}")
        print(f"  sampled shapes   : {report['sampled_shapes']}")
        print(f"  corrupted sample : {report['corrupted_count']}")
        print(f"  duplicate groups : {report['duplicate_group_count']} "
              f"(removable files: {report['duplicate_files_removable']})")
        if report["uncompressed_bytes"] > free:
            print("  NOTE: full extraction of this variant does NOT fit in free disk space.")
            print("        Use ml/scripts/extract_dataset.py --per-class N for a subset,")
            print("        or free disk space before a full training run.")

    class_index = data.build_class_index(
        list(combined["variants"][paths.WITHOUT_AUGMENTATION]["class_counts"].keys())
    )
    data.write_json(Path(args.out), combined)
    data.write_json(paths.CLASS_INDEX_FILE, class_index)
    print(f"\nReport written to {args.out}")
    print(f"Class mapping written to {paths.CLASS_INDEX_FILE} ({len(class_index['classes'])} classes)")
    print(f"Done in {time.time() - start:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
