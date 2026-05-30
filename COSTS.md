# Baby Pulmo — Per-call cost breakdown

Per one user interaction = one 30-sec cough voice note → reply (with Bangla audio guidance).

## Final per-call cost (after all 4 optimizations)

| Component                            | Provider                              | Standard call | Escalated call |
| ------------------------------------ | ------------------------------------- | ------------- | -------------- |
| Inbound voice note + reply           | Meta WhatsApp Cloud API direct (BD service msg = free) | $0.0000       | $0.0000        |
| Audio upload (30s OGG ~80 KB)        | Supabase Storage                      | ~$0.0001      | ~$0.0001       |
| Edge function (webhook orchestrator) | Vercel                                | ~$0.0000      | ~$0.0000       |
| Cough classifier (~5s int8 ONNX, CPU)| Modal CPU (2 vCPU, 2 GB)              | $0.0003       | $0.0003        |
| Embedding for RAG query (~100 tok)   | OpenAI text-embedding-3-large         | $0.00001      | $0.00001       |
| pgvector + tsvector retrieval        | Supabase Postgres                     | ~$0.0000      | ~$0.0000       |
| Cohere multilingual rerank (top-6)   | Cohere `rerank-multilingual-v3.0`     | ~$0.0001      | ~$0.0001       |
| Bangla guidance                      | Stock library (no runtime LLM)        | **$0.0000**   | **$0.0000**    |
| Bangla TTS                           | GCP bn-IN WaveNet, content-hash cached (>99% hit on stock) | **~$0.0000**  | **~$0.0000**   |
| CHW outbound alert                   | Meta utility template message (BD)    | —             | $0.0140        |
| Audit log write                      | Supabase Postgres                     | ~$0.0000      | ~$0.0000       |
| **Total**                            |                                       | **≈ $0.0005** | **≈ $0.0145**  |

## Weighted average

≈ **$0.003 per user interaction** (80% standard + 20% escalated mix).

✅ **Below the $0.005-$0.006 target.**

## Where the money goes now

- **CHW utility messages** (severe cases only) — ~95% of total spend
- Modal CPU classifier — ~5%
- Everything else — rounding error

## What actually changed

| Optimization | File | Before | After | Per-call delta |
|---|---|---|---|---|
| Drop runtime LLM, use stock Bangla scripts | `lib/claude.ts`, webhook | Claude Haiku $0.0035 | Stock library $0 | **-$0.0035** |
| Swap ElevenLabs → GCP bn-IN WaveNet | `lib/tts.ts` | $0.05 / call (or $0.008 cached) | $0.005 / miss; ~$0 / hit (cache hit > 99% on stock) | **-$0.05** |
| Twilio → Meta WhatsApp Cloud API direct | `lib/whatsapp.ts`, webhook | Twilio $0.0085 / call | Meta service msgs $0; utility $0.014 | **-$0.0085** standard / -$0.009 net escalated |
| Quantize classifier int8 ONNX, Modal CPU | `colab/train_wav2vec2.py`, `colab/deploy_modal.py` | Modal A10G $0.001 | Modal 2vCPU CPU $0.0003 | **-$0.0007** |

Total reduction: **$0.064 → $0.003 weighted avg ≈ 21x cheaper**.

## Free-tier headroom

- Meta WhatsApp Cloud API: 1,000 free conversations/month (covers ~10,000 messages in service window)
- GCP TTS: 1M WaveNet chars/month free → ~3,000 fresh syntheses; with cache, basically unlimited
- Modal: $30 credits/month → ~100,000 CPU classifier calls
- Supabase: 500 MB DB + 1 GB storage + 2 GB egress free
- Vercel: 100 GB-hours functions, 100 GB bandwidth free
- OpenAI: ~$5 covers all IMCI ingest embeddings forever (one-shot)

For the demo and the first ~1,000 monthly users, **all-in cost is ~$0**.

## Implementation status

All 4 optimizations are wired:

- ✅ Stock-only Bangla — `lib/claude.ts` only exports `decideSeverity`; `lib/tts.ts` `STOCK_BANGLA` covers all 7 (class, severity) tuples; webhook never calls an LLM
- ✅ GCP TTS — `lib/tts.ts` `synthesizeBangla()` uses `texttospeech.googleapis.com/v1/text:synthesize` with `bn-IN-Wavenet-A`; cache layer unchanged
- ✅ Meta WhatsApp Cloud API direct — `lib/whatsapp.ts` handles signature verification + media download + send; webhook has GET (verification handshake) + POST (events) handlers
- ✅ Int8 ONNX on Modal CPU — `colab/train_wav2vec2.py` step 10b runs `quantize_dynamic`; `colab/deploy_modal.py` loads `babypulmo_wav2vec2_int8.onnx` on a 2 vCPU / 2 GB CPU container

## Pre-warm step (after every deploy)

Pre-synthesize all 7 stock scripts so the very first user call is already a cache hit. From a node script with prod env vars loaded:

```ts
import { warmStockCache } from "@/lib/tts";
console.log(await warmStockCache());
// { warmed: 7, alreadyCached: 0 }   on first run
// { warmed: 0, alreadyCached: 7 }   on subsequent runs
```

## Phase 3 scaffolds (cost zero today, cost line in pilot)

These endpoints exist as scaffolds and only incur cost when actually wired up in production. None affect the standard-call weighted average above.

| Scaffold | Endpoint | Cost when active | When charged |
|---|---|---|---|
| **CXR vision** | Modal CPU DenseNet121 (`colab/cxr_vision_modal.py`) | ~$0.0003/call | ONLY when caregiver uploads a CXR image alongside the cough |
| **Whisper Bangla ASR** | Modal T4 GPU large-v3 (`colab/deploy_whisper_modal.py`) | ~$0.006/call | ONLY at caregiver onboarding ("say child's age") — once per caregiver |
| **Ollama + Qwen2.5 CHW offline** | On CHW Android tablet | **$0/call** (runs locally) | Never charged — runs entirely on CHW's device |
| **Federated learning** | Flower aggregation server (partner hospitals) | Hospital-bears training compute | Partner-side; no Baby Pulmo cloud cost |
| **DP-noised aggregate export** | OpenDP Laplace (`scripts/dp-export.ts`) | $0 — pure compute on the Vercel function | Weekly cron, ~$0.0001/run |

Net effect on weighted average: **less than +$0.0001** in the steady state, even with all scaffolds live, because the heavy callers (Whisper, CXR) only fire on specific user actions.
