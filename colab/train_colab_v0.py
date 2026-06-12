# Baby Pulmo — fast v0 cough classifier (Colab, COUGHVID-only)
# ===========================================================================
# Pure-Python (no shell magics) so it runs either pasted into a Colab cell or
# via `!python train_colab_v0.py`. Trains facebook/wav2vec2-base on COUGHVID's
# physician-expert-labelled subset → a REAL, audio-dependent cough classifier.
#
# HONEST SCOPE: this is a rough v0. COUGHVID expert labels are coarse
# (healthy / upper-infection / lower-infection / obstructive), mapped to a
# 4-class subset of Baby Pulmo's schema. It is NOT pediatric-specific and not
# clinically validated — it exists to make the demo's classification actually
# respond to the audio instead of being random.
#
# Label mapping (COUGHVID expert diagnosis -> Baby Pulmo class):
#   healthy_cough       -> healthy
#   upper_infection     -> common_cold
#   lower_infection     -> pneumonia      (loose: lower-respiratory infection)
#   obstructive_disease -> asthma
#   COVID-19            -> (skipped)
#
# Output: babypulmo_wav2vec2_int8.onnx  (+ label order printed for serving)
# ===========================================================================

import os, io, json, zipfile, urllib.request, random, math
import numpy as np
import pandas as pd

SEED = 42
random.seed(SEED); np.random.seed(SEED)

DATA_DIR = "/content/coughvid"
ZIP_URL = "https://zenodo.org/record/4498364/files/public_dataset.zip"
ZIP_PATH = "/content/coughvid.zip"
MAX_PER_CLASS = 500          # cap for speed; raise for a better model
TARGET_SR = 16000
SEGMENT_SEC = 5.0
SEGMENT_LEN = int(TARGET_SR * SEGMENT_SEC)

# Baby Pulmo class order. The serving layer (deploy_modal.py / local server)
# must use this exact index->label order. Printed again at the end.
LABEL2ID = {"healthy": 0, "common_cold": 1, "pneumonia": 2, "asthma": 3}
ID2LABEL = {v: k for k, v in LABEL2ID.items()}

DIAG_MAP = {
    "healthy_cough": "healthy",
    "upper_infection": "common_cold",
    "lower_infection": "pneumonia",
    "obstructive_disease": "asthma",
}

# ---------------------------------------------------------------------------
# 1. Download + extract COUGHVID (~1.3 GB)
# ---------------------------------------------------------------------------
def download_coughvid():
    pub = os.path.join(DATA_DIR, "public_dataset")
    if os.path.isdir(pub) and os.path.exists(os.path.join(pub, "metadata_compiled.csv")):
        print("[data] COUGHVID already present.")
        return pub
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(ZIP_PATH):
        print(f"[data] downloading COUGHVID … (~1.3 GB, a few minutes)")
        def _hook(block, bsize, total):
            done = block * bsize
            if total > 0 and block % 200 == 0:
                print(f"  {done/1e6:7.0f} MB / {total/1e6:.0f} MB", end="\r")
        urllib.request.urlretrieve(ZIP_URL, ZIP_PATH, _hook)
        print("\n[data] download complete.")
    print("[data] extracting …")
    with zipfile.ZipFile(ZIP_PATH) as z:
        z.extractall(DATA_DIR)
    # Some COUGHVID zips nest under public_dataset/, some don't.
    if not os.path.isdir(pub):
        # find the dir containing metadata_compiled.csv
        for root, _dirs, files in os.walk(DATA_DIR):
            if "metadata_compiled.csv" in files:
                return root
    return pub

# ---------------------------------------------------------------------------
# 2. Build labelled records from the expert-annotated subset
# ---------------------------------------------------------------------------
def first_expert_diagnosis(row):
    for i in (1, 2, 3, 4):
        v = row.get(f"diagnosis_{i}")
        if isinstance(v, str) and v in DIAG_MAP:
            return DIAG_MAP[v]
    return None

def find_audio(pub, uuid):
    for ext in (".webm", ".ogg", ".wav"):
        p = os.path.join(pub, uuid + ext)
        if os.path.exists(p):
            return p
    return None

def build_records(pub):
    meta = pd.read_csv(os.path.join(pub, "metadata_compiled.csv"))
    print(f"[data] metadata rows: {len(meta)}; columns incl. diagnosis_1: "
          f"{'diagnosis_1' in meta.columns}")
    # optional quality gate
    if "cough_detected" in meta.columns:
        meta = meta[meta["cough_detected"].fillna(0) >= 0.7]
    recs = []
    for _, row in meta.iterrows():
        label = first_expert_diagnosis(row)
        if label is None:
            continue
        uuid = str(row.get("uuid", "")).strip()
        if not uuid:
            continue
        path = find_audio(pub, uuid)
        if path:
            recs.append({"path": path, "label": label})
    df = pd.DataFrame(recs)
    if len(df) == 0:
        raise SystemExit("No expert-labelled COUGHVID samples found — check the dataset.")
    # balance: cap per class
    df = df.groupby("label", group_keys=False).apply(
        lambda g: g.sample(n=min(len(g), MAX_PER_CLASS), random_state=SEED)
    ).reset_index(drop=True)
    print("[data] class counts after balancing:")
    print(df["label"].value_counts())
    return df

# ---------------------------------------------------------------------------
# 3. Audio preprocessing (matches lib/respiratory-rate band + 5 s window idea)
# ---------------------------------------------------------------------------
def make_loader():
    import librosa
    from scipy.signal import butter, sosfiltfilt
    sos = butter(4, [50.0, 2500.0], btype="bandpass", fs=TARGET_SR, output="sos")
    def load_audio(path):
        try:
            wav, _ = librosa.load(path, sr=TARGET_SR, mono=True)
        except Exception as e:
            return None
        if len(wav) < 16:
            return None
        wav = sosfiltfilt(sos, wav).astype(np.float32)
        if len(wav) > SEGMENT_LEN:
            s = (len(wav) - SEGMENT_LEN) // 2
            wav = wav[s:s + SEGMENT_LEN]
        else:
            pad = np.zeros(SEGMENT_LEN, dtype=np.float32)
            pad[:len(wav)] = wav
            wav = pad
        return wav
    return load_audio

# ---------------------------------------------------------------------------
# 4. Train
# ---------------------------------------------------------------------------
def main():
    import torch, torch.nn as nn
    from datasets import Dataset
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, confusion_matrix
    from transformers import (Wav2Vec2FeatureExtractor,
                              Wav2Vec2ForSequenceClassification,
                              TrainingArguments, Trainer)

    print("[env] cuda:", torch.cuda.is_available(),
          torch.cuda.get_device_name(0) if torch.cuda.is_available() else "")

    pub = download_coughvid()
    df = build_records(pub)
    df["label_id"] = df["label"].map(LABEL2ID)

    load_audio = make_loader()
    print("[data] decoding audio (this is the slow part) …")
    arrs, labels = [], []
    for _i, r in df.iterrows():
        a = load_audio(r["path"])
        if a is not None:
            arrs.append(a); labels.append(int(r["label_id"]))
    print(f"[data] usable decoded samples: {len(arrs)}")

    X_tr, X_te, y_tr, y_te = train_test_split(
        arrs, labels, test_size=0.2, stratify=labels, random_state=SEED)

    MODEL = "facebook/wav2vec2-base"
    fe = Wav2Vec2FeatureExtractor.from_pretrained(MODEL)

    def to_ds(X, y):
        return Dataset.from_dict({"input_values": [a.tolist() for a in X], "labels": y})
    train_ds, test_ds = to_ds(X_tr, y_tr), to_ds(X_te, y_te)

    model = Wav2Vec2ForSequenceClassification.from_pretrained(
        MODEL, num_labels=len(LABEL2ID), id2label=ID2LABEL, label2id=LABEL2ID,
        mask_time_prob=0.08, mask_feature_prob=0.05)
    model.freeze_feature_encoder()

    counts = np.bincount(y_tr, minlength=len(LABEL2ID))
    w = counts.sum() / (len(counts) * np.maximum(counts, 1))
    class_w = torch.tensor(w, dtype=torch.float32)

    class WTrainer(Trainer):
        def compute_loss(self, model, inputs, return_outputs=False, **kw):
            labels = inputs.pop("labels")
            out = model(**inputs)
            loss = nn.CrossEntropyLoss(weight=class_w.to(out.logits.device))(out.logits, labels)
            return (loss, out) if return_outputs else loss

    args = TrainingArguments(
        output_dir="/content/bp_model", num_train_epochs=4,
        per_device_train_batch_size=8, per_device_eval_batch_size=8,
        learning_rate=3e-5, warmup_ratio=0.1, lr_scheduler_type="cosine",
        eval_strategy="epoch", save_strategy="no", logging_steps=20,
        fp16=torch.cuda.is_available(), report_to="none", seed=SEED)

    trainer = WTrainer(model=model, args=args,
                       train_dataset=train_ds, eval_dataset=test_ds)
    trainer.train()

    # Honest evaluation
    import numpy as _np
    preds = _np.argmax(trainer.predict(test_ds).predictions, axis=1)
    print("\n==== HONEST TEST METRICS ====")
    print(classification_report(y_te, preds,
          target_names=[ID2LABEL[i] for i in range(len(LABEL2ID))], zero_division=0))
    print("confusion matrix:\n", confusion_matrix(y_te, preds))

    # -----------------------------------------------------------------------
    # 5. Export ONNX (fp32 -> int8)
    # -----------------------------------------------------------------------
    model.eval().cpu()
    dummy = torch.zeros(1, SEGMENT_LEN, dtype=torch.float32)
    torch.onnx.export(model, (dummy,), "/content/babypulmo_wav2vec2.onnx",
                      input_names=["input_values"], output_names=["logits"],
                      dynamic_axes={"input_values": {0: "batch"}, "logits": {0: "batch"}},
                      opset_version=14)
    from onnxruntime.quantization import quantize_dynamic, QuantType
    quantize_dynamic("/content/babypulmo_wav2vec2.onnx",
                     "/content/babypulmo_wav2vec2_int8.onnx", weight_type=QuantType.QInt8)
    mb = os.path.getsize("/content/babypulmo_wav2vec2_int8.onnx") / 1e6
    print(f"\n[export] babypulmo_wav2vec2_int8.onnx  ({mb:.1f} MB)")
    print("[export] LABEL ORDER (index -> class), needed for serving:")
    print(json.dumps(ID2LABEL, indent=2))

    # Save the label order next to the model so wiring is unambiguous.
    with open("/content/babypulmo_labels.json", "w") as f:
        json.dump(ID2LABEL, f)

    # Auto-download in Colab
    try:
        from google.colab import files
        files.download("/content/babypulmo_wav2vec2_int8.onnx")
        files.download("/content/babypulmo_labels.json")
    except Exception:
        print("[export] (not in Colab — files are in /content)")

if __name__ == "__main__":
    main()
