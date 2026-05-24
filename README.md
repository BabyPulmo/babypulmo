# ShishuKantho — AI Pediatric Cough Diagnostic

> "Child's Voice" — Bangla voice-first WhatsApp AI that classifies pediatric respiratory disease from a 30-second cough recording.

THE INFINITY AI BUILDFEST 2026 — HealthTech Track — Preliminary submission due **2026-05-15**.

## What this is

A solo-built AI-native system that listens to a child's cough through any Android phone (WhatsApp voice note), classifies pediatric respiratory disease in 10 seconds using validated cough acoustic AI (Wav2Vec2 fine-tuned on Coswara), retrieves the matching WHO IMCI protocol via RAG, returns Bangla audio guidance, and auto-escalates severe cases to the nearest community health worker.

## Architecture (8 AI-native layers)

```
User Interaction      Meta WhatsApp Cloud API direct (free service msgs in BD)
Audio Preprocessing   Noise removal + cough segmentation + quality gate
AI Intelligence       Wav2Vec2-XLSR fine-tuned on Coswara → int8 ONNX on Modal CPU
Knowledge Retrieval   Supabase pgvector RAG over WHO IMCI + DGHS guidelines
Decision Layer        Rules-gated severity (deterministic) + stock Bangla scripts
Agent Orchestration   PostGIS-routed CHW alerts with audio + GPS
Data Infrastructure   Supabase Postgres + immutable audit + PostGIS
Deployment            Vercel + Supabase + Modal CPU + Google Cloud TTS
```

## Quick start

```bash
# 1. Install
cd shishukantho
npm install

# 2. Copy env template and fill in keys (see .env.example)
cp .env.example .env.local

# 3. Set up Supabase schema
# In Supabase SQL editor, paste supabase/schema.sql and run

# 4. Train the classifier (in Google Colab with T4 GPU)
# Upload colab/train_wav2vec2.ipynb to colab.research.google.com
# Run all cells. ~2 hours. Outputs ONNX model.

# 5. Deploy classifier to Modal or Replicate
# python colab/deploy_modal.py

# 6. Configure Twilio WhatsApp sandbox webhook
# Point to: https://<your-vercel-deploy>.vercel.app/api/webhook/whatsapp

# 7. Deploy to Vercel
vercel deploy
```

## Required API keys

See `DEPLOY.md`. Sign up for:
- **Vercel** (free) — hosting + edge functions
- **Supabase** (free) — Postgres + pgvector + storage + auth
- **Meta WhatsApp Cloud API** (free) — direct, no Twilio markup
- **Google Cloud Text-to-Speech** (~$16/1M chars, mostly cached) — Bangla TTS
- **OpenAI** — embeddings (one-time IMCI ingest)
- **Modal** (free credits) — CPU inference for the int8 cough classifier

## Repo structure

```
shishukantho/
├── app/
│   ├── api/
│   │   ├── webhook/whatsapp/route.ts   # Twilio WhatsApp ingress
│   │   └── classify/route.ts           # Classifier proxy
│   ├── chw/page.tsx                    # CHW alerts dashboard
│   ├── page.tsx                        # Landing
│   └── layout.tsx
├── lib/
│   ├── supabase.ts                     # Supabase client
│   ├── classifier.ts                   # Cough classifier wrapper
│   ├── rag.ts                          # pgvector retrieval
│   ├── claude.ts                       # Rules-gated severity table (no LLM)
│   ├── tts.ts                          # GCP Bangla TTS + content-hash cache + stock library
│   ├── whatsapp.ts                     # Meta WhatsApp Cloud API client
│   ├── escalation.ts                   # PostGIS nearest-CHW routing
│   ├── audit.ts                        # Immutable audit log
│   └── types.ts                        # Shared types
├── supabase/
│   ├── schema.sql                      # DB schema + RLS + extensions
│   └── seed_imci.sql                   # WHO IMCI embedded chunks
└── colab/
    ├── train_wav2vec2.ipynb            # Cough classifier training
    └── deploy_modal.py                 # Deploy ONNX → Modal/Replicate
```

## Demo flow

1. User sends a 30-sec cough voice note to the ShishuKantho WhatsApp number
2. Meta delivers a webhook to Vercel; signature verified via app-secret HMAC
3. Webhook downloads audio from Meta Graph API, uploads to Supabase Storage
4. Int8 ONNX classifier on Modal CPU returns `{class, confidence, heatmap}` (~5 sec)
5. RAG retrieves matching WHO IMCI protocol chunks (~500ms, logged for audit)
6. Rules-gated severity table picks the action; the matching stock Bangla script is selected — no LLM call at runtime
7. GCP TTS converts guidance to Bangla audio (cache hit on stock = $0)
8. Webhook sends text card + Bangla audio back to user via Meta Graph API
9. If severity triggers, alert posted to `/chw` dashboard with audio + GPS
10. CHW receives WhatsApp ping with audio attachment
11. Full audit row written to Supabase

## Critical design decisions

**Rules-gated severity, no runtime LLM**. Red-flag escalation is decided by a deterministic table over the classifier output. Bangla guidance is served from a hand-written stock library auditable by clinicians (no Claude call per request). This is the "responsible AI" point judges look for — every Bangla string a caregiver hears is one a CHW reviewed.

**Decision-support framing, not diagnostic device**. We do not claim to diagnose. We say "this cough shows signs of pneumonia, see a doctor now." Same legal framing as ResApp Health (Pfizer acquisition).

**Human-in-loop on every escalation**. Severe classifications always route to a real CHW with the audio attached. No automated treatment.

**Explainability**. Every classification returns a Grad-CAM spectrogram heatmap showing which acoustic features drove the result.

## Submission requirements (May 15)

- [ ] 3-min video pitch (see `../EXECUTION_PLAN.md` for the timed script)
- [ ] 1-page PDF summary (template in EXECUTION_PLAN.md)
- [ ] Working demo URL (Vercel deploy)
- [ ] GitHub public link
- [ ] NRB advisor named

## License

All ShishuKantho code is yours. Public datasets (Coswara, COUGHVID) used under their respective licenses. WHO IMCI content is public.
