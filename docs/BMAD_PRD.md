# Baby Pulmo — BMAD-METHOD PRD

Spec-driven AI-DLC artifact built per the BMAD-METHOD (Brian Madison Agile Development) convention. This PRD serves as the durable agent context anchor — every Claude Code session reads it before non-trivial work, the way BMAD agents read a sharded PRD.

> **AI-DLC frameworks claim:** This document, together with `KIRO_SPEC.md` and the AGENTS.md spec adopted in `.claude/`, constitutes Baby Pulmo's BMAD-METHOD adoption. Phase 2 production: sharded epics + Scrum-Master agent breakdown for the BRAC pilot delivery.

---

## 1 — Personas (Who is this for?)

### Persona A — Caregiver (primary)
- Mother in rural Bangladesh, 19–35 years old.
- Owns a low-end Android phone with WhatsApp.
- Has variable text literacy in Bangla; uniformly comfortable with voice messages.
- Faces a sick under-5 child with a cough; nearest clinic is ≥ 36 hrs away on average.
- Knows about WhatsApp but not about "AI" or "models."

### Persona B — Community Health Worker (CHW)
- Trained health worker registered with Bangladesh DGHS.
- Has a tablet + Baby Pulmo CHW app.
- Receives ranked escalations; investigates each in person.
- May lose connectivity during monsoon — Phase 2 CHW offline LLM (Ollama + Qwen2.5) for queue triage.

### Persona C — Clinical Advisor (pediatrician)
- Reviews the seven `(class, severity)` stock Bangla scripts.
- Approves Phase 1 BRAC pilot study protocol.
- Audit trail consumer for BMRC ethics review.

### Persona D — Partner (BRAC / DGHS / UNICEF)
- Receives weekly DP-noised aggregate exports (per-district statistics).
- Has operational dashboard access via the partner-API path.

---

## 2 — Success metrics

| Metric | v0 target | Phase 1 pilot target (12 mo) |
|---|---|---|
| Pediatric pneumonia sensitivity (lab) | ≥ 65% | ≥ 78% |
| Pediatric pneumonia sensitivity (field) | ≥ 58% | ≥ 68% |
| Time-to-care delta | n/a | −24 hr vs 36 hr baseline |
| CHW escalation precision | ≥ 60% | ≥ 75% |
| Cost per interaction (weighted avg) | < $0.005 | < $0.003 |
| BMRC ethics-review approval | submitted | approved |

See `submission/accuracy.md` for honest accuracy expectations and the architectural argument that 65% is enough.

---

## 3 — Sharded epics (BMAD-style)

### Epic 1 — Audio classification + multi-modal severity
Status: **Phase 0 shipped** (`colab/train_wav2vec2.py`, `lib/claude.ts::decideSeverityMultiModal`).

### Epic 2 — Knowledge retrieval
Status: **Phase 0 + Phase 1** (`lib/rag.ts` Contextual + Hybrid Search + Cohere reranker; `scripts/build-contextual-chunks.ts`).

### Epic 3 — MCP server primitives
Status: **Phase 1 shipped** (`mcp/classifier-server/`, `mcp/imci-rag-server/`, `mcp/chw-routing-server/`).

### Epic 4 — CHW investigation tooling
Status: **Phase 2 scaffold** (`agents/chw-investigate/`, `app/chw/investigate/page.tsx`, `chw-mobile/`).

### Epic 5 — Multi-modal vision
Status: **Phase 3 scaffold** (`colab/cxr_vision_modal.py`, `lib/cxr-vision.ts`).

### Epic 6 — Federated learning
Status: **Phase 3 scaffold** (`federated/flower-server.py`, `federated/hospital-client.py`).

### Epic 7 — Lakehouse + analytics
Status: **Phase 1 shipped** (`scripts/export-audit-parquet.ts`, `app/docs/sections/AuditAnalytics.tsx`).

### Epic 8 — Partner integrations
Status: **Phase 2 scaffold** (`deploy/n8n/`, MCP servers).

### Epic 9 — Differential privacy
Status: **Phase 3 scaffold** (`scripts/dp-export.ts`, `docs/DP_ANALYSIS.md`).

### Epic 10 — ASR Bangla onboarding
Status: **Phase 3 scaffold** (`colab/deploy_whisper_modal.py`, `lib/whisper.ts`).

---

## 4 — AI-DLC review gates

Every non-trivial change follows the plan-mode-first workflow:

1. **Explore phase** — Claude Code launches Explore subagents to read existing code.
2. **Plan phase** — Plan agent designs implementation, returns critical files + step-by-step plan.
3. **Review phase** — `claude.md` Skills (`/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`) apply structured review templates.
4. **ExitPlanMode** — user approves the plan written to `~/.claude/plans/`.
5. **Implement phase** — TaskCreate / TaskUpdate track per-file progress.
6. **Decision-log commit** — every architectural choice gets a commit in the BabyPulmo/discussion repo with the WHY.

This is the BMAD agent contract for this repo, adapted to Claude Code's plan-mode primitives.

---

## 5 — Out of scope (explicit holdouts)

- Runtime LLM in the caregiver path (deterministic clinical-decision-support posture).
- LLM-driven severity decisions (only the rules table writes severity).
- Diagnostic claims (we are a screening tool, not a medical device).
- Graph RAG (deferred to post-finals — see `submission/form-draft.md` holdouts).
