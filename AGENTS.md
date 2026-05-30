# AGENTS.md — Baby Pulmo

Cross-tool agent spec (Codex, Cursor, Continue, generic AGENTS.md consumers). For the full project context anchor, see `CLAUDE.md`.

## Project

WhatsApp-native AI for pediatric pneumonia screening in rural Bangladesh. Caregiver cough voice note → Wav2Vec2 6-class classifier on Modal → deterministic multi-modal severity → Bangla audio reply from clinician-vetted stock library → severe cases escalate to CHW via PostGIS routing.

## Setup

```bash
npm install
cp .env.example .env.local   # fill secrets per .env.example header comments
```

## Build / test commands

```bash
npm run dev          # Next.js dev server on :3000
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # production build
```

**No runtime test suite shipped yet.** Build-time eval is in `agents/langgraph-eval/`. Don't add unit tests speculatively; add them when actual bugs surface.

## Code style

- TypeScript strict, no `any`.
- Server-side: Next.js App Router route handlers in `app/api/`.
- Audio + WhatsApp helpers live in `lib/` — prefer reusing `lib/whatsapp.ts`, `lib/rag.ts`, `lib/respiratory-rate.ts`, `lib/cxr-vision.ts`, `lib/whisper.ts`, `lib/claude.ts::decideSeverityMultiModal`, `lib/tts.ts::STOCK_BANGLA` over reimplementing.
- Tailwind for styling; no other CSS solutions.
- No backwards-compatibility shims for code that isn't yet released.

## Non-negotiable

**No LLM in the caregiver-facing runtime path.** Severity is the deterministic function `decideSeverityMultiModal()` in `lib/claude.ts`. Bangla audio is from the clinician-vetted stock library in `lib/tts.ts`. Never propose runtime LLM generation for caregiver replies. See `ARCHITECTURE.md` §3 for the carve-out describing where LLMs ARE allowed (build-time, one-shot ingest, CHW-side, partner MCP, federated, CXR vision).

## File-path discipline

Every claim cites a file path. Before claiming a feature exists, `grep` to confirm.

## Pointers

- `CLAUDE.md` — full project context, build commands, repo map.
- `ARCHITECTURE.md` — 8-layer system map + §3 carve-out.
- `docs/BMAD_PRD.md` + `docs/KIRO_SPEC.md` — spec-driven AI-DLC artifacts.
- `memory-bank/` — Cline Memory Bank pattern (6 files).
