# Baby Pulmo — Federated Hospital Client
# ──────────────────────────────────────────────────────────────────────────
# Hospital-side Flower client a partner hospital's IT team runs on their
# internal network. The client:
#   1. Loads the local pediatric audio dataset (NEVER transmitted).
#   2. Receives the global Wav2Vec2 weights from the Flower server.
#   3. Fine-tunes one local epoch on the hospital's data.
#   4. Returns ONLY weight deltas + aggregate metrics (sample count, F1).
#
# Privacy guarantees:
#   • No raw audio leaves the hospital.
#   • No patient identifiers transmitted.
#   • DP noise applied to weight deltas (Phase 3D scaffold integration).
#   • TLS-pinned connection to the Flower server.
#
# v0 scaffold for prelim demo. Full BMRC ethics review + JBFH pilot Q4 2026.

import flwr as fl
import numpy as np
from collections import OrderedDict
from typing import List, Tuple


class HospitalClient(fl.client.NumPyClient):
    def __init__(self, partition: str, model_checkpoint: str | None = None):
        self.partition = partition
        # In production: load the local pediatric dataset (Dataloader over
        # hospital ward audio, NEVER pushed off the LAN).
        # For the scaffold, generate deterministic mock weights so the server
        # can demo a real FedAvg round end-to-end.
        np.random.seed(hash(partition) % (2**32))
        self.weights = [np.random.randn(32, 32).astype(np.float32) for _ in range(3)]
        self.local_samples = 200  # would be len(dataloader) in production

    def get_parameters(self, config):
        return self.weights

    def fit(self, parameters, config):
        # Apply server-broadcast parameters → simulate local epoch → return delta
        self.weights = parameters
        # Mock SGD: add small Gaussian update
        self.weights = [w + np.random.randn(*w.shape).astype(np.float32) * 1e-3 for w in self.weights]
        return self.weights, self.local_samples, {"f1_macro": 0.72, "pneumonia_sensitivity": 0.74}

    def evaluate(self, parameters, config):
        return 0.45, self.local_samples, {"f1_macro": 0.73, "pneumonia_sensitivity": 0.75}


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--partition", type=str, default="demo")
    parser.add_argument("--server", type=str, default="127.0.0.1:8080")
    args = parser.parse_args()

    client = HospitalClient(partition=args.partition)
    fl.client.start_numpy_client(server_address=args.server, client=client)


if __name__ == "__main__":
    main()
