# ShishuKantho — Architecture

ShishuKantho implements all 8 layers of the BuildFest 2026 AI-Native Reference Architecture (participant guide, page 8). This document maps each layer to the actual implementation files in this repo.

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
        │   Twilio WhatsApp   │  (User Interaction Layer)
        │   Business API       │
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
                  ┌─────────────────────────┐
                  │  Wav2Vec2 Classifier     │  (AI Intelligence Layer)
                  │  Modal serverless GPU/CPU│
                  │  6-class output +        │
                  │  Grad-CAM heatmap        │
                  └─────────────┬───────────┘
                                │ classification result
                                ▼
                  ┌─────────────────────────┐
                  │  Supabase pgvector RAG  │  (Knowledge Retrieval Layer)
                  │  WHO IMCI + DGHS chunks │
                  │  text-embedding-3-large │
                  └─────────────┬───────────┘
                                │ top-3 protocol chunks
                                ▼
                  ┌─────────────────────────┐
                  │  Rules-Gated Severity   │  (Decision Layer)
                  │  (deterministic, NOT LLM)│
                  │  + Claude Bangla reasoner│
                  └─────────────┬───────────┘
                                │ Bangla guidance + escalation flag
                                ▼
                  ┌─────────────────────────┐
                  │  ElevenLabs Bangla TTS  │
                  └─────────────┬───────────┘
                                │ audio MP3
                                ▼
              ┌──────────────────────────────┐
              │  Reply caregiver (Twilio)    │
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
       (Deployment: Vercel edge + Supabase + Modal — Deployment Layer)
```

## 8-layer mapping to code

| Layer | Implementation | File |
|---|---|---|
| 1. User Interaction | Twilio WhatsApp Business API + IVR fallback | `app/api/webhook/whatsapp/route.ts` |
| 2. Application Logic | Next.js 14 App Router on Vercel edge | `app/api/*/route.ts` |
| 3. AI Intelligence | Wav2Vec2-XLSR fine-tuned on Coswara + Grad-CAM | `colab/train_wav2vec2.py`, `colab/deploy_modal.py`, `lib/classifier.ts` |
| 4. Knowledge Retrieval | Supabase pgvector RAG over WHO IMCI + DGHS | `lib/rag.ts`, `supabase/seed_imci.sql` |
| 5. Decision / Reasoning | Rules-gated severity + Claude Bangla reasoner | `lib/claude.ts` |
| 6. Agent Orchestration | Nearest-CHW routing + alert dispatch | `lib/escalation.ts`, `supabase/schema.sql` (find_nearest_chw) |
| 7. Data Infrastructure | Supabase Postgres + Storage + PostGIS + audit log | `supabase/schema.sql`, `lib/audit.ts`, `lib/supabase.ts` |
| 8. Deployment | Vercel edge functions + Modal serverless inference | `next.config.js`, `colab/deploy_modal.py`, Vercel project |

## Responsible AI design choices

1. **Rules-gated severity, not LLM-gated.** `SEVERITY_RULES` in `lib/claude.ts` is a deterministic lookup table. The LLM writes the Bangla text but cannot decide whether a case is severe. Red-flag escalation depends only on `(classifier_class, classifier_confidence >= 0.5)`.

2. **Decision-support framing.** All caregiver-facing language says "the cough shows signs of X, see a doctor" — never "your child has X." Same legal posture as ResApp Health (Pfizer acquired 2022).

3. **Mandatory human-in-loop.** Every severe classification routes to a real Community Health Worker with the original audio attached. No automated treatment recommendations beyond "see a doctor."

4. **Explainability.** Every classification returns a Grad-CAM spectrogram heatmap showing which acoustic features drove the result. This satisfies the BuildFest's "explainable AI" requirement for HealthTech.

5. **Immutable audit log.** Every interaction (greeting, classification, escalation, error) writes a row to `audit_log` with the full payload. This satisfies the BMRC ethics review trail requirement for clinical deployment.

6. **WHO IMCI grounding.** All Bangla guidance is RAG-retrieved from WHO IMCI + Bangladesh DGHS protocols. The Claude prompt forces grounded output and forbids unsupported medical advice.

## Module file map

```
app/
  api/
    webhook/whatsapp/route.ts  → orchestrator (downloads audio, classifies, RAG, Claude, TTS, escalation)
    classify/route.ts          → direct classifier proxy (testing only)
  chw/page.tsx                 → realtime CHW dashboard
  page.tsx                     → public landing
  layout.tsx                   → app shell + Bangla font
  globals.css                  → Tailwind + Bangla helpers

lib/
  supabase.ts                  → service-role + anon clients
  types.ts                     → CoughClass, Severity, ClassificationResult, Guidance, etc.
  classifier.ts                → wraps Modal/Replicate endpoint; mock fallback when not configured
  rag.ts                       → text-embedding-3-large query → pgvector match
  claude.ts                    → SEVERITY_RULES (rules-gated) + generateBanglaGuidance
  tts.ts                       → ElevenLabs Bangla synthesis
  escalation.ts                → find_nearest_chw via PostGIS
  audit.ts                     → immutable audit_log writer

supabase/
  schema.sql                   → tables, RLS, find_nearest_chw, 3 seeded CHWs in Bogura
  seed_imci.sql                → match_imci_chunks function + 10 sample IMCI chunks

colab/
  train_wav2vec2.py            → Coswara dataset → Wav2Vec2-XLSR fine-tune → ONNX export
  deploy_modal.py              → Modal serverless inference endpoint with Grad-CAM heatmaps
  README.md                    → training + deployment instructions
```

## Comparable systems (for the pitch)

- **ResApp Health** — same architecture for adult populations. Acquired by Pfizer for AUD $179M / USD ~$120M in August 2022.
- **Cohort.ai** — cough AI for adult and pediatric respiratory disease, deployed in Australian and US clinical settings.
- **Hyfe** — cough monitoring for chronic disease. $25M Series A 2023.

ShishuKantho is the LMIC-deployable, Bangla-first, pediatric-pneumonia-focused version of this validated category.
