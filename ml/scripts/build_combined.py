"""Build a single combined classification dataset from the old PlantVillage set
plus the newly downloaded crops, normalizing every class to `Plant___Disease`.

- Old PlantVillage classes keep their names (relative to PlantVillage_full).
- New crops get a crop prefix and cleaned disease names.
- Files on the same volume as the output are hard-linked (no extra disk use);
  files on another volume are copied.

Usage:
    py -3.12 ml/scripts/build_combined.py
    py -3.12 ml/scripts/build_combined.py --out D:/leafscan_dataset --dry-run
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

OLD_DIR = Path(os.environ.get("PLANT_OLD_DIR", str(Path(__file__).resolve().parents[1] / "data" / "PlantVillage_full")))
NEW_DIR = Path(os.environ.get("PLANT_NEW_DIR", "D:/leafscan_new_data"))
DEFAULT_OUT = Path(os.environ.get("PLANT_COMBINED_DIR", "D:/leafscan_dataset"))

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")

# crop folder -> { source class folder : target Plant___Disease }
NEW_MAP: dict[str, dict[str, str]] = {
    "banana": {
        "healthy": "Banana___healthy",
        "segatoka": "Banana___Sigatoka",
        "xamthomonas": "Banana___Xanthomonas_wilt",
    },
    "cotton": {
        "Alternaria_Leaf": "Cotton___Alternaria_leaf_spot",
        "Bacterial_Blight": "Cotton___Bacterial_blight",
        "Fusarium_Wilt": "Cotton___Fusarium_wilt",
        "Healthy_Leaf": "Cotton___healthy",
        "Verticillium_Wilt": "Cotton___Verticillium_wilt",
    },
    "guava": {
        "Anthracnose": "Guava___Anthracnose",
        "Canker": "Guava___Canker",
        "Dot": "Guava___Dot",
        "Healthy": "Guava___healthy",
        "Rust": "Guava___Rust",
        "Scab": "Guava___Scab",
        "Styler end root": "Guava___Stylar_end_rot",
    },
    "lemon": {
        "Anthracnose": "Lemon___Anthracnose",
        "Bacterial Blight": "Lemon___Bacterial_blight",
        "Citrus Canker": "Lemon___Citrus_canker",
        "Curl Virus": "Lemon___Curl_virus",
        "Deficiency Leaf": "Lemon___Nutrient_deficiency",
        "Dry Leaf": "Lemon___Dry_leaf",
        "Healthy Leaf": "Lemon___healthy",
        "Sooty Mould": "Lemon___Sooty_mould",
        "Spider Mites": "Lemon___Spider_mites",
    },
    "rice": {
        "Bacterial_Leaf_Blight": "Rice___Bacterial_leaf_blight",
        "Brown_Spot": "Rice___Brown_spot",
        "Healthy_Rice_Leaf": "Rice___healthy",
        "Leaf_Blast": "Rice___Leaf_blast",
        "Leaf_Scald": "Rice___Leaf_scald",
        "Sheath_Blight": "Rice___Sheath_blight",
    },
    "sugarcane": {
        "Banded Chlorosis": "Sugarcane___Banded_chlorosis",
        "Brown Spot": "Sugarcane___Brown_spot",
        "BrownRust": "Sugarcane___Brown_rust",
        "Dried": "Sugarcane___Dried",
        "Grassy shoot": "Sugarcane___Grassy_shoot",
        "Healthy": "Sugarcane___healthy",
        "Pokkah Boeng": "Sugarcane___Pokkah_boeng",
        "Sett Rot": "Sugarcane___Sett_rot",
        "Smut": "Sugarcane___Smut",
        "Viral Disease": "Sugarcane___Viral_disease",
        "Yellow Leaf": "Sugarcane___Yellow_leaf",
    },
    "vegetables": {
        "Bitter_Gourd___Downey_mildew": "Bitter_Gourd___Downy_mildew",
        "Bitter_Gourd___Fresh_leaf": "Bitter_Gourd___healthy",
        "Bitter_Gourd___Fusarium_wilt": "Bitter_Gourd___Fusarium_wilt",
        "Bitter_Gourd___Mosaic_virus": "Bitter_Gourd___Mosaic_virus",
        "Bottle_gourd___Anthracnose": "Bottle_gourd___Anthracnose",
        "Bottle_gourd___Downey_mildew": "Bottle_gourd___Downy_mildew",
        "Bottle_gourd___Fresh_leaf": "Bottle_gourd___healthy",
        "Cauliflower___Black_Rot": "Cauliflower___Black_rot",
        "Cauliflower___Downy_mildew": "Cauliflower___Downy_mildew",
        "Cauliflower___Fresh_leaf": "Cauliflower___healthy",
        "Cucumber___Anthracnose_lesions": "Cucumber___Anthracnose",
        "Cucumber___Downy_mildew": "Cucumber___Downy_mildew",
        "Cucumber___Fresh_leaf": "Cucumber___healthy",
        "Eggplant___Eggplant_begomovirus": "Eggplant___Begomovirus",
        "Eggplant___Eggplant_Cercopora_leaf_spot": "Eggplant___Cercospora_leaf_spot",
        "Eggplant___Eggplant_fresh_leaf": "Eggplant___healthy",
        "Eggplant___Eggplant_verticillium_wilt": "Eggplant___Verticillium_wilt",
        "Tomato___Tomato_Bacterial_spot": "Tomato___Bacterial_spot",
        "Tomato___Tomato_Fresh_leaf": "Tomato___healthy",
        "Tomato___Tomato_leaf_curl_virus": "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
        "Tomato___Tomato_spotted_wilt": "Tomato___Spotted_wilt",
    },
}


def link_or_copy(src: Path, dst: Path) -> str:
    if dst.exists():
        return "skip"
    try:
        os.link(src, dst)
        return "link"
    except OSError:
        shutil.copy2(src, dst)
        return "copy"


def images_in(folder: Path) -> list[Path]:
    return sorted(f for f in folder.iterdir() if f.is_file() and f.suffix.lower() in IMAGE_EXTS)


def add_class(out_root: Path, target: str, src_files: list[Path], tag: str, stats: dict, dry: bool):
    dst_dir = out_root / target
    if not dry:
        dst_dir.mkdir(parents=True, exist_ok=True)
    for i, src in enumerate(src_files):
        dst = dst_dir / f"{tag}_{i:05d}{src.suffix.lower()}"
        if dry:
            action = "dry"
        else:
            action = link_or_copy(src, dst)
        stats[target] = stats.get(target, 0) + (1 if action != "skip" else 0)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--old", default=str(OLD_DIR))
    ap.add_argument("--new", default=str(NEW_DIR))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    old_dir, new_dir, out_root = Path(args.old), Path(args.new), Path(args.out)
    out_root.mkdir(parents=True, exist_ok=True)
    stats: dict[str, int] = {}

    # 1) old PlantVillage (as-is)
    old_classes = sorted(p for p in old_dir.iterdir() if p.is_dir())
    for cdir in old_classes:
        add_class(out_root, cdir.name, images_in(cdir), "pv", stats, args.dry_run)
    print(f"old classes: {len(old_classes)}")

    # 2) new crops (normalized)
    for crop, mapping in NEW_MAP.items():
        crop_dir = new_dir / crop
        if not crop_dir.exists():
            print(f"  !! missing crop dir: {crop_dir}")
            continue
        for src_class, target in mapping.items():
            sdir = crop_dir / src_class
            if not sdir.exists():
                print(f"  !! missing class dir: {sdir}")
                continue
            add_class(out_root, target, images_in(sdir), crop, stats, args.dry_run)

    print(f"\ncombined classes: {len(stats)}")
    total = sum(stats.values())
    print(f"total images: {total}")
    for name in sorted(stats):
        print(f"  {name}: {stats[name]}")
    print(f"\nout: {out_root}  (dry_run={args.dry_run})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
