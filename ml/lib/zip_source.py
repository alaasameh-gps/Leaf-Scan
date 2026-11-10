"""Read the shipped Mendeley archive without extracting it to disk.

The downloaded archive contains two nested zip files (augmented and
non-augmented). The machine that hosts this project has very little free disk
space, so several helpers here stream the nested archive into memory instead of
unpacking it. Callers must therefore be aware that ``inner_zip`` cost roughly
the size of the nested archive in RAM (about 0.87 GB).
"""

from __future__ import annotations

import io
import shutil
import zipfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from . import paths


def open_outer_zip(zip_path: Path | str | None = None) -> zipfile.ZipFile:
    target = Path(zip_path) if zip_path else paths.DATASET_ZIP
    if not target.exists():
        raise FileNotFoundError(
            f"Dataset archive not found: {target}\n"
            "Place the downloaded Mendeley archive at that path or set PLANT_DATASET_ZIP."
        )
    return zipfile.ZipFile(target)


def find_inner_name(outer: zipfile.ZipFile, variant: str) -> str:
    candidates = [
        name
        for name in outer.namelist()
        if name.lower().endswith(".zip") and variant.lower() in name.lower() and not name.endswith("/")
    ]
    if not candidates:
        raise FileNotFoundError(
            f"No inner archive matching '{variant}' inside {outer.filename}. "
            f"Found: {outer.namelist()}"
        )
    return sorted(candidates, key=len)[0]


@contextmanager
def inner_zip(outer: zipfile.ZipFile, variant: str = paths.WITHOUT_AUGMENTATION) -> Iterator[zipfile.ZipFile]:
    name = find_inner_name(outer, variant)
    payload = outer.read(name)
    handle = zipfile.ZipFile(io.BytesIO(payload))
    try:
        yield handle
    finally:
        handle.close()


def list_images(archive: zipfile.ZipFile) -> list[zipfile.ZipInfo]:
    images = [
        info
        for info in archive.infolist()
        if not info.is_dir() and info.filename.lower().endswith(paths.IMAGE_EXTENSIONS)
    ]
    return sorted(images, key=lambda info: info.filename)


def class_name_from_member(member: str) -> str | None:
    parts = [p for p in member.split("/") if p]
    if len(parts) < 2:
        return None
    return parts[-2]


def free_disk_bytes(path: Path | str) -> int:
    return shutil.disk_usage(str(path)).free


def human_bytes(value: float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(value) < 1024:
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} PB"
