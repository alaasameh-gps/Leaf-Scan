"""Dataset discovery, duplicate detection and reproducible splitting."""

from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path

from . import classes, paths


def discover_images(root: Path) -> dict[str, list[Path]]:
    if not root.exists():
        raise FileNotFoundError(f"Extracted dataset folder not found: {root}")
    mapping: dict[str, list[Path]] = {}
    for class_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        files = sorted(
            f
            for f in class_dir.rglob("*")
            if f.is_file() and f.suffix.lower() in paths.IMAGE_EXTENSIONS
        )
        if files:
            mapping[class_dir.name] = files
    if not mapping:
        raise FileNotFoundError(f"No class folders with images found under {root}")
    return mapping


def file_sha1(path: Path, chunk_size: int = 1 << 20) -> str:
    digest = hashlib.sha1()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(chunk_size)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def file_sha1_from_stream(stream, chunk_size: int = 1 << 20) -> str:
    digest = hashlib.sha1()
    while True:
        chunk = stream.read(chunk_size)
        if not chunk:
            break
        digest.update(chunk)
    return digest.hexdigest()


def build_class_index(class_names: list[str]) -> dict:
    ordered = sorted(class_names)
    return {
        "classes": ordered,
        "name_to_index": {name: i for i, name in enumerate(ordered)},
        "index_to_name": {str(i): name for i, name in enumerate(ordered)},
        "is_background": {name: classes.is_background(name) for name in ordered},
    }


def split_dataset(
    mapping: dict[str, list[Path]],
    root: Path,
    seed: int = 42,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    dedupe: bool = True,
) -> dict:
    rng = random.Random(seed)
    splits: dict[str, list[str]] = {"train": [], "val": [], "test": []}
    stats: dict[str, dict] = {}
    duplicate_groups: list[list[str]] = []

    for class_name in sorted(mapping):
        files = list(mapping[class_name])
        rng.shuffle(files)

        groups: list[list[Path]] = []
        if dedupe:
            by_hash: dict[str, list[Path]] = {}
            for file in files:
                by_hash.setdefault(file_sha1(file), []).append(file)
            for group in by_hash.values():
                if len(group) > 1:
                    duplicate_groups.append([_relative(p, root) for p in group[1:]])
                groups.append(group)
            rng.shuffle(groups)
        else:
            groups = [[file] for file in files]

        total_groups = len(groups)
        n_test = int(round(total_groups * test_ratio))
        n_val = int(round(total_groups * val_ratio))
        if total_groups >= 3:
            n_test = max(1, n_test)
            n_val = max(1, n_val)
            while n_test + n_val >= total_groups:
                if n_test > n_val:
                    n_test -= 1
                else:
                    n_val -= 1

        for offset, group in enumerate(groups):
            if offset < n_test:
                bucket = "test"
            elif offset < n_test + n_val:
                bucket = "val"
            else:
                bucket = "train"
            for file in group:
                splits[bucket].append(_relative(file, root))

        kept = sum(len(group) for group in groups)
        stats[class_name] = {
            "files_found": len(files),
            "unique_images": kept,
            "duplicates_removed": len(files) - kept,
            "train": sum(1 for p in splits["train"] if p.startswith(f"{class_name}/")),
            "val": sum(1 for p in splits["val"] if p.startswith(f"{class_name}/")),
            "test": sum(1 for p in splits["test"] if p.startswith(f"{class_name}/")),
        }

    return {
        "seed": seed,
        "val_ratio": val_ratio,
        "test_ratio": test_ratio,
        "dedupe": dedupe,
        "splits": splits,
        "class_stats": stats,
        "duplicate_groups_removed": duplicate_groups,
    }


def _relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))
