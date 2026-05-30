# Baby Pulmo — Edge Distillation: Wav2Vec2-XLSR → MobileNetV3
# ──────────────────────────────────────────────────────────────────────────
# Knowledge-distillation script compressing the fine-tuned Wav2Vec2-XLSR
# pediatric cough classifier (~340M params, ~70 MB int8) into a MobileNetV3
# student over mel-spectrogram features (~3.5M params, ~5 MB int8 → ~2.5 MB
# GGUF Q4_K_M).
#
# Why: the next product cycle pushes inference 100% on-device for CHW field
# tablets in low-connectivity rural upazila. Server-side classification is
# the right v0 / v1 tradeoff (caregiver phones have limited compute), but
# CHW Android tablets can run the smaller distilled model in offline mode.
#
# Pipeline:
#   1. Teacher: load the fine-tuned Wav2Vec2 from train_wav2vec2.py output.
#   2. Student: MobileNetV3-small backbone over mel-spectrogram input.
#   3. Loss: KL-divergence on teacher logits + standard CE on labels.
#   4. Train 20 epochs (smaller model trains fast on Colab T4).
#   5. Export student → ONNX → GGUF Q4_K_M via llama.cpp's `convert_audio.py`
#      (or `ggml-quantize` for a pure-audio path).
#
# v0 scaffold for prelim demo. Phase 3 full distillation pipeline + Android
# wrapper + on-device accuracy regression suite in Q3 2026.

# %%
"""
Run locally:
    python colab/distill_to_mobile.py --dry-run --teacher-checkpoint=mock.pt
This builds the student architecture and prints layer summaries without
actually loading a checkpoint, useful for CI / scaffold smoke tests.
"""

import argparse


def build_student():
    """MobileNetV3-small adapted to log-mel-spectrogram input (1 channel)."""
    import torch
    import torch.nn as nn
    from torchvision.models import mobilenet_v3_small

    student = mobilenet_v3_small(weights=None)
    # First conv expects 3-channel images; swap for 1-channel mel-spec input.
    student.features[0][0] = nn.Conv2d(
        in_channels=1, out_channels=16, kernel_size=3, stride=2, padding=1, bias=False
    )
    # Classifier head: 6-class pediatric cough output (matches train_wav2vec2.py).
    in_features = student.classifier[-1].in_features
    student.classifier[-1] = nn.Linear(in_features, 6)
    return student


def load_teacher(checkpoint_path: str | None):
    """Load the fine-tuned Wav2Vec2 teacher (skip when --dry-run)."""
    if not checkpoint_path or checkpoint_path == "mock.pt":
        return None
    import torch
    from transformers import Wav2Vec2ForSequenceClassification

    teacher = Wav2Vec2ForSequenceClassification.from_pretrained(
        "facebook/wav2vec2-large-xlsr-53", num_labels=6
    )
    teacher.load_state_dict(torch.load(checkpoint_path, map_location="cpu"))
    teacher.eval()
    return teacher


def distillation_loss(student_logits, teacher_logits, labels, temperature=4.0, alpha=0.7):
    """Hinton KL distillation + standard CE."""
    import torch
    import torch.nn.functional as F

    kd = F.kl_div(
        F.log_softmax(student_logits / temperature, dim=-1),
        F.softmax(teacher_logits / temperature, dim=-1),
        reduction="batchmean",
    ) * (temperature**2)
    ce = F.cross_entropy(student_logits, labels)
    return alpha * kd + (1 - alpha) * ce


def export_onnx_and_gguf(student, output_dir: str = "."):
    """Export student → ONNX, then describe the GGUF conversion plan."""
    import torch
    import os

    student.eval()
    dummy = torch.zeros(1, 1, 128, 256)  # batch=1, channels=1, mel-bins=128, time=256
    onnx_path = os.path.join(output_dir, "babypulmo_student.onnx")
    torch.onnx.export(
        student,
        dummy,
        onnx_path,
        input_names=["mel_spec"],
        output_names=["logits"],
        dynamic_axes={"mel_spec": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=14,
    )
    print(f"✓ ONNX exported → {onnx_path}")
    print(
        "Next: convert to GGUF Q4_K_M via llama.cpp pipeline:\n"
        "  python llama.cpp/convert.py --input babypulmo_student.onnx \\\n"
        "    --output babypulmo_student.gguf --type q4_k_m\n"
        "Then bundle the GGUF with the Android wrapper in mobile/."
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--teacher-checkpoint", type=str, default=None)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--epochs", type=int, default=20)
    args = parser.parse_args()

    student = build_student()
    n_params = sum(p.numel() for p in student.parameters())
    print(f"Student MobileNetV3-small: {n_params/1e6:.2f}M params")

    teacher = load_teacher(args.teacher_checkpoint)
    if teacher is None:
        print("Teacher not loaded (dry-run); skipping training.")
    else:
        print("Teacher loaded; training would proceed for", args.epochs, "epochs.")
        # Production: full distillation loop over the fused Coswara + COUGHVID
        # + ICBHI pediatric loader (see train_wav2vec2.py §§1–4).

    if args.dry_run:
        print("Dry-run: skipping ONNX export.")
        return
    export_onnx_and_gguf(student)


if __name__ == "__main__":
    main()
