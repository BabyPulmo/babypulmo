# ShishuKantho — AI Pediatric Cough Diagnostic

> "Child's Voice" — Bangla voice-first WhatsApp AI that classifies pediatric respiratory disease from a 30-second cough recording.

THE INFINITY AI BUILDFEST 2026 — HealthTech Track — Preliminary submission due **2026-05-15**.

## What this is

A solo-built AI-native system that listens to a child's cough through any Android phone (WhatsApp voice note), classifies pediatric respiratory disease in 10 seconds using validated cough acoustic AI (Wav2Vec2 fine-tuned on Coswara), retrieves the matching WHO IMCI protocol via RAG, returns Bangla audio guidance, and auto-escalates severe cases to the nearest community health worker.

## Architecture (8 AI-native layers)

```
User Interaction      Twilio WhatsApp Business + IVR fallback
Audio Preprocessing   Noise removal + cough segmentation + quality gate
AI Intelligence       Wav2Vec2-XLSR fine-tuned on Coswara + Grad-CAM heatmap
Knowledge Retrieval   Supabase pgvector RAG over WHO IMCI + DGHS guidelines
Decision Layer        Rules-gated severity (NOT LLM) + Claude Bangla reasoning
Agent Orchestration   GraphDB-routed CHW alerts with audio + GPS
Data Infrastructure   Supabase Postgres + immutable audit + PostGIS
Deployment            Vercel edge + Modal GPU inference
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

See `.env.example`. Sign up for:
- **Vercel** (free) — hosting + edge functions
- **Supabase** (free) — Postgres + pgvector + storage + auth
- **Twilio** (free WhatsApp sandbox) — WhatsApp Business API
- **Anthropic** — Claude API key for reasoning agent
- **ElevenLabs** (free 10k chars/mo) — Bangla TTS
- **Modal** OR **Replicate** (free credits) — GPU inference for the cough classifier

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
│   ├── claude.ts                       # Claude Bangla reasoning agent
│   ├── tts.ts                          # ElevenLabs Bangla TTS
│   ├── escalation.ts                   # Rules-gated severity + CHW routing
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
2. Webhook downloads audio, uploads to Supabase Storage
3. Classifier returns: `{class, confidence, heatmap_url}` (~3 sec)
4. RAG retrieves matching WHO IMCI protocol chunks (~500ms)
5. Claude generates Bangla audio guidance + escalation decision (~2 sec)
6. ElevenLabs TTS converts guidance to Bangla audio
7. Twilio sends Bangla audio + text card back to user
8. If severity rule triggers, alert posted to `/chw` dashboard with audio + GPS
9. CHW receives WhatsApp ping with audio attachment
10. Full audit row written to Supabase

## Critical design decisions

**Rules-gated severity (NOT LLM-gated)**. Red-flag escalation is decided by deterministic rules over the classifier output, not by Claude's discretion. The LLM generates Bangla text but never decides if a case is severe. This is the "responsible AI" point judges look for.

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
