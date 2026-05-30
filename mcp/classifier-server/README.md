# `babypulmo-classifier-mcp`

MCP server exposing Baby Pulmo's three runtime primitives — pediatric cough classification, multi-modal severity scoring, and nearest-CHW lookup — to any MCP-capable client (Claude Desktop, Cursor, Continue, hospital EHR integration agents).

**v0 scaffold for prelim demo. Full pilot integration with the BRAC Bogura production endpoint in Q3 2026.**

## Tools

| Tool | Description |
|---|---|
| `classify_cough(audio_url)` | Wav2Vec2 6-class pediatric cough output + Grad-CAM + RR |
| `score_severity({cough_class, confidence, breaths_per_min, age_months, fever, cxr_pneumonia_prob})` | Deterministic multi-modal severity decision (matches `lib/claude.ts::decideSeverityMultiModal`) |
| `find_nearest_chw({lat, lon, radius_km})` | PostGIS Haversine over the CHW geo-index |

## Why MCP?

Clinical AI assistants embedded in hospital workflows (Claude Desktop, EHR agents, telemedicine apps) need a single versioned surface for pediatric cough triage. By exposing classification, severity, and routing as MCP tools, Baby Pulmo becomes a composable clinical primitive any conforming client can drive — without re-implementing the model deployment, the rules table, or the geo-index.

## Run

```bash
npm install
npm run build
npm start
```

Or in dev mode (TypeScript without build):

```bash
npm run dev
```

## Connect to Claude Desktop

In `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "babypulmo-classifier": {
      "command": "node",
      "args": ["/abs/path/to/babypulmo/mcp/classifier-server/dist/index.js"],
      "env": {
        "CLASSIFIER_ENDPOINT": "https://your-modal-endpoint.modal.run",
        "CLASSIFIER_API_KEY": "...",
        "SUPABASE_URL": "https://your.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "..."
      }
    }
  }
}
```

When unset, every tool returns a deterministic mock response — useful for local development and judges who want to verify the wire format without provisioning a backend.

## Inspect

```bash
npx @modelcontextprotocol/inspector dist/index.js
```

All 3 tools should be listed; calling `score_severity` with `{cough_class: "pneumonia", confidence: 0.35, breaths_per_min: 55, age_months: 18}` should return `{severity: "critical", reason: "tachypnea_override"}` (matches the WHO IMCI override logic in `lib/claude.ts`).

## Reuse

This server is reused across Baby Pulmo's own internal tooling (Claude Code sessions calling it during development for synthetic test cases) and is the same surface Phase 2 partner integrations (BRAC IT, JBFH telemedicine pilot) will consume.

## Companion servers

See sibling directories:
- `../imci-rag-server/` — WHO IMCI + DGHS RAG retrieval over the same pgvector index
- `../chw-routing-server/` — CHW load-balancing + district-level routing primitives
