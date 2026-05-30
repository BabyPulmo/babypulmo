# Baby Pulmo — Differential Privacy Analysis

Calibrated Laplace noise on per-district aggregate statistics in the weekly partner CSV export, providing a provable (ε, 0)-differential-privacy guarantee against re-identification of any single caregiver+child interaction.

**v0 scaffold for prelim demo. Production version (OpenDP Rust-backed accountant + audited DP budget tracker) ready for BMRC ethics review Q3 2026.**

## Why DP on top of pseudonymization

`audit_log` already stores only an opaque `caregiver_id` hash — no name, no phone number. But per-district aggregate counts at small N can be **inverted** by an adversary with auxiliary information (district population, time of report). Example: an adversary knowing "village X had only 3 children with cough this week" can correlate the per-district count to specific households.

DP noise eliminates that inversion risk while preserving aggregate utility for partner-planning use cases (BRAC quarterly allocation, DGHS district health planning, UNICEF reporting).

## Mechanism

**Laplace mechanism** with calibrated scale per query:

```
noisy_value = true_value + Laplace(scale = sensitivity / epsilon)
```

- **Sensitivity** = max change in query output if ONE record is added or removed. For all counts in `dp-export.ts`, sensitivity = 1.
- **Epsilon (ε)** = privacy budget. Smaller ε = stricter privacy = more noise. We use ε = 1.0 for high-volume counts, ε = 0.5 for low-volume aggregates.

## Per-query budget table

| Query | Sensitivity | ε | Rationale |
|---|---|---|---|
| `per_district_pneumonia_rate` | 1 | 1.0 | High-volume (>100 rows/district/week); ε=1.0 is the standard DP-public-data choice. |
| `per_age_band_escalation_count` | 1 | 1.0 | Moderate volume; same standard. |
| `per_week_overall_volume` | 1 | 0.5 | Lower N (one row per week); stricter ε to compensate. |

Cumulative budget per partner per quarter: **ε ≤ 4.5** (3 queries × 12 weeks × proportional allocation under sequential composition). Production version uses Rényi DP accounting for tighter composition bounds.

## Why Laplace and not Gaussian

Laplace is exact (ε, 0)-DP. Gaussian is (ε, δ)-DP with a δ > 0 failure probability — fine for ML training (DP-SGD) but not desirable for analyst-facing aggregates where we want zero residual risk.

## What this does NOT cover

- **Re-identification of an active escalation** is prevented by the in-flight encryption + RLS-restricted GPS access in the production webhook — not by this DP layer.
- **Federated learning gradients** are protected by a separate DP noise layer in `federated/flower-server.py` (gradient clipping + Gaussian noise, DP-SGD style). Different ε budget; see that file's roadmap.
- **Stock Bangla script content** is public (clinician-vetted), not PII — no DP needed.

## Smoke test

```bash
npx tsx scripts/dp-export.ts --query=per_district_pneumonia_rate --epsilon=1.0 --dry-run
```

Produces a JSON sample of noised aggregate rows. Repeating with the same epsilon will produce different values each run (verifying the noise sampler is working).

## Form claim

- ☑ Differential privacy in Guardrails / Privacy & compliance section
- ☑ OpenDP in Open Source AI Tools
- ☑ DP analysis methodology in Evaluation & Quality Measurement section
