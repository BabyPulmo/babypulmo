# Baby Pulmo — Architecture

Baby Pulmo implements all 8 layers of the BuildFest 2026 AI-Native Reference Architecture (participant guide, page 8). This document maps each layer to the actual implementation files in this repo.

## End-to-end data flow

```
       ┌─────────────────────┐
       │   Caregiver (mom)    │
       │  records 30-sec cough│
       │  on WhatsApp          │
       └──────────┬──────────┘
                  │ voice note
                  ▼
        ┌─────────────────────┐
        │ Meta WhatsApp Cloud │  (User Interaction Layer)
        │  API (direct, free  │
        │  service messages)  │
        └──────────┬──────────┘
                   │ webhook POST
                   ▼
        ┌─────────────────────┐
        │ /api/webhook/        │  (Application Logic Layer)
        │   whatsapp/route.ts  │
        └──────────┬──────────┘
                   │
        ┌──────────┴───────────┐
        ▼                      ▼
┌─────────────────┐  ┌─────────────────────┐
│ Supabase        │  │ Audio Preprocessing │
│ Storage         │  │ + Quality Gate      │
│ (audio upload)  │  └──────────┬──────────┘
└─────────────────┘             │
                                ▼
                  ┌─────────────────────────────────┐
                  │  Wav2Vec2 int8 ONNX             │  (AI Intelligence Layer)
                  │  Modal serverless CPU            │
                  │  6-class output                  │
                  │  + Grad-CAM heatmap              │
                  │  + breathsPerMin (RR counter)    │
                  │  Fused training set:             │
                  │   Coswara + COUGHVID + ICBHI     │
                  │   (pediatric subset, age ≤5y)    │
                  │   50–2500 Hz bandpass +          │
                  │   SpecAugment masking            │
                  └─────────────┬───────────────────┘
                                │ classification + RR
                                ▼
                  ┌─────────────────────────┐
                  │  Supabase pgvector RAG  │  (Knowledge Retrieval Layer)
                  │  WHO IMCI + DGHS chunks │
                  │  text-embedding-3-large │
                  └─────────────┬───────────┘
                                │ top-3 protocol chunks
                                ▼
                  ┌─────────────────────────────────┐
                  │  Multi-modal Severity Decision  │  (Decision Layer)
                  │  Inputs:                         │
                  │   1. audio class + confidence    │
                  │   2. breathsPerMin (RR)          │
                  │   3. ChildProfile (age/fever/    │
                  │      symptom-days from WhatsApp  │
                  │      Q&A)                        │
                  │  Rule: WHO tachypnea + respiratoy│
                  │   class ⇒ critical override.     │
                  │  Output: stock Bangla script.    │
                  │  No LLM at runtime.              │
                  └─────────────┬───────────────────┘
                                │ Bangla guidance + escalation flag
                                ▼
                  ┌─────────────────────────┐
                  │  GCP bn-IN Bangla TTS   │
                  │  (content-hash cached;   │
                  │   stock = $0/call)       │
                  └─────────────┬───────────┘
                                │ audio MP3
                                ▼
              ┌──────────────────────────────┐
              │  Reply caregiver (Meta WA)   │
              └──────────────────────────────┘
                                │
                                │ if mustEscalate:
                                ▼
                  ┌─────────────────────────┐
                  │  Nearest-CHW routing    │  (Agent Orchestration Layer)
                  │  PostGIS Haversine       │
                  │  (Neo4j-equivalent graph)│
                  └─────────────┬───────────┘
                                │ alert + audio + GPS
                                ▼
                  ┌─────────────────────────┐
                  │  CHW WhatsApp + /chw    │
                  │  realtime dashboard      │
                  │  (Supabase realtime)     │
                  └─────────────────────────┘

       (Every step writes to audit_log table — Data Infrastructure Layer)
       (Deployment: Vercel + Supabase + Modal CPU + GCP TTS — Deployment Layer)
```

## 8-layer mapping to code

| Layer | Implementation | File |
|---|---|---|
| 1. User Interaction | Meta WhatsApp Cloud API direct + IVR fallback | `lib/whatsapp.ts`, `app/api/webhook/whatsapp/route.ts` |
| 2. Application Logic | Next.js 14 App Router on Vercel | `app/api/*/route.ts` |
| 3. AI Intelligence | Wav2Vec2-XLSR fine-tuned on fused Coswara + COUGHVID + ICBHI pediatric subset (bandpass + SpecAugment) → int8 ONNX + Grad-CAM + respiratory-rate counter | `colab/train_wav2vec2.py`, `colab/deploy_modal.py`, `lib/classifier.ts`, `lib/respiratory-rate.ts` |
| 4. Knowledge Retrieval | Supabase pgvector RAG over WHO IMCI + DGHS | `lib/rag.ts`, `supabase/seed_imci.sql` |
| 5. Decision / Reasoning | Multi-modal rules-gated severity (audio class + respiratory rate + ChildProfile) + clinician-reviewed stock Bangla scripts; WHO IMCI tachypnea override | `lib/claude.ts` (`decideSeverityMultiModal`), `lib/respiratory-rate.ts` (`meetsTachypneaCriteria`), `lib/tts.ts` (`STOCK_BANGLA`) |
| 6. Agent Orchestration | Nearest-CHW routing + alert dispatch | `lib/escalation.ts`, `supabase/schema.sql` (find_nearest_chw) |
| 7. Data Infrastructure | Supabase Postgres + Storage + PostGIS + immutable audit log + nightly Parquet lakehouse exporter (DuckDB-WASM analytics on `/docs`) | `supabase/schema.sql`, `lib/audit.ts`, `lib/supabase.ts`, `scripts/export-audit-parquet.ts`, `app/docs/sections/AuditAnalytics.tsx` |
| 8. Deployment | Vercel + Supabase + Modal CPU + GCP TTS | `next.config.js`, `colab/deploy_modal.py`, Vercel project |

## §3 Architectural carve-out — where LLMs ARE allowed (and why caregivers still never see one)

Baby Pulmo's runtime path for the caregiver is, and always will be, deterministic + clinician-vetted stock-script. **Zero LLM tokens in the caregiver-facing runtime path.** This is the BMRC ethics review story and the entire pitch.

That said, the rubric for "AI-native" depth covers several legitimate use cases that DO NOT touch the caregiver runtime. We adopt them with explicit carve-outs documented here:

1. **Build-time only** (Claude Code, AI-DLC frameworks, LangGraph eval generator in `agents/langgraph-eval/`) — developer productivity. Never reaches production runtime.
2. **One-shot ingest** (Claude → Contextual RAG prefix generation in `scripts/build-contextual-chunks.ts`; OpenAI → text-embedding-3-large ingest; Whisper → caregiver onboarding age transcript) — runs once per protocol update or once per caregiver onboarding, never in the cough → severity decision path.
3. **CHW-side investigation tooling** (`agents/chw-investigate/` + `app/chw/investigate/page.tsx` driven by Ollama / Qwen2.5 in `chw-mobile/`) — CHWs are trained health professionals registered with Bangladesh DGHS; their tools may use LLMs to summarize queues and surface IMCI references. Read-only at the database layer (RLS-enforced); outputs never reach the caregiver WhatsApp surface.
4. **Partner-system MCP exposure** (`mcp/classifier-server/`, `mcp/imci-rag-server/`, `mcp/chw-routing-server/`) — third-party clinical assistants (hospital EHR agents, telemedicine apps) consume our primitives. The MCP tools wrap the same deterministic functions the production webhook uses; no LLM is introduced into our decision path.
5. **Federated learning** (`federated/`) — aggregation server only sees gradient deltas, never raw audio.
6. **Multi-modal vision** (`lib/cxr-vision.ts` + `colab/cxr_vision_modal.py`) — TorchXrayVision DenseNet121 is a discriminative vision model, not an LLM; its findings feed the same deterministic severity rules table.

Each of these carve-outs is documented in the referenced file's README so any reviewer (BMRC, Dr. Saadi, a judge) can verify the boundary.

## Responsible AI design choices

1. **Rules-gated, multi-modal severity + no runtime LLM.** `decideSeverityMultiModal()` in `lib/claude.ts` is a deterministic function over three inputs: (a) audio class + confidence from the Wav2Vec2 classifier, (b) `breathsPerMin` from the envelope-peak respiratory-rate counter (`lib/respiratory-rate.ts`), and (c) `ChildProfile` (age, sex, fever, symptom-days) collected via WhatsApp Q&A. Bangla guidance is served from `STOCK_BANGLA` in `lib/tts.ts` — clinician-reviewable hand-written scripts, one per `(class, severity)` tuple. No model writes new prose at request time, so every word a caregiver hears was vetted in advance. The WHO IMCI tachypnea criterion (≥50 bpm 2–12mo, ≥40 bpm 12–60mo) is a hard escalation override that fires on respiratory-class classifications above a 0.3 confidence floor — the multi-modal lift over audio-only systems.

2. **Decision-support framing.** All caregiver-facing language says "the cough shows signs of X, see a doctor" — never "your child has X." Same legal posture as ResApp Health (Pfizer acquired 2022).

3. **Mandatory human-in-loop.** Every severe classification routes to a real Community Health Worker with the original audio attached. No automated treatment recommendations beyond "see a doctor."

4. **Explainability.** Every classification returns a Grad-CAM spectrogram heatmap showing which acoustic features drove the result. This satisfies the BuildFest's "explainable AI" requirement for HealthTech.

5. **Immutable audit log.** Every interaction (greeting, classification, escalation, error) writes a row to `audit_log` with the full payload. This satisfies the BMRC ethics review trail requirement for clinical deployment.

6. **WHO IMCI grounding.** All Bangla guidance is RAG-retrieved from WHO IMCI + Bangladesh DGHS protocols. Contextual RAG prefixes (generated one-shot at ingest by `scripts/build-contextual-chunks.ts`) keep each chunk semantically locatable; Hybrid Search + Cohere multilingual rerank tighten Bangla-protocol retrieval. RAG output goes into the `audit_log` as the protocol justification for the deterministic decision — never into a runtime LLM prompt.

## Module file map

```
app/
  api/
    webhook/whatsapp/route.ts          → orchestrator (audio + optional CXR → classifier → RR → RAG → decideSeverityMultiModal → stock TTS → escalation)
    classify/route.ts                  → direct classifier proxy (testing only)
    chw/investigate/route.ts           → LangGraph CHW investigation agent endpoint (Phase 3F)
    docs/audit-manifest/route.ts       → manifest JSON for /docs DuckDB-WASM cell (Phase 1D)
  chw/
    page.tsx                           → realtime CHW alerts dashboard
    investigate/page.tsx               → agentic investigation dashboard (Phase 3F)
  docs/
    page.tsx                           → live /docs module (BuildFest bonus, Phase 1B)
    sections/AuditAnalytics.tsx        → DuckDB-WASM analytics cell over the latest Parquet partition
  page.tsx                             → public landing
  layout.tsx                           → app shell + Bangla font
  globals.css                          → Tailwind + Bangla helpers

lib/
  supabase.ts                          → service-role + anon clients
  types.ts                             → CoughClass, Severity, ClassificationResult, Guidance, MultiModalInput, ChildProfile, CxrSignal
  classifier.ts                        → wraps Modal endpoint; reads breathsPerMin + rrConfidence from classifier response; mock fallback
  respiratory-rate.ts                  → envelope-peak breath counter + WHO IMCI tachypnea thresholds (meetsTachypneaCriteria)
  cxr-vision.ts                        → TorchXrayVision DenseNet121 client (Phase 3A) + cxrPneumoniaPositive threshold
  whisper.ts                           → Whisper Bangla onboarding ASR client + parseBanglaAgeYears (Phase 2F + 3E)
  rag.ts                               → Contextual RAG retrieveImci + Hybrid Search retrieveImciHybrid + Cohere rerank
  claude.ts                            → SEVERITY_RULES + decideSeverityMultiModal (CXR override → tachypnea → audio_class → fail-closed)
  tts.ts                               → GCP Bangla TTS + STOCK_BANGLA + content-hash cache
  escalation.ts                        → find_nearest_chw via PostGIS
  audit.ts                             → immutable audit_log writer

mcp/                                   # Phase 1C + 2A — 3 MCP servers BUILT
  classifier-server/                   → classify_cough, score_severity, find_nearest_chw (stdio, TypeScript)
  imci-rag-server/                     → query_imci, query_imci_contextual, list_imci_sections, get_dosing
  chw-routing-server/                  → nearest_chw, chw_load_balance

agents/                                # LangGraph StateGraphs (build-time + CHW-side; never caregiver-facing)
  langgraph-eval/                      → synthetic eval-case generator
  chw-investigate/                     → CHW investigation dashboard orchestration (read-only via RLS)

federated/                             # Phase 3B — Flower federated learning scaffold
  flower-server.py                     → FedAvg aggregation
  hospital-client.py                   → hospital-side client; raw audio never leaves the hospital LAN
  README.md

chw-mobile/                            # Phase 2C — Ollama + Qwen2.5 CHW offline LLM
  ollama-config.yaml                   → Modelfile pinning qwen2.5:1.5b-q4_K_M
  triage-investigate.md                → Bangla system prompt
  README.md

mobile/                                # Phase 3C — Edge distillation + GGUF plan
  README.md

scripts/
  build-contextual-chunks.ts           → Phase 1A — one-shot Claude per-chunk context prefix generation
  export-audit-parquet.ts              → Phase 1D — nightly Parquet exporter for Lakehouse cell
  dp-export.ts                         → Phase 3D — OpenDP Laplace-noised aggregate exporter

colab/
  train_wav2vec2.py                    → Fused Coswara + COUGHVID + ICBHI pediatric subset → 50–2500 Hz bandpass → Wav2Vec2-XLSR fine-tune + SpecAugment → int8 ONNX
  deploy_modal.py                      → Modal serverless inference endpoint with Grad-CAM + RR counter
  cxr_vision_modal.py                  → Phase 3A — TorchXrayVision DenseNet121 endpoint
  deploy_whisper_modal.py              → Phase 2F — Whisper large-v3 Bangla endpoint
  distill_to_mobile.py                 → Phase 3C — Wav2Vec2 → MobileNetV3 distillation
  README.md                            → training + deployment instructions

deploy/
  n8n/                                 → Phase 2B — self-hosted n8n + BRAC weekly export workflow
  classifier/                          → Modal app deployment helper

supabase/
  schema.sql                           → tables, RLS, find_nearest_chw, 3 seeded CHWs in Bogura
  seed_imci.sql                        → match_imci_chunks (Contextual) + match_imci_chunks_hybrid + tsvector index + 10 sample IMCI chunks

docs/
  BMAD_PRD.md                          → BMAD-METHOD PRD (Phase 2G)
  KIRO_SPEC.md                         → AWS Kiro spec-driven AI-DLC (Phase 2G)
  N8N_WORKFLOWS.md                     → Phase 2B
  DP_ANALYSIS.md                       → Phase 3D — differential privacy methodology
  CXR_README.md                        → Phase 3A — CXR vision rationale + override rule
```

## Comparable systems (for the pitch)

- **ResApp Health** — same architecture for adult populations. Acquired by Pfizer for AUD $179M / USD ~$120M in August 2022.
- **Cohort.ai** — cough AI for adult and pediatric respiratory disease, deployed in Australian and US clinical settings.
- **Hyfe** — cough monitoring for chronic disease. $25M Series A 2023.

Baby Pulmo is the LMIC-deployable, Bangla-first, pediatric-pneumonia-focused version of this validated category.
