# DEMO.md — Baby Pulmo demo runbook (BuildFest finals)

A ~3-minute, click-by-click walkthrough for judges. Story-first, with the **live**
CHW dashboard and **live** analytics as the proof points. Honest framing throughout —
the architecture is real; the model is still in training.

> **The one rule:** never present the disease **classification** as a trained model —
> it's simulated until the Wav2Vec2 model is trained (the `/demo` page shows an amber
> "simulated" badge). Everything else is genuinely live and you should say so: real
> in-browser cough recording, real breathing-rate measurement, the deterministic severity
> engine, PostGIS routing, the realtime CHW dashboard, and the audit→Parquet→DuckDB
> analytics. Lead with those; be candid about the one simulated piece.

---

## Pre-flight (do this 5 minutes before you present)

1. **Start the app** (from `babypulmo/`):
   ```powershell
   npm run dev
   ```
   Watch the banner for the port. It uses **http://localhost:3000**, but if 3000 is
   busy it silently picks **3001** — note which, and use it everywhere below.

2. **Confirm Supabase is awake.** Open **/chw** — if you see 5 alerts, the database is
   live. (Free-tier projects re-pause after ~1 week idle. If the page is empty or
   errors, see Troubleshooting → "Supabase re-paused".)

3. **Open these browser tabs, left to right, in this order** (so you just press Ctrl+Tab
   to advance):
   1. `http://localhost:3000/`
   2. `http://localhost:3000/how-it-works`
   3. `http://localhost:3000/demo`
   4. `http://localhost:3000/chw`
   5. `http://localhost:3000/docs`

4. **Grant microphone permission now** (Beat 3 records live). On the `/demo` tab, tap the
   blue record button once, allow the browser's mic prompt, then stop — so there's no
   permission popup mid-demo. Use **Chrome or Edge** (best `MediaRecorder` + audio decode
   support); localhost is a secure context so mic works without HTTPS.

5. **Browser zoom ~110%** (Ctrl++) so the back row can read it. Full-screen (F11).

6. **Have one terminal ready** in `babypulmo/` for the Beat-4 fallback/encore. Pre-type
   this command but don't press Enter yet:
   ```powershell
   npx tsx --env-file=.env.local scripts/demo-trigger-alert.ts
   ```

6. **Optional reset** — if you rehearsed and the board looks messy, restore the seed data:
   ```powershell
   $env:DATABASE_URL="<your session-pooler URI>"; npx tsx scripts/apply-sql.ts supabase/seed_demo.sql
   ```

---

## The 3-minute script

Each beat: **WHERE** you are · **DO** (what to click) · **SEE** (what renders) ·
**SAY** (narration) · **HONESTY** (only where it matters).

### Beat 1 — The problem & the product · Tab 1 `/` · ~25s
- **DO:** Start on the landing page. Don't click yet.
- **SEE:** "Baby Pulmo — AI Pediatric Diagnostic for Rural Bangladesh", the four trust
  tiles (WHO guided · Bangladesh focused · Bangla Voice Support · AI Explainability).
- **SAY:** "In rural Bangladesh, pneumonia is a leading killer of under-fives, and most
  families are hours from a clinic. Baby Pulmo lets a caregiver send a 30-second cough
  voice note over WhatsApp — the phone they already have — and get back Bangla guidance
  in seconds, with severe cases routed to the nearest health worker."
- **DO:** Click **"Learn How It Works →"** (advances to Tab 2 / `/how-it-works`).

### Beat 2 — How it works · Tab 2 `/how-it-works` · ~30s
- **SEE:** The 6-step pipeline (Record Cough → Audio Preprocessing → AI Respiratory
  Analysis → Severity Detection → Medical Knowledge Retrieval → Guidance & Referral) and
  the architecture chips.
- **SAY:** "Six stages. The cough is denoised and quality-checked, a Wav2Vec2 model
  classifies it into six pediatric conditions, we retrieve the matching WHO IMCI protocol,
  and a **deterministic rules engine** — not an LLM — decides severity and picks a
  clinician-vetted Bangla script. If it's severe, it escalates to a health worker."
- **SAY (the hook):** "The key design choice: **zero LLM in the caregiver path.** Every
  word a parent hears was written by a clinician. I'll show you where the AI actually
  lives in a moment."
- **DO:** Switch to Tab 3 (`/demo`).

### Beat 3 — Record a real cough (LIVE) · Tab 3 `/demo` · ~50s
This page is now interactive — it records from the mic, measures the **real** breathing
rate from your audio, and runs the **real** decision engine.
- **DO:** (Optional) set the **Age** slider to ~**9 months** and tick **Fever** — this
  lowers the tachypnea threshold so a vigorous cough is more likely to escalate.
- **DO:** Tap the blue **record** button (grant mic permission in pre-flight!), cough
  into the laptop a few times for ~15 seconds, then tap the red **stop** button.
- **SEE:** After a second: a classification, a confidence donut, the **measured breathing
  rate** ("measured from your recording"), a color-coded **severity** with the reason
  (e.g. "Fast-breathing (tachypnea) override"), the **Bangla guidance** text, and — if
  severe — a red "escalated to CHW" banner.
- **SAY:** "I just recorded a real cough. The system measured the breathing rate directly
  from that audio — that's the WHO IMCI clinical signal — fed it into a deterministic
  decision engine, and returned Bangla guidance. No LLM touched that decision."
- **HONESTY (say it plainly, pointing at the amber badge):** "One honest note: the disease
  classifier itself is **simulated** here — the model is in training. But everything else
  is real: the breathing-rate measurement, the decision logic, the guidance, the audit
  trail, and the escalation you're about to see."
- **DO:** If the result shows the red "escalated" banner, say "watch — this just went to the
  health worker" and switch to Tab 4. (If it didn't escalate, just switch to Tab 4 and use
  the trigger in Beat 4.)

### Beat 4 — It's already on the health worker's screen · Tab 4 `/chw` · ~40s
- **SEE:** The CHW dashboard — KPI tiles and the live alert list. **If your Beat-3
  recording was severe, the alert from it is already here** (top of the list, just arrived).
- **SAY:** "And there it is — the case I just recorded, on the health worker's dashboard in
  real time, routed by PostGIS to the nearest available worker. No refresh, no polling."
- **Fallback / encore (guaranteed live pop):** if Beat 3 didn't escalate, or to show it
  arrive live, Alt-Tab to your terminal, press Enter on the pre-typed command, Alt-Tab back:
  ```powershell
  npx tsx --env-file=.env.local scripts/demo-trigger-alert.ts
  ```
  A new **CRITICAL** alert appears at the top without a refresh and "New Alerts" ticks up.
- **DO:** Switch to Tab 5 (`/docs`).

### Beat 5 — Responsible AI + live analytics · Tab 5 `/docs` · ~35s
- **SEE:** The docs page (Architecture, Accuracy, Costs sections) and, lower down, the
  **"Live analytics"** cell with a table of decision reasons and counts.
- **DO:** Scroll to the "Live analytics" cell.
- **SAY:** "Every interaction is written to an immutable audit log — required for the
  ethics review. This analytics panel runs entirely in your browser via DuckDB-WASM,
  reading the exported audit data: you can see the breakdown of *why* each case was
  escalated — tachypnea override, chest-X-ray override, audio class, or fail-closed
  default. Full transparency, zero server cost."
- **SAY (close):** "So: a WhatsApp-native screening tool, a deterministic and auditable
  decision core with no LLM in front of caregivers, and live escalation to health workers
  — built to be deployed on the infrastructure rural Bangladesh already has."

**After the demo:** reset the board for the next run:
```powershell
npx tsx --env-file=.env.local scripts/demo-trigger-alert.ts --cleanup
```

---

## Optional add-on segments (expand to ~5 min if judges engage)

### A. CHW investigation tool — the LLM carve-out · `/chw/investigate`
- **DO:** Navigate to `http://localhost:3000/chw/investigate`. The question box is
  pre-filled. Click **Investigate**.
- **SEE:** A planned SQL query, a matching case (pneumonia, confidence 0.42, 53 bpm,
  Bogura), the relevant WHO IMCI rule, and a summary.
- **SAY:** "This is where an LLM *is* allowed — a read-only tool that lets a health worker
  ask questions of the data in plain language. It can never send a caregiver message or
  change a decision; that's enforced at the database layer."
- **HONESTY:** "This one's a scaffold — the query plan and structure are real, the data is
  sample. Wiring the live agent is on the roadmap."

### B. Technology & impact · `/technology`, `/impact`
- Quick visual tour: the model/data stack and the impact framing + coverage map.

### C. Terminal proofs (for technical judges)
Run these live to back up the architecture claims:
- **Deterministic severity engine** (no LLM, fail-closed). Show the override precedence:
  ```powershell
  npx tsx --env-file=.env.local -e "import { decideSeverityMultiModal } from './lib/claude'; console.log(decideSeverityMultiModal({ classification:{class:'pneumonia',confidence:0.82,classProbs:{} as any,modelVersion:'t',inferenceMs:0}, profile:{ageMonths:9,sex:'F'}, breathsPerMin:52 }))"
  ```
  → `severity: 'critical', reason: 'tachypnea_override'` — pure rules, same input always
  gives the same output.
- **Partner-facing MCP server** (the classifier exposed as Model Context Protocol tools):
  ```powershell
  cd mcp/classifier-server; npm run build; npx @modelcontextprotocol/inspector dist/index.js
  ```
  → list tools, call `score_severity` → mirrors the same deterministic engine.
- For the full menu of runnable proofs, see `TESTING.md` (Tier 0).

---

## Q&A cheat-sheet (honest answers to the likely questions)

- **"Is the model real / trained?"** — "Not yet. The full training pipeline is written and
  runs on a Colab GPU (`colab/train_wav2vec2.py`); today the endpoint returns a mock so we
  can demo the whole system. Everything *around* the model — the deterministic decision
  core, escalation, audit, dashboards — is real and running."
- **"Where's the LLM, then?"** — "Never in front of caregivers. LLMs are used at build time,
  for one-shot knowledge ingestion, and in the read-only CHW investigation tool. The
  caregiver path is a deterministic rules table plus clinician-vetted Bangla scripts — by
  design, for the ethics review (`ARCHITECTURE.md` §3)."
- **"How accurate will it be?"** — "We're honest about this: it's a triage filter, not a
  diagnostic device. Realistic targets are ~70–78% pneumonia sensitivity in the lab,
  degrading to ~58–68% on real rural phones. False positives go to a health worker for
  review; false negatives get a 24-hour 're-send if worse' window. The legal posture is
  decision-support, like ResApp Health (acquired by Pfizer)."
- **"Is this deployed?"** — "It runs on Vercel-class infra + Supabase + Modal. Today's demo
  is local; the deploy runbook and CI are in the repo (`deploy/`, `DEPLOY.md`)."
- **"What's left?"** — "Train and deploy the classifier, connect the live WhatsApp number,
  real Bangla TTS, and clinician sign-off on the scripts. It's the dependency-ordered
  'Track B' in `ROADMAP.md`."

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Dev server on **3001** not 3000 | 3000 was busy; use 3001 in all URLs. |
| **/chw empty or errors** (Supabase re-paused) | Resume the project in the Supabase dashboard, wait ~3 min, then re-apply seeds: `$env:DATABASE_URL="<session-pooler URI>"; npx tsx scripts/apply-sql.ts supabase/schema.sql supabase/seed_imci.sql supabase/seed_demo.sql` |
| **Realtime alert didn't pop** | The dashboard reconnects on load — refresh `/chw` once, then fire the trigger again. (There's a brief window after subscribe before it listens.) |
| **Live analytics cell blank / "unavailable"** | Re-run the exporter: `npx tsx --env-file=.env.local scripts/export-audit-parquet.ts --date=<today UTC, YYYY-MM-DD>` |
| **Board looks messy after rehearsal** | `npx tsx --env-file=.env.local scripts/demo-trigger-alert.ts --cleanup`, and/or re-apply `seed_demo.sql`. |
| Want to demo from a phone/projector cleanly | Deploy to Vercel (`ROADMAP.md` B10) and use the public URL instead of localhost. |

---

## One-line cheat sheet (tape to your laptop)

`/` story → `/how-it-works` pipeline → `/demo` **record a real cough** (say: class is
simulated, breathing-rate + decision are real) → `/chw` your severe case is already there
(or fire trigger) → `/docs` scroll to live analytics → close on "zero LLM in the caregiver
path." Reset: `demo-trigger-alert.ts --cleanup`.
