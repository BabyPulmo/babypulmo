"""Baby Pulmo — Modal deployment for cough classifier ONNX model.

Run:
    pip install modal
    modal token new
    modal deploy deploy_modal.py

This creates a serverless endpoint at:
    https://<your-username>--babypulmo-classify.modal.run

Update CLASSIFIER_ENDPOINT in your Vercel/Next.js .env.local with that URL.
"""

import modal

app = modal.App("babypulmo")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "onnxruntime==1.19.2",
        "librosa==0.10.2",
        "numpy==1.26.4",
        "requests==2.32.3",
        "matplotlib==3.9.2",
    )
    .copy_local_file(
        "babypulmo_wav2vec2_int8.onnx",
        "/model/babypulmo_wav2vec2.onnx",
    )
)

# Must match colab/train_wav2vec2.py::LABEL2ID exactly (6-class pediatric output).
# The runtime maps these to lib/types.ts CoughClass in lib/classifier.ts
# (healthy/common_cold -> "normal"; the rest pass through 1:1).
ID2LABEL = {
    0: "healthy",
    1: "common_cold",
    2: "bronchiolitis",
    3: "pneumonia",
    4: "asthma",
    5: "croup",
}

TARGET_SR = 16000
SEGMENT_LEN = TARGET_SR * 5  # 5 seconds


# CPU-only, 2 vCPU + 2 GB. ~5s int8 inference per call ≈ $0.0003 on Modal.
@app.cls(
    image=image,
    gpu=None,
    cpu=2.0,
    memory=2048,
    timeout=120,
    container_idle_timeout=300,
)
class Classifier:
    @modal.enter()
    def setup(self):
        import onnxruntime as ort
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 2
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(
            "/model/babypulmo_wav2vec2.onnx",
            sess_options=opts,
            providers=["CPUExecutionProvider"],
        )

    @modal.method()
    def classify(self, audio_url: str) -> dict:
        import io, requests, librosa, numpy as np
        import matplotlib.pyplot as plt
        import base64

        # 1. Fetch and load audio
        resp = requests.get(audio_url, timeout=30)
        resp.raise_for_status()
        waveform, _ = librosa.load(io.BytesIO(resp.content), sr=TARGET_SR, mono=True)

        # 2. Center-pad/trim to 5 sec
        if len(waveform) > SEGMENT_LEN:
            start = (len(waveform) - SEGMENT_LEN) // 2
            waveform = waveform[start : start + SEGMENT_LEN]
        else:
            pad = np.zeros(SEGMENT_LEN, dtype=np.float32)
            pad[: len(waveform)] = waveform
            waveform = pad

        # 3. Inference
        logits = self.session.run(
            ["logits"], {"input_values": waveform[np.newaxis, :].astype(np.float32)}
        )[0]
        # Softmax
        exp = np.exp(logits - logits.max(axis=1, keepdims=True))
        probs = exp / exp.sum(axis=1, keepdims=True)
        probs = probs[0]
        top = int(probs.argmax())

        # 4. Generate spectrogram heatmap (PNG, base64-encoded data URL)
        spec = np.abs(librosa.stft(waveform, n_fft=512, hop_length=128))
        spec_db = librosa.amplitude_to_db(spec, ref=np.max)
        fig, ax = plt.subplots(figsize=(8, 3), dpi=100)
        ax.imshow(spec_db, aspect="auto", origin="lower", cmap="magma")
        ax.set_title(f"{ID2LABEL[top]} — {probs[top]*100:.0f}%")
        ax.axis("off")
        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", pad_inches=0.1)
        plt.close(fig)
        heatmap_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        return {
            "class": ID2LABEL[top],
            "confidence": float(probs[top]),
            "class_probs": {ID2LABEL[i]: float(p) for i, p in enumerate(probs)},
            "heatmap_url": f"data:image/png;base64,{heatmap_b64}",
            "model_version": "wav2vec2-coswara-v1",
        }


@app.function(image=image)
@modal.web_endpoint(method="POST")
def classify_endpoint(audio_url: str):
    """HTTP POST endpoint. Body: {"audio_url": "..."}."""
    return Classifier().classify.remote(audio_url)
