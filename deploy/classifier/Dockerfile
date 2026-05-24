# Baby Pulmo — Cough classifier (Wav2Vec2 int8 ONNX) on FastAPI
# Designed for CPU inference on a 2-vCPU VPS. ~80MB model + ~400MB runtime.

FROM python:3.11-slim AS builder

WORKDIR /build

# System deps for librosa (soundfile needs libsndfile, librosa needs ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ─── Final image ──────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

COPY app.py .

EXPOSE 8000

# uvicorn with 1 worker — int8 ONNX is already CPU-efficient; more workers compete for the same cores
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
