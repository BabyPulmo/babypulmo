# Baby Pulmo — CHW offline mode

Local-LLM scaffold for CHW field-tablet investigation of the pending escalation queue when network connectivity drops (common in rural upazila during monsoon season).

**v0 scaffold for prelim demo. Full Phase 2 CHW tablet pilot rollout in BRAC Bogura Q3 2026.**

## Clinical posture (read first)

This is **CHW-side** tooling. CHWs are trained health professionals registered with Bangladesh DGHS. Their investigation tools may use local LLMs to summarize a queue of pending escalations, surface IMCI references, and draft hand-over notes — none of these reach the caregiver. The caregiver-facing Baby Pulmo system remains strictly rules-gated + clinician-vetted stock-script (no runtime LLM, ever). See `babypulmo/ARCHITECTURE.md` §3 carve-out for the full reasoning.

## Stack

- **Runtime:** Ollama 0.4+ on Android via Termux (preferred) or `llama.cpp` Kotlin wrapper on plain Android.
- **Primary model:** `qwen2.5:1.5b-instruct-q4_K_M` (~1 GB, strong Bangla support).
- **Fallback model:** `llama3.2:1b-instruct-q4_K_M` (slightly weaker Bangla but slightly faster).
- **Config:** `ollama-config.yaml` in this directory.
- **System prompt:** `triage-investigate.md` (Bangla).

Both models are open-weight Apache-2.0-equivalent licensed.

## Quick start (CHW tablet)

```bash
# 1. Install Termux + Ollama on Android (one-time setup)
pkg install ollama
ollama serve &

# 2. Pull the primary model (~1 GB; once per tablet)
ollama pull qwen2.5:1.5b-instruct-q4_K_M

# 3. Run an investigation prompt
ollama run qwen2.5:1.5b-instruct-q4_K_M < triage-investigate.md
```

A 30-second screen capture of this round-trip producing Bangla triage notes will be embedded in the `/docs` page before submission.

## Why not on-device cough classification?

The cough classifier (Wav2Vec2 int8 ONNX, ~280 MB FP32, ~70 MB int8) runs **server-side on Modal** because caregivers send voice notes from low-end Android phones with limited compute. The CHW offline LLM here is a *different* use case: a CHW reviewing other people's classifications in their field-tablet queue. Phase 3 edge-distillation (see `babypulmo/colab/distill_to_mobile.py`) does push the classifier on-device for the *next* product cycle — distilled student MobileNetV3 + GGUF Q4_K_M for both classifier and triage LLM.

## Models we test (form claim)

For the BuildFest form's Local LLMs / On-device LLMs section we claim only models actually downloaded and run during the 24-hour build push:

- ☑ **Ollama** runtime + bonus
- ☑ **Qwen 2.5** (primary)
- ☑ **Llama 3.2** (fallback)

Other models in the Ollama catalogue (DeepSeek, Phi-3, Gemma 2, Mistral) are NOT claimed unless `ollama pull` actually completed for them during the push.
