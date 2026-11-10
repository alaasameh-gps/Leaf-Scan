"""Small FastAPI inference service for the plant-leaf classifier.

The Next.js backend calls this service so that PyTorch inference never blocks
the Node.js event loop. It listens on 127.0.0.1 only (no external exposure) and
speaks JSON + base64 images.

Run (Windows PowerShell, from the project root):
    py -3.12 -m uvicorn ml.service.app:app --host 127.0.0.1 --port 8000

Endpoints:
    GET  /health   -> model state, classes, device
    GET  /classes  -> the 39 supported dataset classes
    POST /predict  -> {"image_base64": "...", "top_k": 3}
"""

from __future__ import annotations

import base64
import binascii
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, Header, HTTPException  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from inference.predictor import (  # noqa: E402
    InvalidImageError,
    ModelNotAvailableError,
    get_predictor,
)
from lib import paths  # noqa: E402

app = FastAPI(title="Plant Leaf Inference Service", version="1.0.0")

SERVICE_TOKEN = os.environ.get("PLANT_SERVICE_TOKEN", "").strip()
MAX_BASE64_CHARS = 12 * 1024 * 1024


class PredictRequest(BaseModel):
    image_base64: str = Field(..., min_length=16)
    top_k: int = Field(default=3, ge=1, le=10)


def check_token(provided: str | None) -> None:
    if SERVICE_TOKEN and provided != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing service token")


@app.get("/health")
def health(x_plant_token: str | None = Header(default=None)):
    check_token(x_plant_token)
    predictor = get_predictor()
    payload = {"status": "ok", "model_loaded": False, "model_path": str(paths.MODEL_PATH)}
    try:
        predictor.load()
        payload["model_loaded"] = True
        payload["model_info"] = predictor.model_info()
        payload["num_classes"] = len(predictor.class_names)
    except ModelNotAvailableError as exc:
        payload["status"] = "model_missing"
        payload["detail"] = str(exc)
    return payload


@app.get("/classes")
def list_classes():
    predictor = get_predictor()
    try:
        return {"classes": predictor.class_names}
    except ModelNotAvailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/predict")
def predict(payload: PredictRequest, x_plant_token: str | None = Header(default=None)):
    check_token(x_plant_token)
    if len(payload.image_base64) > MAX_BASE64_CHARS:
        raise HTTPException(status_code=413, detail="Image payload too large")

    raw = payload.image_base64
    if "," in raw[:64] and raw.strip().startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        binary = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="image_base64 is not valid base64") from exc

    predictor = get_predictor()
    try:
        result = predictor.predict(binary, top_k=payload.top_k)
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ModelNotAvailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return result.to_dict()
