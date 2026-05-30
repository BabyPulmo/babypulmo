# Tech context

## Stack

| Layer | Stack |
|---|---|
| Web framework | Next.js 14 (App Router), React 18, TypeScript strict |
| Styling | Tailwind CSS |
| DB / Auth / Storage | Supabase (Postgres + pgvector + tsvector + PostGIS + Storage), Singapore region |
| Audio classifier serving | Modal serverless 2-vCPU CPU, int8 ONNX Wav2Vec2-XLSR-53 |
| TTS | Google Cloud TTS `bn-IN-Wavenet-A`, content-hash cached |
| Messaging | Meta WhatsApp Cloud API direct (no Twilio) |
| RAG | pgvector + tsvector Hybrid + Cohere `rerank-multilingual-v3.0` (optional) |
| Vision (Phase 3) | TorchXrayVision DenseNet121 on Modal |
| ASR (Phase 3) | Whisper large-v3 on Modal T4 (caregiver onboarding only) |
| CHW offline | Ollama + Qwen2.5-1.5B-Instruct-Q4_K_M (Llama 3.2 fallback) on Android via Termux |
| Federated | Flower (`federated/`) |
| DP | OpenDP Laplace (`scripts/dp-export.ts`) |
| Lakehouse | Parquet on Supabase Storage → DuckDB-WASM in browser |
| Workflows | n8n self-hosted Docker (`deploy/n8n/`) |
| MCP | `@modelcontextprotocol/sdk`, 3 servers in `mcp/` |
| Agents | LangGraph (build-time eval + CHW investigation) |

## Build / run / deploy

```bash
# Dev
npm install
cp .env.example .env.local                 # fill secrets
npm run dev                                # localhost:3000
npm run typecheck && npm run lint

# Ingest (one-shot per IMCI update)
npx tsx scripts/build-contextual-chunks.ts --dry-run --first=3
npx tsx scripts/build-contextual-chunks.ts

# Lakehouse + DP export (cron)
npx tsx scripts/export-audit-parquet.ts
npx tsx scripts/dp-export.ts

# Modal deploys
cd colab && modal deploy deploy_modal.py                # classifier
cd colab && modal deploy cxr_vision_modal.py            # Phase 3 CXR
cd colab && modal deploy deploy_whisper_modal.py        # Phase 3 Whisper

# MCP servers (stdio)
cd mcp/classifier-server  && npm install && npm run build && node dist/index.js
cd mcp/imci-rag-server    && npm install && npm run build && node dist/index.js
cd mcp/chw-routing-server && npm install && npm run build && node dist/index.js

# n8n
cd deploy/n8n && docker compose up -d

# Federated (Phase 3 scaffold)
cd federated && python flower-server.py        # central
cd federated && python hospital-client.py      # per-hospital
```

## Env vars

Source of truth: `.env.example`. Names follow what `lib/*.ts` reads — never prefix `WHATSAPP_*` with `META_`.

## Test posture

No runtime unit test suite yet. Build-time eval is the only "test": `agents/langgraph-eval/graph.ts`. Add tests when actual bugs surface; don't add speculative coverage. See `CLAUDE.md` for the discipline.

## Non-negotiable

No LLM in the caregiver-facing runtime path. See `systemPatterns.md` and `babypulmo/ARCHITECTURE.md` §3.
