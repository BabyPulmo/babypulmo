# `babypulmo-imci-rag-mcp`

MCP server exposing the WHO IMCI + Bangladesh DGHS pediatric respiratory knowledge base — same pgvector index, same Anthropic-style Contextual RAG retrieval (per-chunk situating prefix) Baby Pulmo's production webhook uses.

**v0 scaffold for prelim demo. Full pilot integration in BRAC Bogura Q3 2026.**

## Tools

| Tool | Purpose |
|---|---|
| `query_imci(symptom, age_months, top_k)` | Top-K contextual-RAG retrieval |
| `query_imci_contextual(symptom, age_months, top_k)` | Same, but returns the situating context prefix per chunk |
| `list_imci_sections()` | Full IMCI/DGHS section title index |
| `get_dosing(drug, age_months, weight_kg)` | Bangladesh DGHS pediatric dosing rows |

## Why

Any clinical AI assistant (pediatrician using Claude Desktop, hospital EHR agent, telemedicine app) can pull the same authoritative pediatric protocol passages the Baby Pulmo runtime cites. Single versioned source-of-truth for IMCI references.

## Companion

This server pairs with `../classifier-server/` (classification + severity + CHW routing) and `../chw-routing-server/` (CHW load balancing). All three reuse the same Supabase project + service-role credentials.
