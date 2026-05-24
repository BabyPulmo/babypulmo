# Baby Pulmo — Deployment Runbook

Step-by-step from a fresh machine to a working WhatsApp demo. Total time: ~6 hours active + ~2 hours Colab training (which runs unattended).

## Hour 0–1: Service accounts (do these in parallel)

| Service | URL | What to get |
|---|---|---|
| Vercel | vercel.com | account + install `npm i -g vercel` |
| Supabase | supabase.com | new project; copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Meta WhatsApp | developers.facebook.com | (1) Create a Business app → add WhatsApp product (2) note the test phone number ID → `WHATSAPP_PHONE_NUMBER_ID` (3) System User → permanent token → `WHATSAPP_ACCESS_TOKEN` (4) App Settings → Basic → App Secret → `WHATSAPP_APP_SECRET` (5) pick any random string → `WHATSAPP_VERIFY_TOKEN` |
| Google Cloud TTS | console.cloud.google.com | enable "Cloud Text-to-Speech API" → APIs & Services → Credentials → Create API key → restrict to Text-to-Speech → `GCP_TTS_API_KEY` |
| OpenAI | platform.openai.com | `OPENAI_API_KEY` (only for text-embedding-3-large during IMCI ingest) |
| Modal | modal.com | `pip install modal && modal token new` |
| Google Colab | colab.research.google.com | free; set runtime to T4 GPU |

## Hour 1–2: Supabase setup

1. In your new Supabase project → SQL Editor → New query → paste `supabase/schema.sql` → Run
2. New query → paste `supabase/seed_imci.sql` → Run
3. Storage → New bucket → name `recordings` → make it private. Get a signed URL TTL of 3600s.
4. (Optional) RLS check: the schema enables RLS with service-role bypass policies. For the demo, this is fine.

## Hour 2–4: Train the cough classifier (Colab, unattended)

1. Open `colab/train_wav2vec2.py` and copy each `# %%` cell into a new Colab notebook in order. Or:
   ```bash
   pip install jupytext
   jupytext --to ipynb colab/train_wav2vec2.py
   ```
   Upload the resulting `.ipynb` to Colab.
2. Runtime → Change runtime type → T4 GPU
3. Runtime → Run all
4. Wait ~2 hours. While it runs, do the next steps (which don't need the model).
5. When training finishes, download `babypulmo_wav2vec2.onnx` from Colab files.

## Hour 2–3: Deploy classifier to Modal (after training finishes)

```bash
cd babypulmo/colab
mv ~/Downloads/babypulmo_wav2vec2.onnx ./
pip install modal
modal token new   # one-time auth
modal deploy deploy_modal.py
```

Modal prints a URL like:
```
https://your-username--babypulmo-classify-endpoint.modal.run
```

Test it:
```bash
curl -X POST 'https://your-username--babypulmo-classify-endpoint.modal.run' \
  -H 'Content-Type: application/json' \
  -d '{"audio_url":"https://example.com/sample.wav"}'
```

## Hour 4–5: Configure + deploy Next.js to Vercel

```bash
cd babypulmo
cp .env.example .env.local
# Fill in all the keys you collected in Hour 0–1
```

Local test:
```bash
npm install
npm run dev
# Open http://localhost:3000
# Open http://localhost:3000/chw — CHW dashboard
```

Deploy:
```bash
vercel login
vercel
# Follow prompts; link/create the project
vercel env add NEXT_PUBLIC_SUPABASE_URL          # paste value
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add WHATSAPP_PHONE_NUMBER_ID
vercel env add WHATSAPP_ACCESS_TOKEN
vercel env add WHATSAPP_APP_SECRET
vercel env add WHATSAPP_VERIFY_TOKEN
vercel env add GCP_TTS_API_KEY
vercel env add CLASSIFIER_ENDPOINT
vercel env add OPENAI_API_KEY
vercel --prod
```

Note the production URL: `https://babypulmo.com`

## Hour 5: Wire Meta WhatsApp Cloud API

1. Meta App Dashboard → your app → WhatsApp → Configuration → Webhook
2. Callback URL: `https://babypulmo.com/api/webhook/whatsapp`
3. Verify Token: paste the same string you set as `WHATSAPP_VERIFY_TOKEN`
4. Click "Verify and Save" — Meta sends a GET to your endpoint with `hub.challenge`; the route handler echoes it back
5. Subscribe to the `messages` field
6. WhatsApp → API Setup → "To" number → add your personal phone as a recipient (test mode allows up to 5 testers; required before business verification)
7. From your personal WhatsApp, send any text to the displayed test number → expect the Bangla greeting back

## Hour 5–6: End-to-end test

Test 1 — greeting:
- Send any text to the WhatsApp number
- Expect Bangla greeting reply within 5 seconds

Test 2 — cough classification (mock):
- Even without the Modal classifier deployed, the system uses a mock that returns "pneumonia 71%". This lets you test the pipeline end-to-end before the real model is ready.
- Send a voice note of any sound
- Expect: Bangla audio reply + text card within 15 seconds
- Visit `/chw` dashboard — alert should appear (pneumonia is rules-gated severity=critical)

Test 3 — full classifier:
- Once Modal endpoint is live, set `CLASSIFIER_ENDPOINT` in Vercel
- Test with a real cough recording (use one from Coswara public data)
- Verify Grad-CAM heatmap renders in the response

## Hour 6+: Demo polish + video recording

- Record screen + face cam via Loom or OBS
- Follow the 3-minute script in `../EXECUTION_PLAN.md`
- Show: landing page → WhatsApp send → Bangla reply → CHW dashboard alert
- Upload to YouTube (unlisted) + Google Drive

## Hour 8–10: Finalize 1-page summary + submit

1. Open `submission/summary.md`
2. Replace `[your name]`, `[NRB advisor]`, `[demo URL]`, `[GitHub URL]` placeholders
3. Export to PDF (Pages, Google Docs, or `pandoc`):
   ```bash
   pandoc submission/summary.md -o submission/summary.pdf --pdf-engine=xelatex
   ```
4. Go to `cloudcampbd.com/the-infinity-ai-buildfest` and submit:
   - Video URL (YouTube unlisted link)
   - 1-page summary PDF upload
   - Demo URL (your Vercel link)
   - GitHub repo URL
5. Save the confirmation email

## Common gotchas

- **Webhook verification fails**: Meta sends a GET with `hub.verify_token` — it must match your `WHATSAPP_VERIFY_TOKEN` env var exactly. Vercel must be deployed before clicking Verify.
- **`401 invalid signature`**: `WHATSAPP_APP_SECRET` is wrong, or you're using the temporary token instead of the System User permanent token. Check Meta App Settings → Basic.
- **Meta media download 401**: `WHATSAPP_ACCESS_TOKEN` expired (temporary tokens last 24h). Generate a System User permanent token instead.
- **Bangla TTS sounds Indian-Bengali**: GCP only ships `bn-IN` (mutually intelligible). For Bangladesh-native pronunciation, swap to `bn-BD` via Coqui or Piper later.
- **TTS audio not playing in WhatsApp**: Meta requires the `audio.link` to be reachable from public internet via HTTPS. Supabase signed URLs satisfy this but the TTL must outlast Meta's fetch (1 hour is fine).
- **Modal cold start**: first request after idle can take 15-30 seconds on the int8 model. Webhook has a 60s `maxDuration`.
- **`crypto.randomUUID()` not defined**: Make sure you're on Node 18+ runtime in Vercel.
- **Pre-warm the TTS cache**: after deploy, hit `warmStockCache()` once (e.g. add a temporary `/api/warm` route or call from a Node script with the env vars). All 7 stock scripts get cached so the first user call is already a hit.

## Done = these all work

- [ ] You can send any text to the WhatsApp number and get a Bangla greeting back
- [ ] You can send a voice note and get a Bangla audio reply with classification card
- [ ] When severity is pneumonia/bronchiolitis/croup/pertussis, an alert appears on `/chw`
- [ ] CHW (mock) receives a WhatsApp message with audio attached
- [ ] Supabase `audit_log` table has rows for each interaction
- [ ] Vercel deploy is live at a public URL
- [ ] You have a 3-min video, a PDF summary, and you've submitted on the portal
