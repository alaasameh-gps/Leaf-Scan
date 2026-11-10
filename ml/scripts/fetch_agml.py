"""Download a HuggingFace AgML image dataset and export it to per-class folders.

Usage:
  py -3.12 ml/scripts/fetch_agml.py <dataset_id> <output_dir> [--limit_per_class N]

Example:
  py -3.12 ml/scripts/fetch_agml.py Project-AgML/banana_leaf_disease_classification D:/leafscan_new_data/banana
"""
import argparse
import os
import sys

from datasets import load_dataset
from PIL import Image


def _image_to_pil(value):
    """AgML image columns are dicts with 'bytes' and/or 'path'."""
    if isinstance(value, Image.Image):
        return value
    if isinstance(value, dict):
        data = value.get("bytes")
        if data:
            from io import BytesIO
            return Image.open(BytesIO(data)).convert("RGB")
        path = value.get("path")
        if path and os.path.exists(path):
            return Image.open(path).convert("RGB")
    if isinstance(value, str) and os.path.exists(value):
        return Image.open(value).convert("RGB")
    return None


def export(dataset_id, out_dir, limit_per_class=None, split="train", data_files=None, combine_col=None):
    os.makedirs(out_dir, exist_ok=True)
    print(f"loading {dataset_id} ...", flush=True)
    if data_files:
        ds = load_dataset(dataset_id, data_files=data_files, split=split)
    else:
        ds = load_dataset(dataset_id, split=split)

    # Resolve class names (ClassLabel -> names list, else str())
    label_col = "label" if "label" in ds.column_names else ds.column_names[-1]
    feat = ds.features[label_col]
    class_names = feat.names if hasattr(feat, "names") and feat.names else None

    combine_names = None
    if combine_col:
        cf = ds.features[combine_col]
        combine_names = cf.names if hasattr(cf, "names") and cf.names else None

    def _clean(s):
        return (s.replace("/", "_").replace("\\", "_").replace(" ", "_").strip() or "unknown")

    counts = {}
    saved = 0
    for i, row in enumerate(ds):
        lab = row[label_col]
        cname = class_names[lab] if class_names else str(lab)
        if combine_col:
            cval = row[combine_col]
            cplant = combine_names[cval] if combine_names else str(cval)
            cname = f"{cplant}___{cname}"
        cname = _clean(cname)
        if limit_per_class and counts.get(cname, 0) >= limit_per_class:
            continue
        img = _image_to_pil(row.get("image"))
        if img is None:
            continue
        cdir = os.path.join(out_dir, cname)
        os.makedirs(cdir, exist_ok=True)
        img.save(os.path.join(cdir, f"{counts.get(cname, 0):05d}.jpg"), "JPEG", quality=92)
        counts[cname] = counts.get(cname, 0) + 1
        saved += 1
        if saved % 500 == 0:
            print(f"  saved {saved} ...", flush=True)

    print(f"DONE {dataset_id} -> {out_dir}")
    print(f"  classes: {len(counts)}  images: {saved}")
    for k in sorted(counts):
        print(f"    {k}: {counts[k]}")
    return counts


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("dataset_id")
    p.add_argument("out_dir")
    p.add_argument("--limit_per_class", type=int, default=None)
    p.add_argument("--split", default="train")
    p.add_argument("--shards", default=None, help="comma-separated parquet paths inside the repo")
    p.add_argument("--combine", default=None, help="column to prefix the class name with (e.g. plant_type)")
    a = p.parse_args()
    shards = a.shards.split(",") if a.shards else None
    export(a.dataset_id, a.out_dir, a.limit_per_class, a.split, shards, a.combine)
