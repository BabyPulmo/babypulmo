# CLAUDE.md

Guidance for working in this repo. For the full pitch/deep-dive see `README.md` and `ARCHITECTURE.md`; this file is the engineering quick-reference.

## What this is

Baby Pulmo is a Bangla, voice-first WhatsApp AI that triages pediatric respiratory disease from a ~30s cough voice note. Flow: caregiver sends a WhatsApp voice note → cough is classified → matching WHO IMCI protocol is retrieved → a **deterministic** severity rule picks a **pre-vetted Bangla script** → reply is sent as text + cached TTS audio → severe cases escalate to the nearest community health worker (CHW). Every step is written to an immutable audit log. Built for THE INFINITY AI BUILDFEST 2026 (HealthTech).

The git repo root is `babypulmo/` (this directory), nested inside an outer `X:\BabyPulmo` wrapper. Run all commands from here.

## Commands

```bash
npm install
npm run dev         # local dev server on :3000
npm run build       # production build (output: standalone)
npm run start       # serve the production build
npm run lint        # next lint (eslint)
npm run type-check  # tsc --noEmit
```

There is **no test runner configured** — no `npm test`, no test files. Verify changes with `type-check`, `lint`, and manual runs.

## Tech stack

- **Next.js 14.2** App Router, `output: "standalone"`, React 18, **TypeScript (strict)**. Path alias `@/*` → repo root.
- **Tailwind 3.4** + PostCSS. **Zod** for validation.
- **Supabase**: Postgres + Storage + `pgvector` (RAG) + `postgis` (CHW geo-routing). Schema in `supabase/schema.sql`.
- **Meta WhatsApp Cloud API** (direct, HMAC-verified webhooks — not Twilio).
- **Classifier**: Wav2Vec2-XLSR int8 ONNX. Two serving paths: Modal CPU (`colab/deploy_modal.py`) or a self-hosted **FastAPI + onnxruntime** container (`deploy/classifier/app.py`).
- **TTS**: GCP `bn-IN` WaveNet, content-hash cached in Supabase Storage.
- **OpenAI** `text-embedding-3-large` (3072-dim) — ingest-time only, not in the request path.

## Request flow (the one orchestrator)

`app/api/webhook/whatsapp/route.ts` is the heart of the system. On an audio message it: downloads media from Meta → uploads to Supabase Storage → `classifyCough` → `retrieveImci` (logged for explainability) → `decideSeverity` (deterministic) → `getStockBangla` → `synthesizeBanglaCached` → replies text + audio → if `mustEscalate`, `findNearestChw` + alert → `audit(...)`. `GET` on the same route handles the Meta webhook verification handshake.

## Module map

```
app/
  api/webhook/whatsapp/route.ts  orchestrator (above) — the main entry point
  api/classify/route.ts          direct classifier proxy (testing only)
  chw/page.tsx                   CHW alerts dashboard
  page.tsx, layout.tsx, globals.css
lib/
  supabase.ts     supabaseAdmin (service-role, bypasses RLS) + supabaseAnon
  types.ts        CoughClass, Severity, ClassificationResult, Guidance, Chw, etc.
  classifier.ts   POSTs to CLASSIFIER_ENDPOINT; mockClassify() fallback when unset
  rag.ts          embed query → match_imci_chunks RPC; keyword fallback when no embeddings
  claude.ts       decideSeverity — deterministic SEVERITY_RULES table (NO LLM)
  tts.ts          GCP Bangla TTS, content-hash cache, STOCK_BANGLA library, warmStockCache()
  whatsapp.ts     Meta client: HMAC verify, extractMessages, downloadMedia, sendText/sendAudio
  escalation.ts   findNearestChw via find_nearest_chw PostGIS RPC
  audit.ts        immutable audit_log writer
supabase/   schema.sql (tables, RLS, find_nearest_chw, seed CHWs), seed_imci.sql
colab/      train_wav2vec2.py (fine-tune → ONNX), deploy_modal.py (Modal endpoint)
deploy/     docker-compose.yml, Dockerfile.web, classifier/ (FastAPI), nginx-host/, deploy.sh
.github/workflows/deploy.yml   self-hosted-runner auto-deploy on push to main
```

## Critical conventions (not obvious from the code — respect these)

- **No LLM at runtime.** Severity is a deterministic lookup table (`lib/claude.ts`), and every Bangla string a caregiver hears is a clinician-pre-vetted stock script (`lib/tts.ts`). Do **not** introduce a runtime model call that generates caregiver-facing medical prose — this is a core "responsible AI" property of the design. (The file is named `claude.ts` for historical reasons; it contains no LLM call.)
- **Decision-support framing, never diagnostic.** Caregiver-facing copy says "the cough shows signs of X — see a doctor," never "your child has X."
- **Human-in-loop + audit.** Every severe classification routes to a real CHW with the original audio attached. Every interaction writes a row to `audit_log` (`lib/audit.ts`).
- **Clinical content is private and env-loaded.** `SEVERITY_RULES_JSON` and `STOCK_BANGLA_JSON` are parsed once at module init from env vars, sourced from the private `BabyPulmo/clinical-content` repo. They are intentionally **not** in this public repo. When unset, the code **fails closed**: `decideSeverity` returns escalate-by-default (`high` / `see_chw_now`). Keep that fail-closed behavior intact.
- **Explainability.** Classifications carry a Grad-CAM spectrogram heatmap (`heatmapUrl`).
- **`supabaseAdmin` bypasses RLS** (service role) — it's server-only. Never import it into client components.

## Environment & setup

Copy `.env.example` → `.env.local` and fill in keys. Initialize the DB by running `supabase/schema.sql` then `supabase/seed_imci.sql` in the Supabase SQL editor.

**WhatsApp env vars** use the `META_WHATSAPP_*` prefix throughout — code, `.env.example`, and `deploy/.env.production.example` are aligned:
`META_WHATSAPP_APP_SECRET`, `META_WHATSAPP_VERIFY_TOKEN`, `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, and the optional `META_WHATSAPP_GRAPH_VERSION` (defaults to `v21.0`). Read in `lib/whatsapp.ts` and `app/api/webhook/whatsapp/route.ts`.

## Known gotchas (current discrepancies — verify before relying on them)

- **Classifier request shape.** `lib/classifier.ts` POSTs `{ audio_url }`, but the self-hosted FastAPI `/predict` (`deploy/classifier/app.py`) only accepts a multipart `file` or `{ audio_base64 }` — no `audio_url` handler. The Modal variant may differ; confirm which endpoint is canonical before wiring up Phase 2.
- **Train/serve class mismatch.** `colab/train_wav2vec2.py` trains a **3-class** proof-of-concept (`cough_pneumonia_like`, `cough_asthma_like`, `cough_normal`), but `lib/types.ts` and `deploy/classifier/app.py` define **7 classes** (pneumonia, bronchiolitis, asthma, croup, pertussis, normal, insufficient_quality), and their orderings also differ. These must be reconciled before a real model is deployed; until then the system runs on `mockClassify()`.
- **Missing `/api/health`.** The Docker healthcheck and CI smoke-test both hit `/api/health`, but the route does not exist yet — the web container healthcheck will fail until it's added.
- **RLS is relaxed for the demo** (anon can read `alerts`/`chws`). Tighten before any real deployment.
- **Stale references.** Some comments/docs mention "Claude-generated" guidance and "ElevenLabs"; the implementation is rules-gated + GCP TTS.

## Deployment

Docker Compose on a shared VPS (web bound to `127.0.0.1:3010`), host **nginx + certbot** as the HTTPS reverse proxy (not Caddy, not in Docker). Push to `main` triggers a GitHub Actions **self-hosted runner** (tagged `babypulmo`) that pulls, rebuilds, and smoke-tests. The classifier service is gated behind the `phase2` compose profile. See `deploy/DEPLOY-VPS.md`.
