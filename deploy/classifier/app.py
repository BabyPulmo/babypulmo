"""
Baby Pulmo — Wav2Vec2 int8 cough classifier FastAPI service.

Accepts: POST /predict with audio file (multipart) OR base64 in JSON body.
Returns: {class, confidence, class_probs, heatmap_url?}

Designed for CPU inference. On a 2-vCPU VPS, end-to-end ~3-5s per 30s cough clip.
"""

import base64
import io
import os
from typing import Optional

import librosa
import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

# ─── Config ───────────────────────────────────────────────────────────────
MODEL_PATH = os.environ.get("MODEL_PATH", "/app/models/babypulmo_wav2vec2_int8.onnx")
TARGET_SR = 16000  # Wav2Vec2-XLSR was trained at 16kHz
MAX_DURATION_S = 30.0

CLASSES = [
    "pneumonia",
    "bronchiolitis",
    "croup",
    "pertussis",
    "asthma",
    "normal",
    "insufficient_quality",
]

# ─── Model load (cold start) ──────────────────────────────────────────────
_session: Optional[ort.InferenceSession] = None


def get_session() -> Optional[ort.InferenceSession]:
    global _session
    if _session is not None:
        return _session
    if not os.path.exists(MODEL_PATH):
        print(f"[classifier] WARN: model not found at {MODEL_PATH} — running in mock mode")
        return None
    sess_options = ort.SessionOptions()
    sess_options.intra_op_num_threads = int(os.environ.get("OMP_NUM_THREADS", "2"))
    sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    _session = ort.InferenceSession(MODEL_PATH, sess_options, providers=["CPUExecutionProvider"])
    print(f"[classifier] loaded {MODEL_PATH}; inputs={[i.name for i in _session.get_inputs()]}")
    return _session


# ─── API ──────────────────────────────────────────────────────────────────
app = FastAPI(title="Baby Pulmo Classifier", version="0.1.0")


class PredictBase64(BaseModel):
    audio_base64: str


class PredictResponse(BaseModel):
    cough_class: str
    confidence: float
    class_probs: dict[str, float]
    mock: bool = False


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model_loaded": get_session() is not None}


@app.post("/predict", response_model=PredictResponse)
async def predict(file: Optional[UploadFile] = File(None), body: Optional[PredictBase64] = None) -> PredictResponse:
    audio_bytes = await _read_audio_bytes(file, body)
    samples = _decode_to_mono_16k(audio_bytes)
    if not _quality_gate(samples):
        return PredictResponse(
            cough_class="insufficient_quality",
            confidence=0.99,
            class_probs={c: (0.99 if c == "insufficient_quality" else 0.0) for c in CLASSES},
        )

    session = get_session()
    if session is None:
        # Mock fallback — same shape as production response so callers can be model-agnostic.
        return PredictResponse(
            cough_class="pneumonia",
            confidence=0.71,
            class_probs={c: (0.71 if c == "pneumonia" else 0.05) for c in CLASSES},
            mock=True,
        )

    probs = _run_inference(session, samples)
    top_idx = int(np.argmax(probs))
    return PredictResponse(
        cough_class=CLASSES[top_idx],
        confidence=float(probs[top_idx]),
        class_probs={CLASSES[i]: float(probs[i]) for i in range(len(CLASSES))},
    )


# ─── Helpers ──────────────────────────────────────────────────────────────
async def _read_audio_bytes(file: Optional[UploadFile], body: Optional[PredictBase64]) -> bytes:
    if file is not None:
        return await file.read()
    if body is not None and body.audio_base64:
        return base64.b64decode(body.audio_base64)
    raise HTTPException(status_code=400, detail="Provide audio file or audio_base64")


def _decode_to_mono_16k(audio_bytes: bytes) -> np.ndarray:
    try:
        samples, sr = librosa.load(io.BytesIO(audio_bytes), sr=TARGET_SR, mono=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not decode audio: {e}")
    # Cap duration to avoid OOM on adversarial inputs
    max_samples = int(MAX_DURATION_S * TARGET_SR)
    if samples.shape[0] > max_samples:
        samples = samples[:max_samples]
    return samples.astype(np.float32)


def _quality_gate(samples: np.ndarray) -> bool:
    """Reject too-short or too-quiet recordings. Returns True if usable."""
    if samples.shape[0] < TARGET_SR * 2:  # < 2 seconds
        return False
    rms = float(np.sqrt(np.mean(samples ** 2)))
    return rms > 0.005  # ~ -46 dBFS


def _run_inference(session: ort.InferenceSession, samples: np.ndarray) -> np.ndarray:
    """Single-batch inference. Returns softmax probability vector over CLASSES."""
    input_name = session.get_inputs()[0].name
    # Wav2Vec2 expects (batch, time) float32
    batched = samples.reshape(1, -1).astype(np.float32)
    outputs = session.run(None, {input_name: batched})
    logits = outputs[0][0]  # (num_classes,)
    exp = np.exp(logits - np.max(logits))
    return exp / exp.sum()
