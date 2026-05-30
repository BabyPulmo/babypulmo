# Baby Pulmo — Federated Learning (Flower) Aggregation Server
# ──────────────────────────────────────────────────────────────────────────
# FedAvg aggregation server for partner hospitals (Japan Bangladesh Friendship
# Hospital, Dhaka Shishu Hospital, BRAC Bogura) fine-tuning the Wav2Vec2
# pediatric cough classifier on THEIR pediatric ward recordings without raw
# audio ever leaving the hospital network.
#
# Why federated?
#   Bangladesh's strict patient-data residency rules (and the Bangladesh
#   Privacy Act 2023 draft) prevent hospital audio from being shipped to
#   Modal / Vercel. Federated learning unlocks the data that actually exists
#   in pediatric wards — without ever centralizing it.
#
# CLINICAL POSTURE PRESERVATION: Federated weight updates only. No raw
# audio, no patient identifiers, no metadata that could re-identify. Each
# client uploads ONLY model gradients per round. BMRC ethics review treats
# this as the same protocol as the central Modal training pipeline plus an
# additional differential-privacy noise layer on gradient transmission
# (Phase 3D scaffold; see scripts/dp-export.ts).
#
# v0 scaffold for prelim demo. JBFH pilot deployment Q4 2026 pending
# hospital-IT integration + BMRC approval.

import flwr as fl
from flwr.server.strategy import FedAvg
from flwr.common import Metrics


def weighted_average(metrics: list[tuple[int, Metrics]]) -> Metrics:
    """Aggregate per-client F1 / sensitivity weighted by sample count."""
    total = sum(num for num, _ in metrics)
    if total == 0:
        return {}
    f1 = sum(num * m.get("f1_macro", 0.0) for num, m in metrics) / total
    sens = sum(num * m.get("pneumonia_sensitivity", 0.0) for num, m in metrics) / total
    return {"f1_macro": f1, "pneumonia_sensitivity": sens}


def fit_config(server_round: int):
    """Send per-round hyperparameters to clients."""
    return {
        "server_round": server_round,
        "local_epochs": 1,
        "learning_rate": 1e-5,
        "batch_size": 4,
    }


strategy = FedAvg(
    fraction_fit=1.0,        # all available hospital clients per round
    fraction_evaluate=0.5,    # randomized half evaluate
    min_fit_clients=2,
    min_evaluate_clients=2,
    min_available_clients=2,
    evaluate_metrics_aggregation_fn=weighted_average,
    on_fit_config_fn=fit_config,
)


def main(rounds: int = 1):
    fl.server.start_server(
        server_address="0.0.0.0:8080",
        config=fl.server.ServerConfig(num_rounds=rounds),
        strategy=strategy,
    )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--rounds", type=int, default=1)
    args = parser.parse_args()
    main(rounds=args.rounds)
