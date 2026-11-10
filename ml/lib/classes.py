"""Helpers to interpret dataset folder names.

The dataset encodes a label as ``<Crop>___<Condition>`` (for example
``Tomato___Early_blight``). The ``Background_without_leaves`` folder has no
separator because it does not describe a crop.
"""

from __future__ import annotations

SEPARATOR = "___"
BACKGROUND_CLASS = "Background_without_leaves"


def split_label(class_name: str) -> tuple[str, str]:
    if SEPARATOR in class_name:
        crop, condition = class_name.split(SEPARATOR, 1)
        return crop.replace(",", "").strip(), condition.strip()
    return class_name.strip(), ""


def is_background(class_name: str) -> bool:
    return class_name == BACKGROUND_CLASS


def is_healthy(class_name: str) -> bool:
    _, condition = split_label(class_name)
    return condition.lower() == "healthy"


def pretty_class_name(class_name: str) -> str:
    crop, condition = split_label(class_name)
    if not condition:
        return crop.replace("_", " ")
    return f"{crop.replace('_', ' ')} - {condition.replace('_', ' ')}"
