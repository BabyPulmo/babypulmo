# Baby Pulmo — Chest X-Ray Vision (Phase 3 Scaffold)

Second clinical modality alongside cough audio + respiratory rate. When a caregiver also has access to a rural clinic with a backlit panel, they can snap a smartphone photo of the child's chest X-ray and attach it to the WhatsApp message. The TorchXrayVision DenseNet121 model (pretrained on CheXpert + NIH ChestX-ray14) returns pneumonia / consolidation / no-finding probabilities, which feed into the deterministic `decideSeverityMultiModal()` rules table as a hard override.

**v0 scaffold for prelim demo. Full pediatric-subset fine-tune + BMRC ethics protocol + BRAC Bogura pilot Q3 2026.**

## Files

| File | Purpose |
|---|---|
| `colab/cxr_vision_modal.py` | Modal serverless endpoint hosting DenseNet121 |
| `lib/cxr-vision.ts` | TypeScript client (`classifyCxr`, `cxrPneumoniaPositive`) |
| `lib/types.ts` | `CxrSignal` + `MultiModalInput.cxr` |
| `lib/claude.ts` | `decideSeverityMultiModal()` CXR override at top of precedence |
| `app/api/webhook/whatsapp/route.ts` | Image-attachment branch + Supabase storage |

## Decision rule

```
cxrFinding.pneumoniaProb ≥ 0.6 OR cxrFinding.consolidationProb ≥ 0.6
  → severity = "critical"
  → recommendedAction = "see_chw_now"
  → decisionReason = "cxr_override"
```

This is the **highest-precedence override** in the multi-modal severity decision — it fires before the WHO IMCI tachypnea override and before the audio-class rule. Rationale: a positive consolidation on a chest film is more specific than any acoustic signal, and a CXR-positive child needs immediate CHW referral regardless of cough quality.

## Why this matters at finals

- 30% of pediatric pneumonia cases have ambiguous cough audio. Adding CXR catches them.
- Same architectural pattern as the latest published pediatric pneumonia systems (Lakhani & Sundaram 2017, Rajpurkar et al. CheXNet 2017) — moves Baby Pulmo from audio-only to true multi-modal medical AI.
- Preserves the clinical-decision-support posture: CXR finding feeds the deterministic rules table; no LLM sees the image; no LLM speaks Bangla.

## Phase 3 production gap

The current scaffold uses the off-the-shelf TorchXrayVision DenseNet121 weights, which were trained on adult chest X-ray datasets. Pediatric anatomy differs (smaller cardiothoracic ratio, less mineralized bone). Phase 3 fine-tunes on the published Pediatric Chest X-ray dataset (Kermany et al. 2018, Cell) + the BRAC Bogura pilot's locally collected pediatric CXRs (with BMRC ethics approval).

## Privacy

CXR images are stored in `recordings/cxr/<uuid>.jpg` with the same opt-in caregiver consent and audit-log lineage as audio recordings. Faces (if accidentally included) are blurred at ingest by `colab/cxr_vision_modal.py`'s preprocessing. No identifying metadata is retained beyond the opaque `caregiver_id` hash.
