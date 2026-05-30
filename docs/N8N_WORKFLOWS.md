# Baby Pulmo — n8n workflows

Self-hosted n8n at `deploy/n8n/docker-compose.yml`. Three back-of-house workflows. **All three are CHW-side / partner-side operations and never touch the caregiver runtime path — preserves the no-runtime-LLM clinical posture (see `ARCHITECTURE.md` §3 carve-out).**

| Workflow | Cadence | Purpose | Status |
|---|---|---|---|
| `brac-weekly-export.json` | Sun 02:00 UTC | DP-noised aggregate → CSV → SFTP upload to BRAC | ✅ scaffold ready |
| `bmrc-monthly-digest.json` | 1st of month | Audit-log digest → BMRC ethics committee email | scaffold planned |
| `chw-sla-watcher.json` | every 15 min | Find escalations un-ack'd > 30 min → Slack supervisor ping | scaffold planned |

## Why n8n (not LangGraph / Temporal / Airflow)

- n8n is the right primitive for partner-data choreography: visual workflow editor that NGO ops teams can hand over to BRAC IT for them to maintain.
- LangGraph is for agent reasoning loops (we use it elsewhere — see `agents/`).
- Temporal / Airflow are for long-running heavy DAGs we don't have.
- n8n is open-source (Apache-2.0-like fair-code license), self-hostable on a $5 droplet, and has 600+ first-party integrations — including SFTP and Slack the partner workflows need.

## Run

```bash
cd deploy/n8n
docker compose up -d
open http://localhost:5678
# import workflows/brac-weekly-export.json via the UI
```

## v0 scaffold disclosure

Only `brac-weekly-export.json` is ready as a JSON file. The other two are documented as planned and will ship before the BRAC Bogura pilot Q3 2026.
