# System patterns

## 8-layer architecture

1. **User interaction** — Meta WhatsApp Cloud API direct webhook (`app/api/webhook/whatsapp/route.ts`). HMAC-verified signed payloads.
2. **Audio preprocessing** — `lib/respiratory-rate.ts` envelope-peak RR counter + Butterworth bandpass 50–2500 Hz + RMS/duration quality gate.
3. **AI intelligence** — Wav2Vec2-XLSR-53 fine-tuned (pediatric ≤5y subset of Coswara + COUGHVID + ICBHI) → int8 ONNX → Modal CPU. Optional: TorchXrayVision DenseNet121 for CXR (`lib/cxr-vision.ts`), Whisper large-v3 for Bangla onboarding age (`lib/whisper.ts`).
4. **Knowledge retrieval** — pgvector + tsvector Hybrid Search with optional Cohere `rerank-multilingual-v3.0` over WHO IMCI + Bangladesh DGHS protocols (`lib/rag.ts`). Anthropic-style Contextual RAG prefixes generated one-shot at ingest (`scripts/build-contextual-chunks.ts`).
5. **Decision layer** — `lib/claude.ts::decideSeverityMultiModal()`. **Deterministic** — not LLM discretion.
6. **Agent orchestration** — PostGIS Haversine routes severe cases to nearest CHW (`lib/escalation.ts`); Meta utility template message delivers audio + GPS.
7. **Data infrastructure** — Supabase Postgres + pgvector + PostGIS + immutable `audit_log` for BMRC trail. Lakehouse Parquet export (`scripts/export-audit-parquet.ts`) feeds DuckDB-WASM `/docs` analytics cell. DP-noised aggregates via `scripts/dp-export.ts`.
8. **Deployment** — Vercel (Next.js) + Modal (classifier + CXR + Whisper) + Supabase + GCP TTS.

## §3 carve-out — where LLMs ARE allowed

1. Build-time (Claude Code, LangGraph eval `agents/langgraph-eval/`, AI-DLC frameworks).
2. One-shot ingest (`scripts/build-contextual-chunks.ts` Claude Haiku context prefixes; OpenAI embeddings; `lib/whisper.ts` for caregiver onboarding age).
3. CHW-side investigation (`agents/chw-investigate/`, `app/chw/investigate/page.tsx`; `chw-mobile/` runs Qwen2.5-1.5B-q4_K_M via Ollama for offline triage).
4. Partner MCP exposure (`mcp/classifier-server/`, `mcp/imci-rag-server/`, `mcp/chw-routing-server/`).
5. Federated learning (`federated/flower-server.py` + `federated/hospital-client.py` — gradient deltas only, raw audio never leaves the partner hospital).
6. Multi-modal vision (`lib/cxr-vision.ts` — DenseNet121, discriminative, not an LLM).

Every other LLM use must be challenged. See `babypulmo/ARCHITECTURE.md` §3 for the canonical statement.

## Multi-modal severity override precedence

In `lib/claude.ts::decideSeverityMultiModal`:

1. **CXR pneumonia ≥ 0.6 OR consolidation ≥ 0.6** → CRITICAL (highest precedence; CheXNet Rajpurkar 2017 default).
2. **WHO IMCI tachypnea override** — ≥60 bpm 0–2mo, ≥50 bpm 2–12mo, ≥40 bpm 12–60mo → CRITICAL on respiratory-class predictions (confidence ≥ 0.3 floor).
3. **Audio classifier** (class + confidence) → severity table.
4. **Fail-closed default** — any missing/ambiguous signal escalates one severity tier.

Bangla audio response always comes from the clinician-vetted `STOCK_BANGLA` in `lib/tts.ts`. CXR/tachypnea overrides only change *severity routing*, never the script that plays.

## Other invariants

- Every interaction writes a row to `audit_log` (Postgres RLS append-only) — the BMRC ethics review trail.
- Bangla guidance includes "doctor-er bikolpo noy" disclaimer ("not a substitute for a doctor").
- Confidence < 0.5 → "please re-record" prompt; no guidance issued.
- Grad-CAM spectrogram heatmap surfaced to CHW (not caregiver).
