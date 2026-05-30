# Project brief

## What

Baby Pulmo: a WhatsApp-native AI that takes a 30-second cough voice note from a caregiver in rural Bangladesh, classifies pediatric respiratory disease (6 classes: healthy / common_cold / bronchiolitis / pneumonia / asthma / croup) using a fine-tuned Wav2Vec2-XLSR-53 audio classifier, retrieves matching WHO IMCI + Bangladesh DGHS protocol via Contextual + Hybrid RAG, and returns Bangla audio guidance to the caregiver. Severe cases auto-escalate to the nearest Community Health Worker via PostGIS routing. Optional Phase 3: caregiver chest X-ray photo runs through TorchXrayVision DenseNet121; CXR pneumonia ≥ 0.6 is the highest-precedence CRITICAL escalation override.

## Who for

- **Primary**: Mothers in rural Bangladesh, 19–35y, WhatsApp-literate, low-end Android phone, Bangla-speaking, sick under-5 child, nearest clinic ≥ 36 hours away on average.
- **Secondary**: Community Health Workers (Bangladesh DGHS-registered) who receive ranked escalations and an Ollama+Qwen2.5 offline investigation tool when monsoon kills connectivity.
- **Tertiary**: Clinical Advisor (Dr. Al Muktafi Saadi outreach pending) who reviews the 7 stock Bangla scripts.
- **Quaternary**: Partner orgs (BRAC, DGHS, UNICEF) receiving DP-noised aggregate exports.

## Success criteria

1. **BuildFest 2026 prelim shortlist** (deadline 2026-05-30) — top 200 of submissions.
2. **BuildFest 2026 finals** (2026-06-12 Dhaka) — top placement.
3. **BMRC ethics review approval** for the BRAC Bogura pilot study protocol.
4. **BRAC Bogura pilot** rollout Q3 2026 (≥ 1,000 caregivers, ≥ 50 CHWs, ≥ 4 upazilas).
5. **Sensitivity ≥ 65%** field-deployed on pediatric pneumonia (triage filter, not diagnostic). Specificity tuned to minimize CHW over-triage.

## Non-negotiable constraint

Zero LLM in the caregiver-facing runtime decision path. Severity is the deterministic function `lib/claude.ts::decideSeverityMultiModal`. Bangla is the clinician-vetted stock library in `lib/tts.ts::STOCK_BANGLA`. See `babypulmo/ARCHITECTURE.md` §3 for where LLMs ARE allowed (build-time, one-shot ingest, CHW-side, partner MCP, federated, CXR vision).
