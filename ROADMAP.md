# ROADMAP.md — from current state to fully functional

Two tracks. **Track A** makes the system demo-ready with zero new credentials
(everything runs on Supabase + mocks, but with *real* guidance flow and live
dashboards). **Track B** is the dependency-ordered path to a genuinely working v0,
including how to obtain every external account you don't have yet.

Companion doc: `TESTING.md` — run the matching test after each step.

---

## Track A — demo-critical (no new credentials, ~half a day)

> **Status (2026-06-11): Track A COMPLETE ✅** — A1·A2·A3·A4·A5·A6 all done and verified.
> Supabase resumed + schema/seeds applied via the Session pooler; Tier-1 verified end to
> end: 3 CHWs via `find_nearest_chw`, 10 IMCI chunks, `match_imci_chunks` RPC, realtime
> alert delivery (websocket test), and Parquet export → manifest → `/docs` analytics
> (decision_reason breakdown read back from the Parquet).
>
> Schema fixes made during A3 (now baked into `supabase/schema.sql`):
> 1. Dropped the ivfflat index on `imci_chunks.embedding` — pgvector caps ivfflat/hnsw at
>    2000 dims, but the column is `vector(3072)`. Seq scan for now; halfvec+hnsw noted for
>    production scale.
> 2. Added a GRANT block for `anon`/`authenticated`/`service_role` — tables created over a
>    pooled `postgres` connection don't inherit the API-role grants the dashboard adds, so
>    without it even the service-role key hit "permission denied".
> Also fixed: `export-audit-parquet.ts` now pins all-null columns to a type (hyparquet
> can't infer a type from an all-null column).
>
> **Interactive demo (Layer 1) built 2026-06-11:** `/demo` is no longer static — it
> records from the mic (`components/CoughRecorder.tsx`), measures the real respiratory
> rate in-browser (`lib/respiratory-rate.ts`), and runs the real pipeline via
> `app/api/demo-classify/route.ts` (severity + stock Bangla + audit + live CHW escalation).
> The disease class is a labeled simulation (`simulateClassification()`) until the model
> is trained; the moment `CLASSIFIER_ENDPOINT` is set, it uses the real model (label
> mapping handled — see B3). See `DEMO.md` beats 3–4.

### A1. Unbreak the build (~10 min)

```powershell
pnpm install
npx tsc --noEmit     # expect clean  (verified ✅)
npm run build        # see Windows caveat below
```

Why: the checked-in `node_modules` is partial — `@langchain/*`, `react-markdown`,
`remark-gfm`, `@duckdb/duckdb-wasm`, `@modelcontextprotocol/sdk`, `hyparquet-writer`
are declared but absent, so `next build` fails until reinstalled.

> **Windows caveat (verified 2026-06-11):** `npm run build` compiles, type-checks,
> lints, and statically generates all 15 routes successfully, then **fails only at the
> `output: "standalone"` packaging step** with `EPERM ... symlink` — Windows blocks
> symlink creation unless **Developer Mode** is on (Settings → Privacy & security →
> For developers → Developer Mode = On) or the shell runs as Administrator. This step
> is for the Docker deploy only (`deploy/Dockerfile.web`, builds on Linux) and does
> **not** affect `npm run dev`, which is the demo path. So: enable Developer Mode if
> you want a clean local `build`; otherwise ignore it for Track A.

### A2. Fix `.env.local` variable names (~5 min)

The file uses `META_WHATSAPP_*` but the code reads bare `WHATSAPP_*`
(`lib/whatsapp.ts:3-6`, webhook `route.ts:23`). `.env.example` explicitly warns
about this. Rename:

| Current (wrong) | Correct |
|---|---|
| `META_WHATSAPP_APP_SECRET` | `WHATSAPP_APP_SECRET` |
| `META_WHATSAPP_VERIFY_TOKEN` | `WHATSAPP_VERIFY_TOKEN` |
| `META_WHATSAPP_ACCESS_TOKEN` | `WHATSAPP_ACCESS_TOKEN` |
| `META_WHATSAPP_PHONE_NUMBER_ID` | `WHATSAPP_PHONE_NUMBER_ID` |
| `META_WHATSAPP_FROM` | (delete — nothing reads it) |

Also add `WHATSAPP_GRAPH_VERSION=v21.0`. While here, set `WHATSAPP_VERIFY_TOKEN`
to any random string you choose — you'll reuse it in the Meta console in B7.

**Also blank out every placeholder value.** The code's graceful fallbacks (mock
classifier, keyword RAG, text-only TTS) only engage when a var is **unset** — a
set-but-fake value produces a live error instead (verified: the placeholder
`CLASSIFIER_ENDPOINT` makes `/api/classify` return a Modal 404 rather than the
mock). Comment out or delete the values of: `CLASSIFIER_ENDPOINT`,
`CLASSIFIER_API_KEY`, `GCP_TTS_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
until you have real ones (B1).

**Acceptance:** TESTING.md §0.9 handshake test returns the challenge, and §0.4
returns the `mock-v0` classification.

### A3. Recreate and complete the database (~30 min)

> ⚠️ **The Supabase project referenced in `.env.local` no longer exists** — its URL
> returns DNS NXDOMAIN (verified 2026-06-11). You must create a fresh project.

0. https://supabase.com → **New project** → choose the **Singapore** region (the
   README's Bangladesh data-residency claim depends on it). Copy the new
   `Project URL`, `anon` key, and `service_role` key into `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`).

Then in the SQL editor:

1. Run `supabase/schema.sql` (fresh project, so it applies cleanly).
2. Run `supabase/seed_imci.sql`.
3. Add the column the webhook writes but the schema omits:

```sql
ALTER TABLE caregivers ADD COLUMN IF NOT EXISTS child_profile_json JSONB;
```

4. Create Storage buckets: `recordings` (private), `lakehouse` (private).
5. Enable Realtime on the `alerts` table (Database → Replication).

**Acceptance:** TESTING.md §1.1–1.3 all pass.

### A4. Author draft clinical content (~1–2 h, the highest-value demo step)

Today `STOCK_BANGLA_JSON={}` and `SEVERITY_RULES_JSON={}`, so every case escalates
as generic "high" and the caregiver hears the *error* message. Create two JSON files
(in the private `BabyPulmo/clinical-content` repo if you have it, else locally —
**do not commit to this public repo**, that's the trade-secret isolation design):

`severity-rules.json` — keyed by `CoughClass` (`lib/types.ts`), shape
`{ mustEscalate, severity, action }` per class (see `lib/claude.ts::Rule`):

```json
{
  "pneumonia":      { "mustEscalate": true,  "severity": "critical", "action": "see_chw_now" },
  "bronchiolitis":  { "mustEscalate": true,  "severity": "high",     "action": "see_doctor_24h" },
  "croup":          { "mustEscalate": true,  "severity": "high",     "action": "see_doctor_24h" },
  "asthma":         { "mustEscalate": false, "severity": "moderate", "action": "see_doctor_24h" },
  "pertussis":      { "mustEscalate": true,  "severity": "high",     "action": "see_doctor_24h" },
  "normal":         { "mustEscalate": false, "severity": "low",      "action": "normal" },
  "insufficient_quality": { "mustEscalate": false, "severity": "low", "action": "observe_24h" }
}
```

`stock-bangla.json` — keyed `"<class>:<severity>"` (see `lib/tts.ts::getStockBangla`),
one Bangla guidance script per tuple you expect to fire. Minimum set: the 7 tuples
your rules above can produce (e.g. `"pneumonia:critical"`, `"bronchiolitis:high"`,
`"normal:low"`, …) plus `"pneumonia:critical"`-style entries for the two override
paths (`critical` for any respiratory class, since tachypnea/CXR overrides force
`critical`).

> ⚠️ Mark every script `DRAFT — NOT CLINICIAN-VETTED` in your tracking. The BMRC
> ethics claim requires clinician review before any real caregiver use (B8).

Load them (PowerShell):

```powershell
# one-line JSON into .env.local
$sb = Get-Content clinical/stock-bangla.json -Raw | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 5
$sr = Get-Content clinical/severity-rules.json -Raw | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 5
```

…and paste into `.env.local` as `STOCK_BANGLA_JSON=…` / `SEVERITY_RULES_JSON=…`
(single line, no quotes needed in dotenv).

**Acceptance:** TESTING.md §0.5(b) now returns your rule (reason `audio_class`)
instead of `fail_closed_default`; `getStockBangla("pneumonia","critical")` returns
your script:

```powershell
npx tsx --env-file=.env.local -e "import { getStockBangla } from './lib/tts'; console.log(getStockBangla('pneumonia','critical'))"
```

(Same for re-running the TESTING.md §0.5 one-liners against your new rules — add
`--env-file=.env.local` so the env vars are actually loaded; plain `tsx` doesn't
read `.env.local`.)

### A5. Seed demo data + light the dashboards (~30 min)

0. **Fix the Parquet exporter first** — `scripts/export-audit-parquet.ts:18`
   crashes on `import { parquetWriteFile } from "hyparquet-writer"` because the
   package is ESM-only and the repo is CJS (`ERR_PACKAGE_PATH_NOT_EXPORTED`).
   Verified fix: load it dynamically inside `main()`:

   ```ts
   // delete line 18, then inside the function that writes the file:
   const { parquetWriteFile } = await import("hyparquet-writer");
   ```

1. Insert 5–10 varied `alerts` rows and ~20 `audit_log` rows (mix of
   `decision_reason` values) — see TESTING.md §1.3/§1.5 for statements.
2. Run `npx tsx --env-file=.env.local scripts/export-audit-parquet.ts`
   (plain `tsx` does not auto-load `.env.local`; Next.js does, but these scripts
   run outside Next).

**Acceptance:** `/chw` shows a populated dashboard with live updates; `/docs`
analytics cell renders a real decision-reason breakdown.

### A6. Demo polish (optional, ~1 h)

- Add `app/api/health/route.ts` returning `{ ok: true }` — the Docker healthcheck
  in `deploy/docker-compose.yml` probes it and currently can never pass.
- Add `public/favicon.ico` + an og-image (the `public/` dir is empty).
- Fix dead links on `/chw` ("View All Alerts" and "View Full Map" point to `#`).
- Decide the demo narrative honestly: with no trained model, every voice note
  classifies as "pneumonia 0.71" (mock). For the finals, demo the *architecture*
  (deterministic severity, escalation, audit, dashboards) and say the model is in
  training — that matches the repo's own honest-scoring policy.

---

## Track B — full functionality (dependency-ordered)

### B1. Obtain credentials (do these in parallel; all have free tiers)

**Meta WhatsApp Cloud API** (the hard one — start first):
1. https://developers.facebook.com → create a developer account → **Create App** →
   type "Business".
2. In the app dashboard, **Add product → WhatsApp**. You get a free **test phone
   number** and a temporary (24 h) access token immediately — enough for development.
3. Note three values: **Phone number ID** (WhatsApp → API Setup), **App secret**
   (App settings → Basic), and the **access token**.
4. For a token that doesn't expire daily: Business Settings → **System Users** →
   create one → generate token with `whatsapp_business_messaging` +
   `whatsapp_business_management` permissions.
5. Add your own phone as a recipient (test numbers can only message allow-listed
   recipients until the app is live).
6. Free tier: 1,000 service conversations/month — fine for the pilot.

**Modal** (classifier hosting): https://modal.com → sign up (GitHub login) →
`pip install modal` → `modal token new`. Free starter credits (~$30/mo) cover the
CPU classifier easily.

**Google Cloud TTS**: https://console.cloud.google.com → new project → enable
**Cloud Text-to-Speech API** → Credentials → **API key** (restrict it to TTS).
New accounts get $300 free credit; TTS has a permanent free monthly tier
(1 M WaveNet chars). Set `GCP_TTS_API_KEY`; keep `GCP_TTS_VOICE=bn-IN-Wavenet-A`.

**OpenAI**: https://platform.openai.com → API keys. Needed only for
`text-embedding-3-large` during ingest (~cents).

**Anthropic**: https://console.anthropic.com → API keys. Needed only for build-time
contextual-RAG prefixes and the eval graph (~$0.10 for the whole corpus).

**Cohere (optional)**: https://dashboard.cohere.com → trial key, for the
multilingual reranker. Without it `lib/rag.ts` uses the blended-score fallback.

### B2. Train the classifier (~2 h GPU, mostly unattended)

1. Open Google Colab, runtime → T4 GPU.
2. Upload `colab/train_wav2vec2.py`, run all. It downloads Coswara + COUGHVID +
   ICBHI, filters pediatric (≤5 yr), fine-tunes Wav2Vec2-XLSR-53 with SpecAugment,
   and exports **`babypulmo_wav2vec2_int8.onnx`**.
3. Download the ONNX file and the printed classification report.
4. Record honest per-class sensitivity in `submission/accuracy.md`
   (expected lab: 70–78% pneumonia sensitivity).

### B3. Reconcile the class-label spaces — **DONE (mapping-layer approach)**

The trained model emits 6 labels (`healthy, common_cold, bronchiolitis, pneumonia,
asthma, croup`); the runtime `CoughClass` uses `normal/pertussis`. Rather than rename the
runtime across 12 files (risky right before the demo), this was resolved with a **mapping
layer** (2026-06-11):

1. ✅ `colab/deploy_modal.py` — `ID2LABEL` fixed from 3 classes to the correct 6 matching
   `train_wav2vec2.py`.
2. ✅ `lib/classifier.ts` — added `MODEL_LABEL_MAP` + `toRuntimeClass()`/`remapProbs()`;
   `classifyCough()` now maps the model's labels to `CoughClass` (`healthy`+`common_cold`
   → `normal`; the four disease classes pass through 1:1). So a deployed model is
   plug-and-play with no further code changes.

Trade-off: `healthy` and `common_cold` collapse to `normal` (both low-severity → fine for
v0 triage). If you later want common-cold-specific guidance, promote it to a real
`CoughClass` and add `common_cold:*` keys to the clinical JSONs — but that's optional.

### B4. Deploy the classifier to Modal (~30 min)

```bash
pip install modal
modal token new
cp babypulmo_wav2vec2_int8.onnx colab/   # next to deploy_modal.py
modal deploy colab/deploy_modal.py
```

Set the printed URL as `CLASSIFIER_ENDPOINT` (+ `CLASSIFIER_API_KEY` if you add
auth) in `.env.local` / Vercel / GitHub Secrets.

**Acceptance:** TESTING.md §0.4 now returns a *non-mock* model version, and
different audio produces different classes.

### B5. Real RAG ingest (~30 min, ~$0.10)

With `OPENAI_API_KEY` + `ANTHROPIC_API_KEY` set:

```powershell
npx tsx --env-file=.env.local scripts/build-contextual-chunks.ts --first=10   # smoke
npx tsx --env-file=.env.local scripts/build-contextual-chunks.ts              # full corpus
```

Optional upgrades (in repo but unwired): call `match_imci_chunks_hybrid` from
`lib/rag.ts::retrieveImciHybrid` (the RPC exists in `seed_imci.sql:56` but nothing
invokes it) and set `COHERE_API_KEY` for reranking. For the full WHO IMCI corpus
(beyond the 10 seed chunks) finish `scripts/ingest_imci.ts` with the handbook PDF.

### B6. Real Bangla TTS (~15 min)

Set `GCP_TTS_API_KEY`. Then pre-warm the cache so first replies are instant
(`warmStockCache()` exists in `lib/tts.ts` but nothing calls it):

```powershell
npx tsx --env-file=.env.local -e "import { warmStockCache } from './lib/tts'; warmStockCache().then(() => console.log('warmed'))"
```

**Acceptance:** caregiver replies include an audio note; repeated texts hit the
content-hash cache (no second GCP call — check logs).

### B7. Wire up WhatsApp end-to-end (~1–2 h)

1. Expose the app on a public HTTPS URL:
   - quickest for dev: `cloudflared tunnel --url http://localhost:3000`
   - or deploy to Vercel: `vercel deploy` with all env vars set
   - or the VPS runbook: `deploy/DEPLOY-VPS.md`
2. Meta app dashboard → WhatsApp → **Configuration** → Webhook:
   - Callback URL: `https://<your-host>/api/webhook/whatsapp`
   - Verify token: the value you chose in A2
   - Subscribe to the **messages** field.
3. Meta performs the GET handshake (you already proved it in TESTING.md §0.9).
4. Optional for production messaging: `npx tsx scripts/submit-templates.ts`
   (needs `META_WHATSAPP_WABA_ID` — note this script *does* use the `META_` prefix).
5. Run the canonical Tier-2 E2E test (TESTING.md, Tier 2).

### B8. Clinical vetting (process, not code)

Replace the A4 draft scripts/rules with clinician-reviewed content
(Dr. Al Muktafi Saadi is listed as clinical advisor in `/docs`). Until this is done,
do not present the guidance as clinician-vetted — it's the central ethics claim.

### B9. Phase-3 backlog (optional, after v0 works)

In the repo's own declared order:

1. **CXR vision**: `modal deploy colab/cxr_vision_modal.py` → `CXR_ENDPOINT`.
   v0 uses adult-pretrained DenseNet121; pediatric fine-tune is a later milestone
   (`docs/CXR_README.md`).
2. **Whisper onboarding ASR**: `modal deploy colab/deploy_whisper_modal.py` →
   `WHISPER_ENDPOINT` (GPU — costs more; the text-age fallback works without it).
3. **CHW investigate agent**: replace the stub nodes in
   `agents/chw-investigate/graph.ts` (SQL planning/execution are canned) with a
   constrained, read-only, parameterized SQL tool + statement timeout + PII
   redaction, per the file's own TODO notes.
4. **DP export views**: create `v_per_district_pneumonia_rate`,
   `v_per_age_band_escalation_count`, `v_per_week_overall_volume` in Supabase so
   `scripts/dp-export.ts` works without `--dry-run`.
5. **Map on /chw**: wire Mapbox (`NEXT_PUBLIC_MAPBOX_TOKEN`) to replace the
   placeholder panel.
6. **Interactive /demo**: browser-side recording + call `/api/classify` for a real
   in-page demo (currently a static mockup).
7. **n8n workflows**: `deploy/n8n/docker-compose.yml` + import
   `brac-weekly-export.json`; the other two workflows (BMRC digest, SLA watcher)
   are documented but need building.
8. **Federated learning / mobile distillation**: scaffolds exist
   (`federated/`, `colab/distill_to_mobile.py`); both need real model + data
   integration — post-pilot work.

### B10. Production deployment

- **Vercel (fastest):** `vercel deploy`, set every var from `.env.example` in the
  project settings. Set up a cron for `scripts/export-audit-parquet.ts` (nightly).
- **VPS (the documented path):** follow `deploy/DEPLOY-VPS.md` end-to-end
  (Docker Compose + nginx + certbot + GitHub Actions self-hosted runner; secrets
  live in GitHub → regenerated into `.env.production`). Requires A6's `/api/health`
  for the healthcheck.

---

## Suggested order if the finals demo is tomorrow

1. A1 → A2 → A3 → A4 → A5 (half a day; system demos honestly with mock classifier).
2. B1 (Meta + Modal signups) and B2 (training, unattended) tonight in parallel.
3. B3 → B4 → B7 if time allows — a single real voice-note round-trip on stage beats
   every slide.
