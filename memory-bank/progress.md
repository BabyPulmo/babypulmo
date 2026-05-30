# Progress

## Phase 1 — v0 working WhatsApp loop ✅

- Meta WhatsApp Cloud API direct webhook (`app/api/webhook/whatsapp/route.ts`).
- Wav2Vec2 6-class pediatric classifier trained on Coswara + COUGHVID + ICBHI (≤5y subset), int8 ONNX on Modal CPU (`colab/train_wav2vec2.py`).
- Multi-modal severity rules with CXR + tachypnea override precedence (`lib/claude.ts::decideSeverityMultiModal`).
- 7 clinician-vetted Bangla stock scripts via GCP `bn-IN-Wavenet-A` TTS (`lib/tts.ts::STOCK_BANGLA`).
- PostGIS Haversine CHW routing.
- Supabase Postgres + RLS append-only `audit_log`.
- 50–2500 Hz Butterworth bandpass + envelope-peak RR counter (`lib/respiratory-rate.ts`).
- Contextual + Hybrid RAG ingest (`scripts/build-contextual-chunks.ts`, `lib/rag.ts::retrieveImciHybrid`).
- Lakehouse Parquet exporter (`scripts/export-audit-parquet.ts`).

## Phase 2 — AI-DLC scaffolds + MCP ✅

- 3 MCP servers built (`mcp/{classifier,imci-rag,chw-routing}-server/`).
- LangGraph eval graph + CHW investigation graph (`agents/{langgraph-eval,chw-investigate}/`).
- Cohere multilingual reranker integration (`lib/rag.ts`).
- `/docs` live module with DuckDB-WASM Audit Analytics cell (`app/docs/`, `app/docs/sections/AuditAnalytics.tsx`).
- BMAD-METHOD PRD + AWS Kiro spec (`docs/BMAD_PRD.md`, `docs/KIRO_SPEC.md`).
- n8n self-hosted Docker workflow runner (`deploy/n8n/`).

## Phase 3 — scaffolds (production rollout Q3 2026)

| Scaffold | Status | Files |
|---|---|---|
| CXR vision (TorchXrayVision DenseNet121) | ✅ scaffold | `lib/cxr-vision.ts`, `colab/cxr_vision_modal.py`, `docs/CXR_README.md` |
| Whisper Bangla onboarding ASR | ✅ scaffold | `lib/whisper.ts`, `colab/deploy_whisper_modal.py` |
| CHW Android offline (Ollama + Qwen2.5) | ✅ scaffold | `chw-mobile/ollama-config.yaml`, `chw-mobile/README.md` |
| Federated learning (Flower) | ✅ scaffold | `federated/flower-server.py`, `federated/hospital-client.py` |
| Differential privacy (OpenDP Laplace) | ✅ scaffold | `scripts/dp-export.ts`, `docs/DP_ANALYSIS.md` |
| Edge distillation (Wav2Vec2 → MobileNetV3 GGUF) | ✅ scaffold | `colab/distill_to_mobile.py`, `mobile/` |
| Agentic CHW investigation page | ✅ scaffold | `app/chw/investigate/page.tsx` |

## Phase 3 production work — Q3 2026

- BRAC Bogura pilot deployment (≥ 1,000 caregivers, ≥ 50 CHWs).
- BMRC ethics review filing (after Dr. Saadi confirms clinical advisor role).
- Whisper + CXR Modal endpoints to production (currently scaffolded but not deployed to prod).
- Federated rollout to first partner hospital.
- Edge distill into a shipped CHW APK with ≤ 10 MB classifier weights.

## What's NOT done / not chasing

- Graph RAG — not implemented; not chasing pre-prelim.
- Figma — UI built in code only.
- 5th team member — Dr. Saadi outreach pending.
- Unit test suite — no runtime tests; build-time eval only.

## Last updated

2026-05-30 — see `activeContext.md` for current sprint state.
