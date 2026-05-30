# `agents/langgraph-eval` — Build-time synthetic eval generator

LangGraph StateGraph that generates synthetic regression test cases for the multi-modal severity decision logic.

**Build-time only. Zero runtime involvement.** The caregiver-facing system remains deterministic + clinician-vetted stock script (see `babypulmo/ARCHITECTURE.md` §3 carve-out).

## Pipeline

```
START → sample_case → generate_bangla_qa → simulate_audio_class → score → END
```

- **sample_case** — sample a (age, expected_class, expected_severity) tuple biased toward safety-critical buckets (pneumonia / bronchiolitis).
- **generate_bangla_qa** — Claude Haiku writes a realistic Bangla caregiver Q&A pair.
- **simulate_audio_class** — inject noise around the ground-truth class to exercise both the audio-class rule and the WHO IMCI tachypnea override.
- **score** — (stub) assert `decideSeverityMultiModal()` matches expected_severity.

## Run

```bash
npx tsx agents/langgraph-eval/graph.ts --n=20 > test-cases.jsonl
```

Each output line is a JSON object with `{ageMonths, expectedClass, expectedSeverity, banglaQaPair, syntheticInput, score}`.

## Why LangGraph

Two reasons:
1. **Graph-shaped state** matches the test-case generation pipeline (each node depends on the prior node's output). LangGraph's typed StateGraph + channel reducers make this clean.
2. **Reusable across other build-time tasks** — we plan to add a second graph for synthetic CHW investigation queries (Phase 2F roadmap).

## What this is NOT

- ❌ Not in the caregiver runtime path.
- ❌ Not used to generate the clinician-vetted stock Bangla scripts (those are written by Dr. Saadi).
- ❌ Not a replacement for held-out test sets (Coswara + COUGHVID + ICBHI splits remain the primary evaluation).

The agent runs purely as a developer productivity tool for regression coverage.
