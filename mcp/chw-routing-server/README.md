# `babypulmo-chw-routing-mcp`

MCP server exposing CHW geo-routing and district-level load balancing for partner integrations.

**v0 scaffold for prelim demo. Phase 2 BRAC operations integration Q3 2026.**

## Tools

| Tool | Purpose |
|---|---|
| `nearest_chw(lat, lon, radius_km, max_results)` | PostGIS Haversine top-K |
| `chw_load_balance(district, max_results)` | District-level workload-balanced ordering |

## Why

Partner systems — BRAC operations dashboard, Bangladesh DGHS district health planning, third-party telemedicine triage apps — can drive the same routing primitives Baby Pulmo's production webhook uses without coupling to our internal schema.

## Companion

Pairs with `../classifier-server/` and `../imci-rag-server/`. All three reuse the same Supabase project.
