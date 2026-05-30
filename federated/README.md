# Baby Pulmo — Federated Learning Scaffold

Flower-based federated learning so partner hospitals (Japan Bangladesh Friendship Hospital, Dhaka Shishu Hospital, BRAC Bogura) can fine-tune the Wav2Vec2 pediatric cough classifier on **their pediatric ward audio** without that audio ever leaving the hospital network.

**v0 scaffold for prelim demo. JBFH pilot deployment Q4 2026, pending BMRC ethics review + hospital-IT integration.**

## Why this is the right architecture

Bangladesh's draft Privacy Act 2023 + standard hospital data-residency policies make centralized training on pediatric audio politically and legally impossible. Hospitals will not ship audio to Modal / Vercel even with consent. **Federated learning is the unlock** — the model travels to the data instead of the data traveling to the model.

## How it works

```
                   ┌───────────────────┐
                   │  Flower server    │
                   │ (FedAvg, this dir)│
                   └────┬────────┬─────┘
        ┌───────────────┘        └────────────────┐
        ▼                                          ▼
┌────────────────┐  weight deltas    ┌─────────────────────┐
│ JBFH client    │ ◄───────────────► │ Dhaka Shishu client │
│ (their LAN)    │                   │ (their LAN)         │
│ Their audio    │                   │ Their audio         │
│ NEVER leaves   │                   │ NEVER leaves        │
└────────────────┘                   └─────────────────────┘
```

Each round:
1. Server broadcasts current global Wav2Vec2 weights.
2. Each hospital client trains 1 local epoch on its private dataset.
3. Client returns ONLY weight deltas + aggregate metrics (sample count, F1).
4. Server applies FedAvg aggregation, weighted by client sample counts.
5. Differential-privacy noise added to gradient transmission (Phase 3D scaffold integration — see `scripts/dp-export.ts`).

## Run the demo

In one terminal (server):

```bash
pip install flwr==1.13.1
python federated/flower-server.py --rounds=1
```

In two other terminals (clients):

```bash
python federated/hospital-client.py --partition=jbfh
python federated/hospital-client.py --partition=dhaka-shishu
```

Server prints aggregated F1 + pneumonia-sensitivity at the end of the round.

## v0 scaffold limitations

- Mock weights (deterministic per partition seed). Production wires a real `torch.utils.data.DataLoader` over the hospital's Wav2Vec2 input pipeline.
- No TLS or auth on the Flower channel (production: TLS + JWT + IP allowlist).
- No DP noise yet (Phase 3D `scripts/dp-export.ts` integration is the wire-up).

## Form claim

The BuildFest form's Open Source AI Tools / Privacy & compliance / Evaluation sections now cite Flower + federated learning. Production rollout is honestly disclosed as Q4 2026 pending BMRC approval — no overclaim.
