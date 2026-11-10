"""Reusable inference module for the plant-leaf classifier.

The module validates the input, preprocesses it exactly like the evaluation
pipeline and returns the top-3 class predictions with confidence diagnostics.

Limitations (please keep these visible in any UI built on top):
  * The model only knows the 39 dataset categories, it is NOT a universal plant
    identification model.
  * The softmax score is a model score, not a probability of a correct
    diagnosis.
  * Predictions must not be used as the sole basis for treatment decisions.
"""

from __future__ import annotations

import io
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib import classes, data, paths  # noqa: E402

import torch  # noqa: E402
from PIL import Image, ImageFile  # noqa: E402
from torchvision import transforms  # noqa: E402

ImageFile.LOAD_TRUNCATED_IMAGES = False
Image.MAX_IMAGE_PIXELS = 40_000_000

DEFAULT_MAX_BYTES = 8 * 1024 * 1024
MIN_EDGE = 32


class InvalidImageError(ValueError):
    """Raised when an uploaded file is not a usable image."""


class ModelNotAvailableError(RuntimeError):
    """Raised when the trained checkpoint is missing or unreadable."""


@dataclass
class Prediction:
    class_name: str
    display_name: str
    crop: str | None
    condition: str | None
    is_healthy: bool
    is_background: bool
    score: float
    rank: int


@dataclass
class PredictionResult:
    predictions: list[Prediction]
    confidence: float
    confident: bool
    warnings: list[str] = field(default_factory=list)
    model_metrics: dict | None = None
    model_info: dict | None = None

    def to_dict(self) -> dict:
        return {
            "predictions": [vars(item) for item in self.predictions],
            "top": vars(self.predictions[0]) if self.predictions else None,
            "confidence": self.confidence,
            "confident": self.confident,
            "warnings": self.warnings,
            "model_metrics": self.model_metrics,
            "model_info": self.model_info,
        }


def _build_eval_transform(image_size: int, mean: Iterable[float], std: Iterable[float]):
    return transforms.Compose(
        [
            transforms.Resize(int(image_size * 1.14)),
            transforms.CenterCrop(image_size),
            transforms.ToTensor(),
            transforms.Normalize(list(mean), list(std)),
        ]
    )


def load_image(payload: bytes, max_bytes: int = DEFAULT_MAX_BYTES) -> Image.Image:
    if not payload:
        raise InvalidImageError("Empty image payload")
    if len(payload) > max_bytes:
        raise InvalidImageError(f"Image is larger than the {max_bytes // (1024 * 1024)} MB limit")
    try:
        image = Image.open(io.BytesIO(payload))
        image.load()
    except Exception as exc:  # noqa: BLE001 - any decode failure is a client error
        raise InvalidImageError("The uploaded file is not a readable image") from exc

    try:
        image = image.convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise InvalidImageError("The uploaded image could not be converted to RGB") from exc

    if min(image.size) < MIN_EDGE:
        raise InvalidImageError(f"Image is too small (minimum edge {MIN_EDGE}px)")
    return image


class PlantDiseasePredictor:
    """Loads the checkpoint once and serves top-3 predictions."""

    def __init__(self, checkpoint_path: Path | None = None, device: str | None = None):
        self.checkpoint_path = Path(checkpoint_path or paths.MODEL_PATH)
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self._model = None
        self._classes: list[str] | None = None
        self._index_to_name: dict[int, str] | None = None
        self._transform = None
        self._checkpoint: dict | None = None

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        if self._model is not None:
            return
        if not self.checkpoint_path.exists():
            raise ModelNotAvailableError(
                f"Trained model not found at {self.checkpoint_path}. "
                "Extract a subset and train with: py -3.12 ml/scripts/extract_dataset.py --per-class 24 "
                "then py -3.12 ml/scripts/train.py --smoke"
            )
        try:
            checkpoint = torch.load(self.checkpoint_path, map_location="cpu")
        except Exception as exc:  # noqa: BLE001
            raise ModelNotAvailableError(f"Checkpoint could not be loaded: {exc}") from exc

        from scripts.train import build_model  # local import keeps torchvision import lazy

        class_index = checkpoint.get("class_index") or data.read_json(paths.CLASS_INDEX_FILE)
        classes_list = class_index["classes"]
        model = build_model(checkpoint["arch"], len(classes_list), pretrained=False)
        model.load_state_dict(checkpoint["state_dict"])
        model.eval().to(self.device)

        normalization = checkpoint.get("normalization", {"mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]})
        self._transform = _build_eval_transform(
            int(checkpoint.get("image_size", 224)), normalization["mean"], normalization["std"]
        )
        self._model = model
        self._classes = classes_list
        self._index_to_name = {index: name for index, name in enumerate(classes_list)}
        self._checkpoint = checkpoint

    @property
    def class_names(self) -> list[str]:
        self.load()
        return list(self._classes or [])

    def model_info(self) -> dict:
        self.load()
        checkpoint = self._checkpoint or {}
        return {
            "arch": checkpoint.get("arch"),
            "num_classes": len(self._classes or []),
            "image_size": checkpoint.get("image_size", 224),
            "device": str(self.device),
            "best_epoch": checkpoint.get("best_epoch"),
            "val_metrics": checkpoint.get("val_metrics"),
            "trained_on": checkpoint.get("trained_on"),
            "checkpoint": str(self.checkpoint_path),
        }

    def predict(self, payload: bytes, top_k: int = 3, low_confidence_threshold: float | None = None,
                low_margin_threshold: float | None = None) -> PredictionResult:
        self.load()
        image = load_image(payload)
        tensor = self._transform(image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            logits = self._model(tensor)
            probabilities = torch.softmax(logits, dim=1)[0].cpu()

        k = max(1, min(top_k, probabilities.numel()))
        scores, indices = probabilities.topk(k)

        predictions: list[Prediction] = []
        for rank, (score, index) in enumerate(zip(scores.tolist(), indices.tolist()), start=1):
            class_name = (self._index_to_name or {})[index]
            crop, condition = classes.split_label(class_name)
            predictions.append(
                Prediction(
                    class_name=class_name,
                    display_name=classes.pretty_class_name(class_name),
                    crop=None if classes.is_background(class_name) else crop,
                    condition=condition or None,
                    is_healthy=classes.is_healthy(class_name),
                    is_background=classes.is_background(class_name),
                    score=float(score),
                    rank=rank,
                )
            )

        config = (self._checkpoint or {}).get("config", {})
        threshold = (
            low_confidence_threshold
            if low_confidence_threshold is not None
            else float(config.get("low_confidence_threshold", 0.45))
        )
        margin_threshold = (
            low_margin_threshold
            if low_margin_threshold is not None
            else float(config.get("low_margin_threshold", 0.15))
        )

        warnings: list[str] = []
        confidence = predictions[0].score
        confident = confidence >= threshold
        if len(predictions) > 1:
            margin = predictions[0].score - predictions[1].score
            if margin < margin_threshold:
                warnings.append(
                    "Top predictions are close to each other, so the result is ambiguous. "
                    "Try a clearer photo of a single leaf."
                )
                confident = False
        if not confident:
            warnings.append(
                "Low confidence: the image may be outside the 39 supported categories or too unclear for a reliable result."
            )
        if predictions[0].is_background:
            warnings.append(
                "The model classified this image as background / no leaf. Nothing is claimed about the plant, if any."
            )
        warnings.append(
            "This is an AI prediction over 39 dataset categories, not a verified diagnosis. "
            "Do not rely on it for pesticide or treatment decisions."
        )

        return PredictionResult(
            predictions=predictions,
            confidence=confidence,
            confident=confident,
            warnings=warnings,
            model_metrics=(self._checkpoint or {}).get("val_metrics"),
            model_info={
                "arch": (self._checkpoint or {}).get("arch"),
                "num_classes": len(self._classes or []),
                "trained_on": (self._checkpoint or {}).get("trained_on"),
            },
        )


_default_predictor: PlantDiseasePredictor | None = None


def get_predictor(checkpoint_path: Path | None = None) -> PlantDiseasePredictor:
    global _default_predictor
    if _default_predictor is None or (checkpoint_path and Path(checkpoint_path) != _default_predictor.checkpoint_path):
        _default_predictor = PlantDiseasePredictor(checkpoint_path)
    return _default_predictor
