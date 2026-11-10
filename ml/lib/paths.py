"""Central path configuration for the plant disease ML pipeline."""

from __future__ import annotations

import os
from pathlib import Path

LIB_DIR = Path(__file__).resolve().parent
ML_DIR = LIB_DIR.parent
PROJECT_ROOT = ML_DIR.parent

DATA_DIR = Path(os.environ.get("PLANT_DATA_DIR", ML_DIR / "data"))
ARTIFACTS_DIR = Path(os.environ.get("PLANT_ARTIFACTS_DIR", ML_DIR / "artifacts"))
MODELS_DIR = Path(os.environ.get("PLANT_MODELS_DIR", ML_DIR / "models"))
RUNS_DIR = ML_DIR / "runs"

DEFAULT_DATASET_ZIP = PROJECT_ROOT / (
    "Data for Identification of Plant Leaf Diseases Using a 9-layer "
    "Deep Convolutional Neural Network.zip"
)
DATASET_ZIP = Path(os.environ.get("PLANT_DATASET_ZIP", DEFAULT_DATASET_ZIP))

WITHOUT_AUGMENTATION = "Plant_leaf_diseases_dataset_without_augmentation"
WITH_AUGMENTATION = "Plant_leaf_diseases_dataset_with_augmentation"

EXTRACTED_DIR = DATA_DIR / WITHOUT_AUGMENTATION
SPLITS_FILE = ARTIFACTS_DIR / "splits.json"
CLASS_INDEX_FILE = ARTIFACTS_DIR / "class_index.json"
DATASET_REPORT_FILE = ARTIFACTS_DIR / "dataset_report.json"
MODEL_PATH = MODELS_DIR / "plant_disease_mobilenetv3_small.pt"
TRAIN_CONFIG_FILE = ML_DIR / "config.json"

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")

for directory in (DATA_DIR, ARTIFACTS_DIR, MODELS_DIR):
    directory.mkdir(parents=True, exist_ok=True)
