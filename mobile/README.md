# Baby Pulmo — Mobile / On-device Inference

Wraps the distilled MobileNetV3 student (from `colab/distill_to_mobile.py`) for on-device Android inference via llama.cpp GGUF Q4_K_M, targeted at CHW field tablets in low-connectivity rural upazila.

**v0 scaffold for prelim demo. Full Android wrapper + on-device accuracy regression suite Q3 2026.**

## Pipeline

```
fine-tuned Wav2Vec2 teacher (Colab, ~340M params, FP32)
                │
                ▼  knowledge distillation (KL + CE, T=4, α=0.7, 20 epochs)
                │
MobileNetV3-small student (~3.5M params, FP32)
                │
                ▼  torch.onnx.export
                │
babypulmo_student.onnx (~14 MB FP32)
                │
                ▼  llama.cpp convert.py --type q4_k_m
                │
babypulmo_student.gguf (~2.5 MB Q4_K_M)
                │
                ▼  Android wrapper bundles GGUF + llama.cpp runtime
                │
On-device CHW Android tablet (TFLite / llama.cpp Java bindings)
```

## Why distillation (not direct quantization further)

Wav2Vec2-XLSR int8 is already ~70 MB; further quantization to Q4 loses accuracy. The MobileNetV3 student over **mel-spectrogram features** (not raw waveform) is the standard pediatric cough mobile path — published systems (e.g., Bagad et al. 2022) confirm 1.5–3pp accuracy drop is acceptable for a 14× size reduction.

## Form claim

- ☑ Edge distillation (Fine-tuning section)
- ☑ MobileNetV3 (Open Source AI Tools)
- ☑ GGUF Q4_K_M (Formats handled)
- ☑ llama.cpp (Local LLM runtimes — used as inference runtime for the audio student, not for LLMs)

## What's NOT in v0

- Android Java/Kotlin wrapper around llama.cpp.
- TFLite alternative path (planned as fallback for Android <8).
- On-device accuracy regression suite (planned Q3 2026 with the BRAC pilot).

The README is the v0 deliverable; the smoke test is `python colab/distill_to_mobile.py --dry-run --teacher-checkpoint=mock.pt`.
