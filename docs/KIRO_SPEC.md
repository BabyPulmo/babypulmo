# Baby Pulmo — AWS Kiro Spec-Driven AI-DLC

Spec-driven AI-Native Development Lifecycle artifact in the AWS Kiro convention. Companion to `BMAD_PRD.md`.

> **AI-DLC frameworks claim:** Baby Pulmo adopts the AWS Kiro spec-driven AI-DLC for the system spec layer, BMAD-METHOD for the agile-development layer, AGENTS.md spec for the agent contract, Claude Skills + Cline Memory Bank + Cursor Rules adapted for plan-mode-first workflow. Multi-framework adoption is deliberate — each framework covers a different lifecycle phase.

---

## System Spec

### Goal
Reduce under-5 pediatric pneumonia mortality in rural Bangladesh by providing WhatsApp-native AI screening + Bangla audio guidance + mandatory CHW escalation on every severe case. Targeting the ResApp Health (Pfizer 2022) precedent at LMIC scale.

### Inputs
- Caregiver voice note (30 sec OGG, Meta WhatsApp Cloud API webhook).
- Caregiver text reply to onboarding Q&A (age, sex, fever, days of cough).
- (Phase 3) Caregiver chest X-ray photo from a backlit panel.
- (Phase 3) Caregiver voice reply transcribed via Whisper Bangla.

### Outputs
- Bangla audio guidance reply (≤ 10 sec end-to-end).
- WHO-IMCI-cited Bangla text card to caregiver.
- (On escalation) CHW alert with audio + GPS + severity + IMCI rationale.
- Immutable audit_log row for BMRC ethics review.

### Invariants (Kiro: "always true")
1. No LLM in the caregiver runtime path.
2. Every Bangla word the caregiver hears was vetted by a pediatrician.
3. WHO IMCI tachypnea criterion is a HARD escalation override.
4. CHW is always in the loop on `severity = critical` OR `severity = high`.
5. audit_log is append-only and contains every signal that fed the decision.
6. PII (name, phone, GPS) is encrypted or absent from audit_log.

### Decision Surfaces

| Decision | Owner | Mechanism |
|---|---|---|
| Cough class (6-way) | Wav2Vec2 fine-tune | ML inference, ONNX int8 |
| Respiratory rate | Signal processing | `lib/respiratory-rate.ts` envelope-peak |
| Severity | Deterministic table | `decideSeverityMultiModal()` |
| Recommended action | Deterministic table | `decideSeverityMultiModal()` |
| Bangla script | Lookup | `STOCK_BANGLA[class:severity]` |
| CHW assignment | PostGIS Haversine + load balance | `find_nearest_chw` |

---

## Kiro process notes

### Phases
1. **Spec** — this document + `BMAD_PRD.md` + `ARCHITECTURE.md`.
2. **Plan** — `~/.claude/plans/*.md` per-task implementation plans.
3. **Implement** — Claude Code multi-day plan-mode-first sessions.
4. **Validate** — automated tests + clinician review + BMRC ethics review.
5. **Observe** — `audit_log` + Grafana + Sentry.

### Artifacts
- Plans: `~/.claude/plans/`
- Memory: `~/.claude/projects/.../memory/`
- Specs: `babypulmo/docs/BMAD_PRD.md`, `babypulmo/docs/KIRO_SPEC.md`, `babypulmo/ARCHITECTURE.md`
- Decision log: `BabyPulmo/discussion` GitHub repo

### Review gates
- Pre-implementation: ExitPlanMode user approval.
- Code review: structured review skills (`/plan-eng-review`, `/plan-ceo-review`, `/plan-design-review`).
- Pre-deployment: smoke tests in `submission/accuracy.md` §verification.
- Pre-pilot: BMRC ethics review + Dr. Saadi clinical-script approval.
