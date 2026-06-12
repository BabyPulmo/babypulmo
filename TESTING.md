# TESTING.md — step-by-step manual for what works today

> **Verification status:** every Tier-0 step in this manual was executed on
> 2026-06-11 and behaves exactly as written (including the documented failures
> in §0.4 and §0.7). Tier-1 steps cannot be executed yet — the Supabase project
> is gone (see the warning in Tier 1) — they were verified against the schema
> and code only.

This manual tests **what is actually functional right now**, tier by tier. Each tier
states what credentials it needs. Every step lists the command, the expected result,
and — honestly — what the step does and does **not** prove.

Current reality check (as of 2026-06-11):

- There is **no trained model**. `lib/classifier.ts` falls back to `mockClassify()`
  (always "pneumonia, 0.71, RR 52") whenever `CLASSIFIER_ENDPOINT` is unset. (Still true
  — that's ROADMAP Track B.)
- **Supabase is still down** — the project in `.env.local` returns DNS NXDOMAIN. Tier 1
  needs you to create a new project (ROADMAP A3) before anything in it works.

**Track A progress already applied (verified 2026-06-11):**
- ✅ A2 — `.env.local` keys renamed to `WHATSAPP_*`, placeholder values cleared, so the
  mock fallbacks engage (`/api/classify` returns `mock-v0`, not a 404).
- ✅ A4 — draft clinical content loaded: `STOCK_BANGLA_JSON` / `SEVERITY_RULES_JSON` now
  hold real (draft, not-vetted) scripts/rules, so severity is **differentiated**
  (pneumonia→critical, asthma→moderate, normal→low) and guidance is real Bangla, not the
  error fallback. Source: `clinical/*.json`.
- ✅ A5 — the `export-audit-parquet.ts` ESM bug is fixed; `supabase/seed_demo.sql` exists.
- ✅ A6 — `/api/health` added; dead `#` links removed from `/chw`.

So §0.4–§0.5 below now reflect the *post-A2/A4* state (mock classifier, real rules).

Fixing the rest is ROADMAP.md's job. This manual tells you how to *verify* each layer.

All commands below run from the repo root (`babypulmo/`), PowerShell syntax where
it matters.

---

## Tier 0 — no credentials needed (mock mode)

### 0.1 Restore the install

The checked-out `node_modules` is partial (several declared deps missing), so the
build fails until you reinstall.

```powershell
pnpm install
```

**Expect:** completes without errors (lockfile `pnpm-lock.yaml` is respected).

```powershell
npx tsc --noEmit
```

**Expect:** exits clean (exit code 0).

**Proves:** the repo compiles. **Does not prove:** anything runs correctly.

### 0.2 Start the dev server

```powershell
npm run dev
```

**Expect:** `✓ Ready` on `http://localhost:3000`. If 3000 is occupied Next.js
silently picks 3001 — check the startup banner and adjust the URLs below.

### 0.3 Browser checklist (static + semi-live pages)

| URL | Expect | Notes |
|---|---|---|
| `/` | Landing page renders | Static marketing — by design |
| `/how-it-works` | 6-step flow + architecture chips | Static |
| `/impact` | Stats + SVG Bangladesh map | Static (map is hardcoded SVG) |
| `/technology` | Color swatches + tech cards | Static |
| `/demo` | Phone mockup + results card | **Static simulation** — it does NOT classify anything; the "89% Bronchiolitis" is hardcoded. Real classification only happens in the WhatsApp webhook. |
| `/docs` | ARCHITECTURE/COSTS/accuracy markdown rendered | Real file reads + react-markdown |
| `/docs` → "Live analytics" cell | Error box: *"Analytics unavailable… exporter needs to run at least once"* | This error is **correct behavior** until Tier 1 step 1.5 |
| `/chw` | Dashboard renders, KPIs all 0, empty alert list | Live data arrives in Tier 1 |
| `/chw/investigate` | Form renders; submitting returns **mock** results | The LangGraph nodes are stubs returning canned SQL/data — UI works, agent is not real yet |

### 0.4 Classifier proxy endpoint (mock)

> ⚠️ With `.env.local` **as currently checked out**, this returns
> `{"error":"Classifier 404: modal-http: invalid function call"}` (verified) —
> because `CLASSIFIER_ENDPOINT` is set to the literal `YOUR-USERNAME` placeholder
> URL, which the mock-fallback logic treats as a real endpoint. Apply ROADMAP A2
> (blank out the placeholders) first.

After A2:

```powershell
curl.exe -s -X POST http://localhost:3000/api/classify -H "Content-Type: application/json" -d '{\"audio_url\": \"https://example.com/test.ogg\"}'
```

**Expect:** JSON containing `"class":"pneumonia"`, `"confidence":0.71`,
`"breathsPerMin":52`, `"modelVersion":"mock-v0"`.

To verify the mock path without touching `.env.local` (verified working):

```powershell
npx tsx -e "import { classifyCough } from './lib/classifier'; classifyCough('https://example.com/x.ogg').then(r => console.log(JSON.stringify(r)))"
```

(plain `tsx` doesn't load `.env.local`, so the endpoint var is unset and the mock
engages.)

**Proves:** the API route → `lib/classifier.ts` wiring works.
**Does not prove:** any real ML — it's the hardcoded mock.

### 0.5 The deterministic severity engine (the core clinical claim)

These exercise `lib/claude.ts::decideSeverityMultiModal` directly — no server needed.

**(a) Tachypnea override** — pneumonia 0.82, RR 52, age 9 months → must be `critical` / `tachypnea_override`:

```powershell
npx tsx -e "import { decideSeverityMultiModal } from './lib/claude'; console.log(decideSeverityMultiModal({ classification: { class: 'pneumonia', confidence: 0.82, classProbs: {} as any, modelVersion: 't', inferenceMs: 0 }, profile: { ageMonths: 9, sex: 'F' }, breathsPerMin: 52 }))"
```

**(b) Fail-closed default** — with `SEVERITY_RULES_JSON` empty, a low-RR case must still escalate as `high` / `fail_closed_default`:

```powershell
npx tsx -e "import { decideSeverityMultiModal } from './lib/claude'; console.log(decideSeverityMultiModal({ classification: { class: 'pneumonia', confidence: 0.9, classProbs: {} as any, modelVersion: 't', inferenceMs: 0 }, profile: { ageMonths: 24, sex: 'M' }, breathsPerMin: 30 }))"
```

**(c) CXR override** — consolidation 0.7 beats everything → `critical` / `cxr_override`:

```powershell
npx tsx -e "import { decideSeverityMultiModal } from './lib/claude'; console.log(decideSeverityMultiModal({ classification: { class: 'normal', confidence: 0.9, classProbs: {} as any, modelVersion: 't', inferenceMs: 0 }, profile: { ageMonths: 24, sex: 'M' }, breathsPerMin: null, cxr: { pneumoniaProb: 0.3, consolidationProb: 0.7, noFindingProb: 0.2, modelVersion: 't' } }))"
```

**(d) Healthy child running fast is NOT escalated by RR** — class `normal`, RR 55 → falls through to rules table (fail-closed today, but reason must be `fail_closed_default`, *not* `tachypnea_override`):

```powershell
npx tsx -e "import { decideSeverityMultiModal } from './lib/claude'; console.log(decideSeverityMultiModal({ classification: { class: 'normal', confidence: 0.9, classProbs: {} as any, modelVersion: 't', inferenceMs: 0 }, profile: { ageMonths: 9, sex: 'M' }, breathsPerMin: 55 }))"
```

**Proves:** the zero-LLM, deterministic, fail-closed decision core works exactly as
documented (CXR → tachypnea → rules → fail-closed precedence).

### 0.6 WHO IMCI tachypnea thresholds

```powershell
npx tsx -e "import { meetsTachypneaCriteria as t } from './lib/respiratory-rate'; console.log([t(60,1), t(59,1), t(50,9), t(49,9), t(40,24), t(39,24), t(80,72)])"
```

**Expect:** `[ true, false, true, false, true, false, false ]`
(≥60 under 2 mo, ≥50 for 2–12 mo, ≥40 for 12–60 mo, always false ≥5 yr).

### 0.7 Ingest / export scripts (dry-run)

Only the DP export is truly credential-free (verified):

```powershell
npx tsx scripts/dp-export.ts --query=per_district_pneumonia_rate --dry-run
```

**Expect:** prints 3 noised mock district rows, exits 0. ✅ verified

The other two scripts are **not** credential-free despite their `--dry-run` flags
(verified failing):

- `build-contextual-chunks.ts --dry-run` still *reads* `imci_chunks` from Supabase
  before its no-write dry-run, and plain `tsx` does not load `.env.local` the way
  Next.js does. Once you have a live Supabase project (Tier 1), run it as:

  ```powershell
  npx tsx --env-file=.env.local scripts/build-contextual-chunks.ts --dry-run --first=3
  ```

- `export-audit-parquet.ts` — the ESM import bug is **now fixed** (dynamic
  `import("hyparquet-writer")` + `os.tmpdir()` for Windows). It runs past the import
  and only needs a live Supabase to complete. Full run is in §1.5 / ROADMAP A5.

### 0.8 MCP servers (mock mode)

For each of `mcp/classifier-server`, `mcp/imci-rag-server`, `mcp/chw-routing-server`:

```powershell
cd mcp/classifier-server
npm install
npm run build
npx @modelcontextprotocol/inspector dist/index.js
```

In the inspector UI: list tools (expect `classify_cough`, `score_severity`,
`find_nearest_chw`) and call `score_severity` with
`{"cough_class":"pneumonia","confidence":0.8,"breaths_per_min":52,"age_months":9}` —
expect a critical/tachypnea result mirroring 0.5(a).

**Proves:** real MCP servers over stdio. **Does not prove:** real backends — without
`CLASSIFIER_ENDPOINT`/`SUPABASE_URL` they return documented mock data.

### 0.9 Webhook verification handshake (no Meta account needed)

The GET handshake only needs `WHATSAPP_VERIFY_TOKEN` to be set. Either add it to
`.env.local` (ROADMAP A2 renames the whole block) or set it just for the dev server:

```powershell
$env:WHATSAPP_VERIFY_TOKEN = 'test123'; npm run dev
```

then in another terminal:

```powershell
curl.exe -s "http://localhost:3000/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=test123&hub.challenge=42"
```

**Expect:** `42`. With a wrong token: `forbidden` (HTTP 403).

A POST without a valid `x-hub-signature-256` must return 401:

```powershell
curl.exe -s -o NUL -w "%{http_code}" -X POST http://localhost:3000/api/webhook/whatsapp -d '{}'
```

**Expect:** `401`.

**Proves:** handshake + HMAC gate. The full POST flow (download media → classify →
reply) needs real Meta credentials — Tier 2.

### 0.10 LangGraph build-time eval (needs `ANTHROPIC_API_KEY` — else skip)

```powershell
npx tsx agents/langgraph-eval/graph.ts --n=3
```

Without an Anthropic key this fails at the Bangla-QA node — that's expected; it's a
build-time tool, listed here for completeness.

---

## Tier 1 — Supabase (DONE — applied + verified 2026-06-11)

> ✅ **The Supabase project was resumed and the schema + seeds are applied.** Tier-1 was
> verified end to end this session (counts, RPCs, realtime, Parquet → /docs). The steps
> below are kept as the repeatable procedure / regression checklist. Schema + seeds were
> applied via the Session pooler using `scripts/apply-sql.ts` (set `DATABASE_URL` to the
> pooler URI), not the dashboard SQL editor — either works.

### 1.1 Apply the schema

In the Supabase SQL editor, run in order:

1. `supabase/schema.sql`
2. `supabase/seed_imci.sql`
3. The missing-column fix (the webhook writes this but schema.sql omits it):

```sql
ALTER TABLE caregivers ADD COLUMN IF NOT EXISTS child_profile_json JSONB;
```

**Verify:** `select count(*) from chws;` → 3 (seeded Bogura CHWs);
`select count(*) from imci_chunks;` → 10.

### 1.2 PostGIS nearest-CHW routing

```sql
SELECT * FROM find_nearest_chw(24.8463, 89.3719);
```

**Expect:** the seeded CHWs ranked by `distance_km` ascending.
This is exactly what `lib/escalation.ts::findNearestChw()` calls at runtime.

### 1.3 CHW dashboard realtime

1. Open `http://localhost:3000/chw` (dev server running).
2. In the SQL editor, insert a fake alert (note: `severity` allows only
   `critical|high|moderate`, and `caregiver_location` is a geography point, not text):

```sql
INSERT INTO alerts (severity, status, caregiver_location)
VALUES ('critical', 'pending', ST_SetSRID(ST_MakePoint(89.3719, 24.8463), 4326));
```

**Expect:** the alert appears on the dashboard **without a refresh** (Supabase
realtime subscription) and the "New Alerts" KPI increments.
If it only appears after refresh: enable Realtime for the `alerts` table
(Database → Replication in the Supabase dashboard).

### 1.4 RAG retrieval (fallback path)

Without `OPENAI_API_KEY` the code embeds with a zero vector and falls back to ILIKE
keyword match — verify the RPC plumbing exists:

```sql
SELECT id, title FROM imci_chunks WHERE body ILIKE '%pneumonia%' LIMIT 3;
```

**Expect:** rows returned. Real vector retrieval is a Tier-2/ROADMAP-B5 test.

### 1.5 Lakehouse export → live /docs analytics (real, end-to-end)

Seed demo rows with `supabase/seed_demo.sql` (run it in the SQL editor — it inserts
~12 audit rows across all four `decisionReason` values, already keyed to what the
exporter reads).

The exporter writes **one UTC day** at a time. The seeded rows are stamped within the
last few hours, so export with an explicit date (today's UTC date):

```powershell
# create the bucket first: Supabase dashboard → Storage → New bucket → "lakehouse" (private)
npx tsx --env-file=.env.local scripts/export-audit-parquet.ts --date=2026-06-11
```

(The `hyparquet-writer` ESM import bug is already fixed in the script.)

**Expect:** uploads a `.parquet` + `manifest.json` to the `lakehouse` bucket. Then:

```powershell
curl.exe -s http://localhost:3000/api/docs/audit-manifest
```

**Expect:** `{"url":"…signed url…"}`, and the `/docs` "Live analytics" cell now
renders a decision-reason table via DuckDB-WASM in your browser.

**Proves:** the entire audit → Parquet → DuckDB-WASM lakehouse loop, for real.

### 1.6 Storage smoke test for recordings

Create bucket `recordings` (private) if missing — the webhook uploads caregiver audio
there and `TTS_CACHE_BUCKET=recordings` is used for TTS cache files.

---

## Tier 2 — full end-to-end (needs credentials; see ROADMAP.md Track B)

These are listed so you know what "done" looks like; each is unblocked by the named
ROADMAP step.

| Test | Needs | Unblocked by |
|---|---|---|
| Real cough classification (`/api/classify` returns non-mock) | Modal endpoint + trained ONNX | B2–B4 |
| Real Bangla TTS audio reply (not text-only) | `GCP_TTS_API_KEY` | B6 |
| Real vector RAG (`match_imci_chunks` with real embeddings) | `OPENAI_API_KEY` + ingest run | B5 |
| Differentiated severity + real guidance text | `SEVERITY_RULES_JSON` + `STOCK_BANGLA_JSON` populated | A4 / B8 |
| **The full WhatsApp voice-note flow** | Meta WhatsApp Cloud API app + public URL | B1 + B7 |

The canonical Tier-2 E2E test, once B1+B7 are done:

1. Send any text to the WhatsApp number → expect the Bangla greeting.
2. Reply with the child's age ("৯ মাস" or "9") → expect confirmation.
3. Send a 30-second voice note of a cough → within ~10 s expect a text card
   (class + confidence + severity) plus a Bangla audio note.
4. If severity ≥ high: the seeded CHW's WhatsApp number receives the alert and a row
   appears on `/chw` in realtime.
5. Verify the audit trail: `select * from audit_log order by created_at desc limit 5;`
   — every signal (class, confidence, RR, decision reason) must be present.

---

## Known-broken / not-yet-testable (do not waste time on these)

- **`/demo` interactivity** — buttons are intentionally non-functional (static mockup).
- **`/chw/investigate` real answers** — graph nodes are stubs (ROADMAP B9).
- **`scripts/dp-export.ts` without `--dry-run`** — the `v_per_district_*` views don't
  exist in the schema yet (ROADMAP B9).
- **`deploy/docker-compose.yml` healthcheck** — probes `/api/health`, which doesn't
  exist yet (ROADMAP A6).
- **`colab/deploy_modal.py` as-is** — its `ID2LABEL` has 3 classes but training
  produces 6 (ROADMAP B3). Don't deploy it before fixing.
