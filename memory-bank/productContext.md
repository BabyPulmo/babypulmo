# Product context

## The problem

Bangladesh loses ~25,000 children under five to pneumonia every year. **63% of fatal pediatric pneumonia cases never reach a clinician** before death — the family doesn't recognize escalating symptoms, the nearest clinic is too far, and cost/transit barriers are decisive. The bottleneck is **early recognition**, not treatment availability (amoxicillin is cheap and stocked at upazila level).

## Why WhatsApp + Bangla + voice

- **WhatsApp**: 60M+ Bangladeshi users; the only digital channel that reaches rural mothers reliably. Free service messages via Meta Cloud API (no Twilio markup).
- **Bangla**: text literacy among rural mothers is variable; **voice literacy is universal**. Caregivers send voice notes daily.
- **Voice cough sample**: the symptom is acoustic, the caregiver is already trained to send voice on WhatsApp, the AI processes 30s OGG without needing clinic equipment.

## Why a triage filter, not a diagnostic

We do not claim diagnosis. Every output frames as "the cough shows signs of X, see a doctor" — never "your child has X." Mandatory human-in-the-loop: every severe classification escalates to a real CHW with the original audio attached. Same regulatory posture as **ResApp Health** (Pfizer acquired AUD $179M, 2022).

This is why **65% sensitivity is enough**: Baby Pulmo is the upstream filter. Every triggered case routes to a human who makes the actual clinical decision. The cost of a false negative isn't a wrong diagnosis — it's the same "no diagnosis at all" baseline that already costs 25,000 lives/year. False positives are bounded by CHW capacity, which the PostGIS load-balancer manages. See `submission/accuracy.md` for the full posture.

## Why each stack choice

- **Wav2Vec2-XLSR-53** pretrained — multilingual audio encoder works on Bangla coughs without re-pretraining from scratch.
- **Fused Coswara + COUGHVID + ICBHI pediatric subset (≤5y)** — South-Asian respiratory data + global volume + age-matched chest sound, three open datasets compose to the deployment population.
- **Modal CPU int8 ONNX** — 2-vCPU container, scale-to-zero, ~$0.0003/call. GPU not justified for a 5-second classifier on a free-tier-feasible cost profile.
- **GCP `bn-IN-Wavenet-A`** TTS — content-hash cached >99% on the 7-script stock library. Audio is identical every time, so a CDN is the right answer; runtime LLM TTS would burn ~$0.005/call for variability we don't want.
- **Supabase Singapore region** — Bangladesh data residency (closest GCP/Supabase region).

## Why rules-gated, not LLM-generated, Bangla

The cost of a hallucinated Bangla phrase ("give your child this drug") is a dead child. The cost of a clinician-vetted stock script is that we ship 7 scripts instead of unlimited variety. The trade is obvious. Every word the caregiver hears was reviewed by a pediatrician. This is the entire BMRC ethics review claim. See `babypulmo/ARCHITECTURE.md` §3 for the carve-out documenting where LLMs ARE allowed (never caregiver-facing).
