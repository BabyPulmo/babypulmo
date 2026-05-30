# CLAUDE.md — Baby Pulmo project context

Canonical context anchor for Claude Code sessions on this repo. Mirrored at `AGENTS.md` (cross-tool), `.cursorrules` (Cursor), `.clinerules` (Cline), and `memory-bank/` (Cline Memory Bank). Keep this file under 80 lines.

## Project

Baby Pulmo: WhatsApp-native AI for pediatric pneumonia screening in rural Bangladesh. Caregiver sends a 30-second cough voice note via WhatsApp → 6-class Wav2Vec2 classifier on Modal → multi-modal severity decision → Bangla audio reply from a clinician-vetted stock library → severe cases auto-escalate to nearest CHW via PostGIS routing. BuildFest 2026 submission; BRAC pilot scoped for Q3 2026.

## The single non-negotiable

**Zero LLM in the caregiver-facing runtime path.** Severity is deterministic (`lib/claude.ts::decideSeverityMultiModal`). Bangla audio is served from the clinician-vetted stock library (`lib/tts.ts::STOCK_BANGLA`), seven scripts, one per `(class, severity)` tuple. Never propose a runtime LLM call in the webhook → classifier → reply path. This is the BMRC ethics review claim and the entire pitch.

## Where LLMs ARE allowed (§3 carve-out in ARCHITECTURE.md)

1. Build-time (Claude Code, AI-DLC frameworks, LangGraph eval graph in `agents/langgraph-eval/`).
2. One-shot ingest (`scripts/build-contextual-chunks.ts` — Claude Haiku writes RAG context prefixes; OpenAI embeds; Whisper transcribes caregiver onboarding age in `lib/whisper.ts`).
3. CHW-side investigation tooling (`agents/chw-investigate/`, `app/chw/investigate/page.tsx`, `chw-mobile/` runs Qwen2.5-1.5B via Ollama).
4. Partner-system MCP exposure (`mcp/{classifier,imci-rag,chw-routing}-server/`).
5. Federated learning (`federated/flower-server.py`, `federated/hospital-client.py`).
6. Multi-modal vision (`lib/cxr-vision.ts` — discriminative DenseNet121, not an LLM).

Read `ARCHITECTURE.md` §3 before adding any AI dependency.

## Build / run commands

```bash
npm install
npm run dev               # Next.js dev server localhost:3000
npm run typecheck         # tsc --noEmit
npm run lint              # eslint
npx tsx scripts/build-contextual-chunks.ts --dry-run --first=3   # smoke-test ingest
npx tsx scripts/export-audit-parquet.ts                          # Lakehouse export
```

No test suite shipped yet (build-time eval lives in `agents/langgraph-eval/`).

## Repo map

- `app/` — Next.js App Router (webhook, CHW dashboard, `/docs` page).
- `lib/` — runtime utilities; single source of truth for severity (`claude.ts`), RR counter (`respiratory-rate.ts`), CXR client (`cxr-vision.ts`), Whisper client (`whisper.ts`), TTS stock library (`tts.ts`), RAG retrieval (`rag.ts`), WhatsApp client (`whatsapp.ts`).
- `mcp/` — 3 MCP servers (`classifier-server`, `imci-rag-server`, `chw-routing-server`).
- `agents/` — LangGraph graphs (`langgraph-eval` build-time, `chw-investigate` read-only RLS).
- `federated/` — Flower scaffold for partner-hospital fine-tuning.
- `chw-mobile/` — CHW Android offline (Ollama + Qwen2.5).
- `scripts/` — one-shot ingest, Lakehouse export, DP-noised aggregate export.
- `colab/` — training + Modal deploy notebooks.
- `docs/` — runbook companions (BMAD_PRD, KIRO_SPEC, CXR_README, DP_ANALYSIS, N8N_WORKFLOWS).
- `supabase/` — schema + RLS migrations.

## File-path discipline

Every claim in any doc, form field, or commit message must cite a file path. Before adding a claim, `grep` to confirm the artifact exists. No "we have X" without `path/to/x`.

## Honest scoring policy

No fabricated bonuses for BuildFest forms. If a feature isn't in the code, don't claim it in `submission/form-draft.md`. The five gemini-flagged "honest holdouts" remain: Graph RAG, Figma, 5th team member pending, plus anything truly not shipped.

## Read before non-trivial work

- `ARCHITECTURE.md` — 8-layer system + §3 carve-out.
- `docs/BMAD_PRD.md` — personas + epics + invariants.
- `docs/KIRO_SPEC.md` — system spec + Kiro invariants.
- `submission/accuracy.md` — what we'll honestly hit (70–78% v0, 58–68% field).
