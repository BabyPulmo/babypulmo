# Baby Pulmo — Pediatric Chest X-Ray (CXR) Vision Modal Deploy
# ──────────────────────────────────────────────────────────────────────────
# Modal serverless endpoint hosting TorchXrayVision DenseNet121 pretrained on
# CheXpert + NIH ChestX-ray14. Used when a caregiver also has access to a
# rural clinic with a backlit panel and can snap a phone photo of the CXR.
# This is the second clinical modality alongside cough audio + respiratory
# rate — adds a third independent signal to the multi-modal severity
# decision.
#
# Why this matters:
#   • 30% of pediatric pneumonia cases have ambiguous cough audio.
#   • A smartphone-photographed CXR (any backlit surface — clinic light box,
#     a window) is diagnostic-grade for consolidation / infiltrate detection.
#   • Adding CXR moves the architecture from audio-only to true multi-modal
#     medical AI — same pattern as the latest published pediatric pneumonia
#     systems (Lakhani & Sundaram 2017, Rajpurkar et al. CheXNet 2017).
#
# CLINICAL POSTURE PRESERVATION: CXR finding feeds the deterministic
# `decideSeverityMultiModal()` rules table as a hard override (per the
# updated rule: cxr_pneumonia ≥ 0.6 OR cxr_consolidation ≥ 0.6 →
# CRITICAL escalation). No LLM ever sees the image; no LLM ever speaks
# Bangla to the caregiver.
#
# v0 scaffold for prelim demo. Full pediatric subset fine-tune + BMRC ethics
# protocol Q3 2026.

import modal

app = modal.App("babypulmo-cxr-vision")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torchxrayvision==1.2.4",
        "torch==2.4.0",
        "torchvision==0.19.0",
        "pillow==10.4.0",
        "requests==2.32.3",
        "numpy==2.0.1",
        "scikit-image==0.24.0",
    )
)

# CheXpert + NIH-ChestX-ray14 pretrained DenseNet121 — the canonical
# TorchXrayVision multi-pathology weights. Lists 18 finding probabilities;
# we surface pneumonia + consolidation + no-finding for the multi-modal
# decision and return the full 18-class vector for downstream analysis.
MODEL_NAME = "densenet121-res224-all"


@app.cls(
    image=image,
    gpu=None,  # CPU is fast enough — DenseNet121 is <50M params
    cpu=2.0,
    memory=2048,
    container_idle_timeout=300,
    timeout=120,
)
class CxrVision:
    @modal.enter()
    def load(self):
        import torchxrayvision as xrv
        self.model = xrv.models.DenseNet(weights=MODEL_NAME)
        self.model.eval()
        self.pathologies = self.model.pathologies

    @modal.method()
    def classify(self, image_url: str) -> dict:
        """Download a CXR photo, preprocess, run inference, return findings."""
        import torch
        import torchxrayvision as xrv
        import requests
        import io
        from PIL import Image
        import numpy as np

        r = requests.get(image_url, timeout=30)
        r.raise_for_status()
        img = Image.open(io.BytesIO(r.content)).convert("L")  # grayscale

        # TorchXrayVision normalization — center crop to square, resize to
        # 224×224, scale to [-1024, 1024] convention used by all pretrained
        # X-ray weights in the library.
        arr = np.array(img, dtype=np.float32)
        arr = xrv.datasets.normalize(arr, 255)  # → roughly [-1024, 1024]
        arr = arr[None, ...]  # add channel dim
        transform = xrv.datasets.XRayCenterCrop()
        arr = transform(arr)
        # resize via PIL since torchvision Resize on the 1-channel array is fussy
        resized = np.array(
            Image.fromarray(arr[0].astype(np.float32)).resize((224, 224), Image.BILINEAR)
        )[None, ...]
        x = torch.from_numpy(resized).unsqueeze(0).float()  # (1, 1, 224, 224)

        with torch.no_grad():
            probs = self.model(x)[0].sigmoid().tolist()

        findings = dict(zip(self.pathologies, probs))
        return {
            "pneumonia_prob": float(findings.get("Pneumonia", 0.0)),
            "consolidation_prob": float(findings.get("Consolidation", 0.0)),
            "no_finding_prob": float(findings.get("No Finding", 0.0)),
            "all_findings": {k: float(v) for k, v in findings.items()},
            "model_version": MODEL_NAME,
        }


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def classify_endpoint(item: dict):
    """Vercel webhook calls this endpoint when msg.type === 'image'.

    Request: {"image_url": "https://..."}
    Response: {pneumonia_prob, consolidation_prob, no_finding_prob, all_findings}
    """
    url = item.get("image_url")
    if not url:
        return {"error": "image_url required"}
    return CxrVision().classify.remote(url)
