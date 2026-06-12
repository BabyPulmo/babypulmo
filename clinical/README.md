# clinical/ — DRAFT clinical content (NOT clinician-vetted)

> ⚠️ **These files are AI-drafted placeholders for demo wiring only.** They are **not**
> reviewed by a clinician and must **not** be presented to real caregivers. Replacing
> them with clinician-vetted content is ROADMAP step **B8** — the BMRC ethics claim
> depends on it.

Two files, matching the production loaders:

- `severity-rules.json` — keyed by `CoughClass` (`lib/types.ts`), value
  `{ mustEscalate, severity, action }` (`lib/claude.ts::Rule`). Consumed by
  `SEVERITY_RULES_JSON`.
- `stock-bangla.json` — keyed `"<class>:<severity>"` (`lib/tts.ts::getStockBangla`),
  value = the Bangla guidance script. Consumed by `STOCK_BANGLA_JSON`.

In production these live in the private `BabyPulmo/clinical-content` repo and are loaded
into env vars (never committed to the public repo — trade-secret isolation). For local
demo, load them into `.env.local`:

```powershell
$sr = Get-Content clinical/severity-rules.json -Raw | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 6
$sb = Get-Content clinical/stock-bangla.json   -Raw | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 6
# paste $sr after SEVERITY_RULES_JSON= and $sb after STOCK_BANGLA_JSON= in .env.local
```
