# ShishuKantho — Deployment Runbook

Step-by-step from a fresh machine to a working WhatsApp demo. Total time: ~6 hours active + ~2 hours Colab training (which runs unattended).

## Hour 0–1: Service accounts (do these in parallel)

| Service | URL | What to get |
|---|---|---|
| Vercel | vercel.com | account + install `npm i -g vercel` |
| Supabase | supabase.com | new project; copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Twilio | twilio.com | account + WhatsApp Sandbox (Console → Develop → Messaging → Try it out → WhatsApp); copy `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| Anthropic | console.anthropic.com | `ANTHROPIC_API_KEY` |
| ElevenLabs | elevenlabs.io | `ELEVENLABS_API_KEY` + create/find a Bangla-capable voice → `ELEVENLABS_BANGLA_VOICE_ID` (use a multilingual v2 voice) |
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
5. When training finishes, download `shishukantho_wav2vec2.onnx` from Colab files.

## Hour 2–3: Deploy classifier to Modal (after training finishes)

```bash
cd shishukantho/colab
mv ~/Downloads/shishukantho_wav2vec2.onnx ./
pip install modal
modal token new   # one-time auth
modal deploy deploy_modal.py
```

Modal prints a URL like:
```
https://your-username--shishukantho-classify-endpoint.modal.run
```

Test it:
```bash
curl -X POST 'https://your-username--shishukantho-classify-endpoint.modal.run' \
  -H 'Content-Type: application/json' \
  -d '{"audio_url":"https://example.com/sample.wav"}'
```

## Hour 4–5: Configure + deploy Next.js to Vercel

```bash
cd shishukantho
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
vercel env add ANTHROPIC_API_KEY
vercel env add TWILIO_ACCOUNT_SID
vercel env add TWILIO_AUTH_TOKEN
vercel env add TWILIO_WHATSAPP_FROM
vercel env add ELEVENLABS_API_KEY
vercel env add ELEVENLABS_BANGLA_VOICE_ID
vercel env add CLASSIFIER_ENDPOINT
vercel env add OPENAI_API_KEY
vercel --prod
```

Note the production URL: `https://your-project.vercel.app`

## Hour 5: Wire Twilio WhatsApp Sandbox

1. Twilio Console → Develop → Messaging → Try it out → Send a WhatsApp message
2. Note the sandbox WhatsApp number (usually `+1 415 523 8886`) and the join code (`join your-keyword`)
3. Sandbox configuration tab → WHEN A MESSAGE COMES IN → set to:
   ```
   https://your-project.vercel.app/api/webhook/whatsapp
   ```
   HTTP POST
4. Send `join your-keyword` from your personal WhatsApp to the sandbox number to enrol
5. Send any text → you should get the Bangla greeting back

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

- **Bangla TTS broken**: Try a different ElevenLabs voice — not all multilingual v2 voices speak Bangla equally well. Test with one sentence first.
- **Twilio sandbox media access**: Twilio media URLs require HTTP Basic Auth with your Account SID + Auth Token. The webhook does this; if you hit 401 in logs, double-check those env vars are correct.
- **Supabase CORS for storage**: signed URLs work for downloading; if you can't play the audio in WhatsApp, check the bucket is public-read or signed URL TTL is long enough.
- **Modal cold start**: first request after idle can take 30+ seconds. The webhook has a 60s `maxDuration` to accommodate.
- **`crypto.randomUUID()` not defined**: Make sure you're on Node 18+ runtime in Vercel.

## Done = these all work

- [ ] You can send any text to the WhatsApp number and get a Bangla greeting back
- [ ] You can send a voice note and get a Bangla audio reply with classification card
- [ ] When severity is pneumonia/bronchiolitis/croup/pertussis, an alert appears on `/chw`
- [ ] CHW (mock) receives a WhatsApp message with audio attached
- [ ] Supabase `audit_log` table has rows for each interaction
- [ ] Vercel deploy is live at a public URL
- [ ] You have a 3-min video, a PDF summary, and you've submitted on the portal
