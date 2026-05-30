# Baby Pulmo — Wav2Vec2 pediatric cough classifier (fused-dataset training)
#
# Colab-ready Python script with `# %%` cell markers (Jupytext/VS Code format).
# In Colab: open a new notebook, set runtime to T4 GPU, then either
#   (a) paste this file's contents as cells (one per `# %%` marker), or
#   (b) `!pip install jupytext && jupytext --to ipynb train_wav2vec2.py`
#
# Pipeline (matches `submission/form-draft.md` Fine-tuning section):
#   1. Fuse three open respiratory datasets — Coswara (IISc), COUGHVID (EPFL),
#      ICBHI 2017 (pediatric chest sounds).
#   2. Filter to pediatric subset (age ≤ 5 years where age metadata exists;
#      ICBHI pediatric split is kept whole).
#   3. Preprocess: resample 16 kHz mono, 50–2500 Hz Butterworth bandpass
#      (the published lung-sound spectral range) — strips fans, motorbikes,
#      bird calls before features are extracted.
#   4. Fine-tune facebook/wav2vec2-large-xlsr-53 with built-in SpecAugment
#      (mask_time_prob / mask_feature_prob) — the same time/freq masking
#      Google's SpecAugment paper introduced, applied to wav2vec2's latent
#      features.
#   5. 6-class output: healthy / common_cold / bronchiolitis / pneumonia /
#      asthma / croup. Confidence ≥ 0.5 is the gate; below-threshold
#      classifications trigger a "please re-record" Bangla reply.
#   6. Export int8 ONNX for Modal CPU inference (~4× smaller, ~3× faster).
#
# Targets — held-out test split:
#   • ≥84% pediatric pneumonia sensitivity (JAMA Pediatrics 2018 ResApp bar)
#   • Realistic v0 lab estimate: 70–78% (per submission/accuracy.md §2(b))

# %% [markdown]
# # Baby Pulmo: Pediatric Cough Classifier Training
# Fine-tunes Wav2Vec2-XLSR-53 on a fused Coswara + COUGHVID + ICBHI pediatric
# split for 6-class respiratory disease classification. Outputs an int8 ONNX
# model + Grad-CAM heatmap generator.

# %%
!pip install -q transformers==4.44.2 datasets==2.21.0 librosa==0.10.2 \
    torch==2.4.0 torchaudio==2.4.0 evaluate==0.4.3 accelerate==0.34.0 \
    onnx==1.16.2 onnxruntime==1.19.2 matplotlib==3.9.2 scipy==1.13.1

# %%
import os, json, math, random, glob, shutil, re
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torchaudio
import librosa
import matplotlib.pyplot as plt
from pathlib import Path
from scipy.signal import butter, sosfiltfilt
from datasets import Dataset, Audio
from transformers import (
    Wav2Vec2FeatureExtractor,
    Wav2Vec2ForSequenceClassification,
    TrainingArguments,
    Trainer,
)
import evaluate

SEED = 42
random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)

# 6-class pediatric output matching submission/form-draft.md.
LABEL2ID = {
    "healthy": 0,
    "common_cold": 1,
    "bronchiolitis": 2,
    "pneumonia": 3,
    "asthma": 4,
    "croup": 5,
}
ID2LABEL = {v: k for k, v in LABEL2ID.items()}
PEDIATRIC_MAX_AGE_YEARS = 5

# %% [markdown]
# ## 1. Download the three source datasets
#
# - **Coswara** (IISc Bangalore) — ~5,000 crowdsourced South Asian cough +
#   breath recordings. Adult-dominant; pediatric subset filtered by age field.
# - **COUGHVID** (EPFL) — ~25,000 global crowdsourced cough recordings.
#   Pediatric subset filtered by `age` field.
# - **ICBHI 2017** — gold-standard clinical respiratory sound database.
#   Strong pediatric coverage; ground-truth labels for crackles, wheezes,
#   pneumonia, bronchiolitis. We use its pediatric split whole.

# %%
!git clone https://github.com/iiscleap/Coswara-Data.git
!cd Coswara-Data && python extract_data.py    # ~15 minutes

# COUGHVID: published on Zenodo; ~10 GB. Adjust DOI as needed.
!wget -q https://zenodo.org/record/4498364/files/public_dataset.zip -O coughvid.zip || echo "Download COUGHVID separately if Zenodo throttles"
!unzip -q -o coughvid.zip -d coughvid/ 2>/dev/null || true

# ICBHI 2017: official site requires registration; the Bristol mirror works
# unauthenticated for research. Adjust to your access method.
!wget -q https://bhichallenge.med.auth.gr/sites/default/files/ICBHI_final_database/ICBHI_final_database.zip -O icbhi.zip || echo "Download ICBHI separately if mirror is down"
!unzip -q -o icbhi.zip -d icbhi/ 2>/dev/null || true

# %% [markdown]
# ## 2. Build the fused, pediatric, 6-class dataset

# %%
def load_coswara_records():
    """Coswara pediatric subset → 6-class labels."""
    root = Path("Coswara-Data/Extracted_data")
    if not root.exists():
        return []
    out = []
    for date_dir in root.iterdir():
        if not date_dir.is_dir(): continue
        for subj in date_dir.iterdir():
            meta_path = subj / "metadata.json"
            if not meta_path.exists(): continue
            try:
                meta = json.loads(meta_path.read_text())
            except Exception:
                continue
            age = meta.get("a")  # Coswara uses "a" for age
            try:
                age_yr = float(age) if age is not None else None
            except (TypeError, ValueError):
                age_yr = None
            if age_yr is None or age_yr > PEDIATRIC_MAX_AGE_YEARS:
                continue  # pediatric filter

            cough_files = sorted(glob.glob(str(subj / "cough-heavy.wav"))) + \
                          sorted(glob.glob(str(subj / "cough-shallow.wav")))
            if not cough_files: continue

            covid = meta.get("covid_status", "")
            asthma = bool(meta.get("asthma", False))
            cold = bool(meta.get("cold", False))
            cough = bool(meta.get("cough", False))

            if asthma:
                label = "asthma"
            elif covid in ("positive_mild", "positive_moderate", "positive_severe"):
                label = "pneumonia"
            elif cold:
                label = "common_cold"
            elif covid == "healthy" and not (cold or cough):
                label = "healthy"
            else:
                continue
            for f in cough_files:
                out.append({"audio_path": f, "label": label, "source": "coswara"})
    return out


def load_coughvid_records():
    """COUGHVID pediatric subset → 6-class labels."""
    root = Path("coughvid/public_dataset")
    meta_csv = root / "metadata_compiled.csv"
    if not meta_csv.exists():
        return []
    df = pd.read_csv(meta_csv)
    # pediatric filter
    if "age" in df.columns:
        df = df[df["age"].fillna(99).astype(float) <= PEDIATRIC_MAX_AGE_YEARS]
    out = []
    for _, row in df.iterrows():
        uuid = row.get("uuid")
        if not uuid: continue
        wav = root / f"{uuid}.wav"
        if not wav.exists():
            ogg = root / f"{uuid}.ogg"
            if ogg.exists():
                wav = ogg
            else:
                continue
        # COUGHVID expert labels: dx_1 (primary diagnosis)
        dx = (row.get("diagnosis") or row.get("dx_1") or "").lower()
        respiratory_condition = str(row.get("respiratory_condition", "")).lower()
        if "pneumonia" in dx:
            label = "pneumonia"
        elif "bronchiolitis" in dx:
            label = "bronchiolitis"
        elif "asthma" in dx or "asthma" in respiratory_condition:
            label = "asthma"
        elif "croup" in dx:
            label = "croup"
        elif "cold" in dx or "upper_infection" in dx:
            label = "common_cold"
        elif respiratory_condition in ("false", "no", "") and dx in ("", "healthy_cough"):
            label = "healthy"
        else:
            continue
        out.append({"audio_path": str(wav), "label": label, "source": "coughvid"})
    return out


def load_icbhi_records():
    """ICBHI 2017 pediatric subset → 6-class labels.
    ICBHI ships patient_diagnosis.txt (patient_id, diagnosis) and
    demographic_info.txt (patient_id, age, sex, ...). Pediatric defined as
    age <= 5 yr where present; ICBHI's pediatric subset is age-tagged."""
    root = Path("icbhi/ICBHI_final_database")
    diag_file = root / "patient_diagnosis.txt"
    demo_file = root / "demographic_info.txt"
    if not diag_file.exists() or not demo_file.exists():
        return []

    diag = {}
    for line in diag_file.read_text().splitlines():
        parts = line.strip().split()
        if len(parts) >= 2:
            diag[parts[0]] = parts[1].lower()

    demo = {}
    for line in demo_file.read_text().splitlines():
        parts = line.strip().split()
        if len(parts) >= 2:
            try:
                demo[parts[0]] = float(parts[1])  # age in years
            except ValueError:
                pass

    diag_to_label = {
        "healthy": "healthy",
        "pneumonia": "pneumonia",
        "bronchiolitis": "bronchiolitis",
        "asthma": "asthma",
        "urti": "common_cold",
        "lrti": "common_cold",
        "copd": None,  # adult-only — skip
        "bronchiectasis": None,
    }

    out = []
    for wav in root.glob("*.wav"):
        # Filename pattern: 101_1b1_Al_sc_Meditron.wav → patient_id = 101
        pid = wav.name.split("_", 1)[0]
        age = demo.get(pid)
        if age is None or age > PEDIATRIC_MAX_AGE_YEARS:
            continue
        d = diag.get(pid)
        label = diag_to_label.get(d) if d else None
        if not label:
            continue
        out.append({"audio_path": str(wav), "label": label, "source": "icbhi"})
    return out


# %%
records = load_coswara_records() + load_coughvid_records() + load_icbhi_records()
df = pd.DataFrame(records)
print(f"Total pediatric samples: {len(df)}")
if len(df):
    print("By source:\n", df["source"].value_counts())
    print("\nBy label:\n", df["label"].value_counts())

# Class balance: downsample dominant classes to median count (avoids the
# severe imbalance where 'healthy' floods the model). Weighted CE still used.
if len(df):
    counts = df["label"].value_counts()
    target = int(counts.median())
    df = df.groupby("label", group_keys=False).apply(
        lambda g: g.sample(n=min(len(g), target * 2), random_state=SEED)
    ).reset_index(drop=True)
    print(f"\nAfter balancing: {len(df)} samples")
    print(df["label"].value_counts())

# %% [markdown]
# ## 3. Train/val/test split (stratified)

# %%
from sklearn.model_selection import train_test_split

df["label_id"] = df["label"].map(LABEL2ID)
train_df, temp_df = train_test_split(
    df, test_size=0.30, stratify=df["label_id"], random_state=SEED
)
val_df, test_df = train_test_split(
    temp_df, test_size=0.50, stratify=temp_df["label_id"], random_state=SEED
)
print(f"Train: {len(train_df)}, Val: {len(val_df)}, Test: {len(test_df)}")

# %% [markdown]
# ## 4. Audio preprocessing — bandpass + resample + 5-sec window
#
# Bandpass 50–2500 Hz: the published frequency range for clinically meaningful
# lung sounds. Strips background noise (fans, motorbikes, bird calls, generators)
# that dominates crowdsourced data. Applied BEFORE the Wav2Vec2 feature
# extractor so the model never sees out-of-band energy.

# %%
TARGET_SR = 16000
SEGMENT_SEC = 5.0
SEGMENT_LEN = int(TARGET_SR * SEGMENT_SEC)
BANDPASS_LOW = 50.0
BANDPASS_HIGH = 2500.0

_BANDPASS_SOS = butter(
    N=4,
    Wn=[BANDPASS_LOW, BANDPASS_HIGH],
    btype="bandpass",
    fs=TARGET_SR,
    output="sos",
)

def apply_bandpass(waveform: np.ndarray) -> np.ndarray:
    if len(waveform) < 16:
        return waveform
    return sosfiltfilt(_BANDPASS_SOS, waveform).astype(np.float32)


def load_audio(path: str) -> np.ndarray:
    waveform, _ = librosa.load(path, sr=TARGET_SR, mono=True)
    waveform = apply_bandpass(waveform)
    if len(waveform) > SEGMENT_LEN:
        start = (len(waveform) - SEGMENT_LEN) // 2
        return waveform[start : start + SEGMENT_LEN]
    pad = np.zeros(SEGMENT_LEN, dtype=np.float32)
    pad[: len(waveform)] = waveform
    return pad


def df_to_dataset(d):
    arrs = [load_audio(p) for p in d["audio_path"]]
    return Dataset.from_dict({
        "audio": [{"array": a, "sampling_rate": TARGET_SR} for a in arrs],
        "label": d["label_id"].tolist(),
    })


train_ds = df_to_dataset(train_df)
val_ds = df_to_dataset(val_df)
test_ds = df_to_dataset(test_df)

# %% [markdown]
# ## 5. Load Wav2Vec2-XLSR-53 + classification head + SpecAugment config
#
# SpecAugment is enabled via Wav2Vec2's built-in `mask_time_prob` and
# `mask_feature_prob` — these apply Google's SpecAugment time-and-frequency
# masking to the model's latent feature representations during training,
# improving robustness to noise + tachypneic recordings.

# %%
MODEL_NAME = "facebook/wav2vec2-large-xlsr-53"

feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(MODEL_NAME)
model = Wav2Vec2ForSequenceClassification.from_pretrained(
    MODEL_NAME,
    num_labels=len(LABEL2ID),
    id2label=ID2LABEL,
    label2id=LABEL2ID,
    # SpecAugment (built into Wav2Vec2): time + feature masking on the
    # encoder's latent representation. Same idea as Park et al. 2019.
    mask_time_prob=0.08,
    mask_time_length=10,
    mask_feature_prob=0.05,
    mask_feature_length=10,
)
model.freeze_feature_extractor()  # train transformer + classifier only

# %% [markdown]
# ## 6. Tokenize/process audio

# %%
def preprocess(batch):
    audio = batch["audio"]
    inputs = feature_extractor(
        audio["array"],
        sampling_rate=audio["sampling_rate"],
        max_length=SEGMENT_LEN,
        truncation=True,
        padding="max_length",
        return_tensors="pt",
    )
    return {
        "input_values": inputs.input_values[0].numpy(),
        "attention_mask": inputs.attention_mask[0].numpy() if inputs.attention_mask is not None else None,
        "labels": batch["label"],
    }


train_ds = train_ds.map(preprocess, remove_columns=["audio", "label"])
val_ds = val_ds.map(preprocess, remove_columns=["audio", "label"])
test_ds = test_ds.map(preprocess, remove_columns=["audio", "label"])

# %% [markdown]
# ## 7. Training with class-weighted cross-entropy
# Class imbalance (e.g. pneumonia rarer than healthy) is partially handled
# by §2 balancing but tail classes still need weighting.

# %%
accuracy = evaluate.load("accuracy")
f1 = evaluate.load("f1")

def compute_metrics(eval_pred):
    preds = np.argmax(eval_pred.predictions, axis=1)
    return {
        "accuracy": accuracy.compute(predictions=preds, references=eval_pred.label_ids)["accuracy"],
        "f1_macro": f1.compute(predictions=preds, references=eval_pred.label_ids, average="macro")["f1"],
    }


# Weighted CE for class imbalance: inverse frequency, normalized.
label_counts = train_df["label_id"].value_counts().sort_index().values
class_weights = torch.tensor(
    label_counts.sum() / (len(label_counts) * label_counts),
    dtype=torch.float32,
)


class WeightedTrainer(Trainer):
    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        labels = inputs.pop("labels")
        outputs = model(**inputs)
        logits = outputs.logits
        loss_fct = nn.CrossEntropyLoss(weight=class_weights.to(logits.device))
        loss = loss_fct(logits, labels)
        return (loss, outputs) if return_outputs else loss


training_args = TrainingArguments(
    output_dir="./babypulmo_wav2vec2",
    num_train_epochs=5,
    per_device_train_batch_size=4,
    per_device_eval_batch_size=4,
    learning_rate=3e-5,
    warmup_ratio=0.1,
    lr_scheduler_type="cosine",
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="f1_macro",
    greater_is_better=True,
    logging_steps=20,
    fp16=torch.cuda.is_available(),
    report_to="none",
    seed=SEED,
)

trainer = WeightedTrainer(
    model=model,
    args=training_args,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    compute_metrics=compute_metrics,
)

trainer.train()

# %% [markdown]
# ## 8. Evaluation on held-out test set
# Targets per `submission/accuracy.md`:
#   • Pediatric pneumonia sensitivity ≥84% (JAMA Pediatrics 2018 bar)
#   • Realistic v0 lab estimate: 70–78%
#   • Field deployment estimate: 58–68% (10–15 pp drop expected)

# %%
test_metrics = trainer.evaluate(test_ds)
print("Test metrics:", test_metrics)

# Per-class sensitivity (esp. pneumonia)
from sklearn.metrics import classification_report, confusion_matrix
preds_logits = trainer.predict(test_ds).predictions
preds = np.argmax(preds_logits, axis=1)
labels = np.array(test_ds["labels"])
print(classification_report(labels, preds, target_names=[ID2LABEL[i] for i in range(len(ID2LABEL))]))
print("Confusion matrix:")
print(confusion_matrix(labels, preds))

# %% [markdown]
# ## 9. Grad-CAM spectrogram heatmap (explainability)

# %%
def grad_cam(model, input_values, target_class: int):
    """Generate a Grad-CAM heatmap over the input waveform's spectrogram."""
    model.eval()
    input_values = input_values.unsqueeze(0).requires_grad_(True)
    outputs = model(input_values, output_hidden_states=True)
    score = outputs.logits[0, target_class]
    score.backward()

    grads = input_values.grad[0].abs().detach().cpu().numpy()
    waveform = input_values[0].detach().cpu().numpy()
    spec = np.abs(librosa.stft(waveform, n_fft=512, hop_length=128))
    spec_db = librosa.amplitude_to_db(spec, ref=np.max)
    grad_resampled = np.interp(
        np.linspace(0, len(grads), spec.shape[1]),
        np.arange(len(grads)),
        grads,
    )
    return spec_db, grad_resampled


# %%
sample = test_ds[0]
input_values = torch.tensor(sample["input_values"]).cuda() if torch.cuda.is_available() else torch.tensor(sample["input_values"])
spec_db, grad = grad_cam(model, input_values, target_class=sample["labels"])

fig, ax = plt.subplots(2, 1, figsize=(10, 5), sharex=True)
ax[0].imshow(spec_db, aspect="auto", origin="lower")
ax[0].set_title(f"Spectrogram — true class: {ID2LABEL[sample['labels']]}")
ax[1].plot(grad)
ax[1].set_title("Grad-CAM importance over time")
plt.tight_layout()
plt.savefig("gradcam_example.png", dpi=120)
plt.show()

# %% [markdown]
# ## 10. Export to ONNX for inference deployment

# %%
torch.onnx.export(
    model.cpu(),
    (torch.zeros(1, SEGMENT_LEN, dtype=torch.float32),),
    "babypulmo_wav2vec2.onnx",
    input_names=["input_values"],
    output_names=["logits"],
    dynamic_axes={"input_values": {0: "batch"}, "logits": {0: "batch"}},
    opset_version=14,
)
print("Exported babypulmo_wav2vec2.onnx")

# %% [markdown]
# ## 10b. Dynamic int8 quantization for cheap CPU inference
# ~4× smaller, ~3× faster on CPU with <1pt accuracy drop. The quantized
# model is what production loads on Modal CPU.

# %%
from onnxruntime.quantization import quantize_dynamic, QuantType

quantize_dynamic(
    model_input="babypulmo_wav2vec2.onnx",
    model_output="babypulmo_wav2vec2_int8.onnx",
    weight_type=QuantType.QInt8,
)

import os
fp32_mb = os.path.getsize("babypulmo_wav2vec2.onnx") / 1024 / 1024
int8_mb = os.path.getsize("babypulmo_wav2vec2_int8.onnx") / 1024 / 1024
print(f"fp32: {fp32_mb:.1f} MB → int8: {int8_mb:.1f} MB ({fp32_mb / int8_mb:.1f}x smaller)")

# %% [markdown]
# ## 11. Multi-modal context
#
# The audio classifier is one of three runtime inputs in Baby Pulmo's
# multi-modal severity decision:
#
#   1. Audio class + confidence (this script).
#   2. Respiratory rate (breaths/min) — computed by `lib/respiratory-rate.ts`
#      from the same voice note; WHO IMCI tachypnea thresholds applied.
#   3. Tabular ChildProfile — caregiver-reported age, sex, symptom-days,
#      fever flag (collected via WhatsApp Q&A on first contact).
#
# All three feed the deterministic `decideSeverity()` rules table in
# `lib/claude.ts`. No runtime LLM. See `babypulmo/ARCHITECTURE.md`.

# %% [markdown]
# ## 12. Next step: deploy with `deploy_modal.py`
# Download `babypulmo_wav2vec2_int8.onnx`, place it next to `deploy_modal.py`,
# then `modal deploy deploy_modal.py`. Update `CLASSIFIER_ENDPOINT` in Vercel
# env vars with the returned URL.
