# Active context — last updated 2026-05-30

## What's in flight RIGHT NOW

**Competition submissions** — the contest-neutral project profile lives in `../submissions/PROJECT-PROFILE.md`; each active competition has its own folder under `../submissions/`.

## What just shipped

- **Phase 1 + 2 + 3 scaffolds** (18 items) across `mcp/`, `agents/`, `federated/`, `chw-mobile/`, `scripts/`, `app/docs/`, `lib/{cxr-vision,whisper,respiratory-rate}.ts`. See `progress.md` for the breakdown.
- **Docs sweep** — `README.md`, `DEPLOY.md`, `COSTS.md`, `colab/README.md`, `app/page.tsx`, `ARCHITECTURE.md`, `outreach/clinical-advisor-package.md`, `.env.example` all brought current with shipped code.
- **Submission form drafts** now live per competition under `../submissions/<competition>/`; the contest-neutral source is `../submissions/PROJECT-PROFILE.md`.
- **Context files added** — `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.clinerules`, this `memory-bank/` (you're reading it).

## What's blocking submission

- **YouTube video** — team-owned (Shanta recording it). Form blocker.
- **5th team member** — Dr. Al Muktafi Saadi outreach pending; +1 form point. `outreach/dr-saadi-email.md` sent 2026-05-25; follow-up scheduled 2026-05-28.

## What's NOT in flight

- BRAC pilot deployment — Q3 2026.
- BMRC ethics review filing — after Dr. Saadi confirms.
- Figma — not chasing; UI is in-code only.
- Graph RAG — not chasing pre-prelim.

## Open questions

- CXR override threshold 0.6 — defaulting to CheXNet 2017 published value; need Dr. Saadi's read on whether it's right for Bangladesh pediatric population.

## Non-negotiables (reminder)

Zero LLM in caregiver path. File-path discipline. Honest scoring only. See `CLAUDE.md` + `babypulmo/ARCHITECTURE.md` §3.
