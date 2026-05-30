# `agents/chw-investigate` — LangGraph orchestration for /chw/investigate

Read-only investigation agent powering the CHW investigation dashboard at `/chw/investigate`. CHWs type natural-language questions about the escalation queue ("show me Bogura pneumonia cases last week with confidence < 0.6") and the agent decomposes the question into a planned SQL query over `audit_log` + an IMCI RAG retrieval + a Bangla summary.

**v0 scaffold for prelim demo. Full read-only RLS enforcement + statement-timeout + Phase 2 production wiring in Q3 2026.**

## Pipeline

```
START → parse_question → plan_sql → run_sql → query_imci → summarize → END
```

## Clinical posture (critical)

- **Read-only at the database layer.** Supabase RLS denies INSERT / UPDATE / DELETE on every table from the agent's service-role.
- **Never writes a caregiver message.** The /chw/investigate page is a CHW workstation; outputs never reach the caregiver WhatsApp surface.
- **Never participates in a severity decision.** The deterministic `decideSeverityMultiModal()` remains the only path to a caregiver-facing severity outcome.

Caregiver-facing runtime continues to be deterministic, zero-LLM. See `babypulmo/ARCHITECTURE.md` §3 carve-out.

## Why LangGraph (and not just a single Claude call)

The investigation question decomposes into discrete steps with intermediate verifiable state: question → SQL plan → SQL result → IMCI retrieval → summary. LangGraph's typed StateGraph + channel reducers let us inspect each step in the audit trail, which matters for BMRC ethics review.

## Phase 2 production hardening

1. SQL planning becomes tool-use with a constrained schema (the agent picks columns and predicates from a typed catalogue, never writes raw SQL).
2. Statement timeout enforced (max 5 sec per SQL).
3. PII redaction layer between SQL result and summary.
4. Full audit trail to `audit_log` (every CHW question + agent reasoning step).
