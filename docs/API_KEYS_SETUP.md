# Baby Pulmo — API Keys Setup Guide

Step-by-step instructions for acquiring every secret referenced in `.env` and `.github/workflows/deploy.yml`. Set each one as a GitHub repo secret on `BabyPulmo/babypulmo`:

```bash
gh secret set <NAME> --repo BabyPulmo/babypulmo
# paste value, Ctrl-D
```

The deploy workflow renders these into `/opt/babypulmo/deploy/.env.production` on the VPS.

---

## 1. Supabase (DB + Storage + pgvector + PostGIS)

**Secrets:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`

1. Go to https://supabase.com → Sign in → Dashboard.
2. Open the `babypulmo` project (or `New Project` → name `babypulmo`, region closest to Bangladesh, choose strong DB password, save in 1Password).
3. Left sidebar → **Project Settings** (gear icon) → **API**.
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` *and* `SUPABASE_URL` (same value, both names exist for server-side imports).
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`. **Treat like root password — never expose to browser.**
5. Storage bucket: **Storage** → **New bucket** → name `recordings`, public OFF → confirms `TTS_CACHE_BUCKET=recordings`.
6. Storage bucket for audit: **New bucket** → name `audit-parquet`, public OFF → set `AUDIT_PARQUET_BUCKET=audit-parquet`.

---

## 2. Meta WhatsApp Cloud API

**Secrets:** `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_FROM`, `WHATSAPP_GRAPH_VERSION`

### One-time app setup

1. Go to https://developers.facebook.com → log in with the Baby Pulmo Facebook account.
2. **My Apps** → **Create App** → use case **Other** → type **Business** → name `Baby Pulmo`.
3. In the new app dashboard, **Add Product** → **WhatsApp** → **Set up**.
4. Link / create a Meta Business Account (Business Manager). If you don't have one: https://business.facebook.com → create one for Baby Pulmo.

### WHATSAPP_APP_SECRET

1. App dashboard → **App Settings → Basic**.
2. **App Secret** → click **Show** → copy.

### WHATSAPP_VERIFY_TOKEN

This is a **user-chosen string** you invent — Meta echoes it back during webhook handshake to prove the receiver is you.

```bash
openssl rand -hex 32   # use this output
```

Save it. You'll paste the same value into Meta's webhook config (step below).

### WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID

1. App dashboard → **WhatsApp → API Setup**.
2. Top panel shows a **test phone number** with:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
   - **Temporary access token** (24h) → `WHATSAPP_ACCESS_TOKEN`. **For prod, generate a permanent System User token** (see below).
3. **Permanent token (production):**
   - https://business.facebook.com → **Business Settings** → **System Users** → **Add** → name `babypulmo-server` → role **Admin**.
   - Click the system user → **Add Assets** → select your WhatsApp app + WhatsApp Business Account → grant **Full Control**.
   - **Generate New Token** → select your app → permissions `whatsapp_business_messaging`, `whatsapp_business_management` → **Never Expire** → copy.

### WHATSAPP_FROM

The **display phone number in E.164 format** (e.g. `+8801XXXXXXXXX`). Same number tied to `WHATSAPP_PHONE_NUMBER_ID`. Cosmetic only — used in outbound message logging.

### WHATSAPP_GRAPH_VERSION

Pin a Graph API version so Meta's deprecations don't silently break the webhook:

```
WHATSAPP_GRAPH_VERSION=v21.0
```

Check current: https://developers.facebook.com/docs/graph-api/changelog — bump when a version goes EOL.

### Webhook registration

1. App dashboard → **WhatsApp → Configuration**.
2. **Webhook URL** → `https://<your-vps-domain>/api/webhook/whatsapp`.
3. **Verify Token** → paste the same `WHATSAPP_VERIFY_TOKEN` string.
4. Subscribe to fields: `messages`.

---

## 3. Google Cloud Text-to-Speech

**Secrets:** `GCP_TTS_API_KEY`, `GCP_TTS_VOICE`

1. https://console.cloud.google.com → create project `babypulmo-prod` (or reuse existing).
2. **APIs & Services → Library** → search `Cloud Text-to-Speech API` → **Enable**.
3. Billing must be linked (free tier: 1M chars/month WaveNet).
4. **APIs & Services → Credentials → + Create Credentials → API Key**.
5. **Restrict key** (important):
   - **API restrictions** → restrict to `Cloud Text-to-Speech API`.
   - **Application restrictions** → IP restriction → VPS public IP.
6. Copy the key → `GCP_TTS_API_KEY`.
7. Voice: keep `GCP_TTS_VOICE=bn-IN-Wavenet-A` (clinician-vetted choice — see `lib/tts.ts`).

---

## 4. Modal (classifier, CXR, Whisper inference)

**Secrets:** `CLASSIFIER_ENDPOINT`, `CLASSIFIER_API_KEY`, `CXR_ENDPOINT`, `CXR_API_KEY`, `WHISPER_ENDPOINT`, `WHISPER_API_KEY`

Modal hosts the int8 ONNX classifier, DenseNet121 CXR model, and Whisper transcription.

### Account + CLI

1. https://modal.com → sign up with the Baby Pulmo account.
2. `pip install modal && modal token new` → completes browser auth.
3. **Settings → API Tokens** in the Modal dashboard if you need a fresh CI token.

### Deploy the classifier

```bash
cd babypulmo
modal deploy colab/deploy-modal-classifier.py    # see colab/ for the notebook source
```

After deploy, Modal prints something like:

```
✓ Deployed app 'babypulmo-classify' at https://yourusername--babypulmo-classify.modal.run
```

- That URL → `CLASSIFIER_ENDPOINT`.
- The auth: Modal generates a per-app secret when you set `@modal.web_endpoint(label="babypulmo-classify", custom_domains=...)` with `modal.Secret`. Check `modal secret list`, then `modal secret get babypulmo-classify-key` → `CLASSIFIER_API_KEY`.

Repeat for:

- CXR: `colab/deploy-modal-cxr.py` → `CXR_ENDPOINT` + `CXR_API_KEY`.
- Whisper: `colab/deploy-modal-whisper.py` → `WHISPER_ENDPOINT` + `WHISPER_API_KEY`.

---

## 5. OpenAI (one-shot ingest only, no runtime use)

**Secret:** `OPENAI_API_KEY`

Per `CLAUDE.md`: used **only** during IMCI ingest for `text-embedding-3-large`. Not in the caregiver runtime path.

1. https://platform.openai.com → Sign in → **API keys**.
2. **+ Create new secret key** → name `babypulmo-ingest` → permissions **Restricted** → embeddings: write.
3. Copy → `OPENAI_API_KEY` (only shown once).
4. **Settings → Limits** → set a hard monthly cap ($20 covers full IMCI ingest 5× over).

---

## 6. Anthropic (one-shot ingest only)

**Secret:** `ANTHROPIC_API_KEY`

Per `CLAUDE.md`: build-time only, for Claude Haiku contextual chunking in `scripts/build-contextual-chunks.ts`. **Zero runtime use.**

1. https://console.anthropic.com → Sign in.
2. **Settings → API Keys → Create Key** → name `babypulmo-ingest` → workspace `Baby Pulmo`.
3. Copy → `ANTHROPIC_API_KEY` (shown once).
4. **Plans & Billing** → buy credits; cap monthly spend.

---

## 7. Cohere (re-ranking during RAG retrieval)

**Secret:** `COHERE_API_KEY`

Used by `lib/rag.ts` for re-ranking IMCI chunk hits before CHW-side investigation surface (build-time + CHW path only, not caregiver runtime).

1. https://dashboard.cohere.com → Sign in → **API Keys**.
2. **Create Trial Key** (free, rate-limited) or **Production Key** (billed).
3. Name `babypulmo` → copy → `COHERE_API_KEY`.

---

## 8. Clinical content JSON blobs

**Secrets:** `STOCK_BANGLA_JSON`, `SEVERITY_RULES_JSON`

Already populated from `BabyPulmo/clinical-content` private repo. To refresh:

```bash
cd ../clinical-content
STOCK_BANGLA_JSON=$(jq -c . stock-bangla.json)
SEVERITY_RULES_JSON=$(jq -c . severity-rules.json)
gh secret set STOCK_BANGLA_JSON --repo BabyPulmo/babypulmo --body "$STOCK_BANGLA_JSON"
gh secret set SEVERITY_RULES_JSON --repo BabyPulmo/babypulmo --body "$SEVERITY_RULES_JSON"
```

These must be **compact JSON (no newlines)** — `jq -c` enforces that.

---

## Verification checklist

After setting every secret:

```bash
gh secret list --repo BabyPulmo/babypulmo
```

Should show all of:

- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] SUPABASE_URL
- [ ] WHATSAPP_APP_SECRET
- [ ] WHATSAPP_VERIFY_TOKEN
- [ ] WHATSAPP_ACCESS_TOKEN
- [ ] WHATSAPP_PHONE_NUMBER_ID
- [ ] WHATSAPP_FROM
- [ ] WHATSAPP_GRAPH_VERSION
- [ ] GCP_TTS_API_KEY
- [ ] GCP_TTS_VOICE
- [ ] TTS_CACHE_BUCKET
- [ ] CLASSIFIER_ENDPOINT
- [ ] CLASSIFIER_API_KEY
- [ ] OPENAI_API_KEY
- [ ] ANTHROPIC_API_KEY
- [ ] STOCK_BANGLA_JSON
- [ ] SEVERITY_RULES_JSON
- [ ] CXR_ENDPOINT
- [ ] CXR_API_KEY
- [ ] WHISPER_ENDPOINT
- [ ] WHISPER_API_KEY
- [ ] COHERE_API_KEY
- [ ] AUDIT_PARQUET_BUCKET

Then trigger a deploy:

```bash
gh workflow run deploy.yml --repo BabyPulmo/babypulmo
gh run watch --repo BabyPulmo/babypulmo
```

SSH into the VPS and confirm `.env.production` materialized:

```bash
sudo cat /opt/babypulmo/deploy/.env.production | grep -E '^[A-Z_]+=' | wc -l   # should be ≥24
```

End-to-end smoke test:

1. Send a 30s cough voice note from a test WhatsApp account to the production number.
2. Watch logs: `docker compose -f /opt/babypulmo/deploy/docker-compose.yml logs -f web`.
3. Expect: webhook hit → classifier call → severity decision → Bangla audio reply within 8s.

---

## Security hygiene

- Never paste real secrets into commit messages, PR descriptions, or Slack.
- Rotate `WHATSAPP_ACCESS_TOKEN` quarterly (System User can revoke + regenerate without downtime if you stage the swap).
- Rotate `SUPABASE_SERVICE_ROLE_KEY` only with a planned maintenance window — every running pod needs the new value.
- 1Password vault `babypulmo-prod` mirrors every secret as a tertiary backup (GitHub + VPS file + 1Password).
