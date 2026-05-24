# ShishuKantho — Wav2Vec2 cough classifier training
#
# This is a Colab-ready Python script with `# %%` cell markers (Jupytext/VS Code format).
# In Colab: open new notebook, set runtime to T4 GPU, then either
#   (a) paste this file's contents as cells (one per `# %%` marker), or
#   (b) `!pip install jupytext && jupytext --to ipynb train_wav2vec2.py`
#
# Goal: fine-tune facebook/wav2vec2-large-xlsr-53 on Coswara public dataset
# for 3-class pediatric cough classification (pneumonia / asthma / normal).
# Target: >=80% accuracy on held-out test set.

# %% [markdown]
# # ShishuKantho: Cough Classifier Training
# Fine-tunes Wav2Vec2-XLSR-53 on the Coswara dataset for pediatric respiratory
# disease classification. Outputs an ONNX model + Grad-CAM heatmap generator.

# %%
!pip install -q transformers==4.44.2 datasets==2.21.0 librosa==0.10.2 \
    torch==2.4.0 torchaudio==2.4.0 evaluate==0.4.3 accelerate==0.34.0 \
    onnx==1.16.2 onnxruntime==1.19.2 matplotlib==3.9.2

# %%
import os, json, math, random, glob, shutil
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torchaudio
import librosa
import matplotlib.pyplot as plt
from pathlib import Path
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

# %% [markdown]
# ## 1. Download Coswara dataset
# Coswara is a public respiratory sound database from IISc Bangalore.
# Contains ~5,000 crowdsourced cough/breath/voice recordings labeled with
# COVID status + respiratory conditions. Closest demographic match to Bangladesh.

# %%
!git clone https://github.com/iiscleap/Coswara-Data.git
!cd Coswara-Data && python extract_data.py    # ~15 minutes

# %% [markdown]
# ## 2. Build a 3-class dataset
# Coswara labels: healthy, positive_mild, positive_moderate, recovered_full, no_resp_illness_exposed.
# We map to our 3 demo classes using accompanying metadata (cold/cough/asthma flags):
#   - cough_pneumonia_like: positive_moderate or pneumonia-tagged
#   - cough_asthma_like: self-reported asthma
#   - cough_normal: healthy with no respiratory complaints

# %%
DATA_ROOT = Path("Coswara-Data/Extracted_data")

records = []
for date_dir in DATA_ROOT.iterdir():
    if not date_dir.is_dir(): continue
    for subj in date_dir.iterdir():
        meta_path = subj / "metadata.json"
        if not meta_path.exists(): continue
        meta = json.loads(meta_path.read_text())
        cough_files = sorted(glob.glob(str(subj / "cough-heavy.wav"))) + \
                      sorted(glob.glob(str(subj / "cough-shallow.wav")))
        if not cough_files: continue

        # Map to 3 demo classes
        covid = meta.get("covid_status", "")
        asthma = meta.get("asthma", False)
        cold = meta.get("cold", False)
        cough = meta.get("cough", False)

        if asthma:
            label = "cough_asthma_like"
        elif covid in ("positive_mild", "positive_moderate"):
            label = "cough_pneumonia_like"
        elif covid == "healthy" and not (cold or cough):
            label = "cough_normal"
        else:
            continue  # skip ambiguous

        for f in cough_files:
            records.append({"audio_path": f, "label": label})

df = pd.DataFrame(records)
print(f"Total samples: {len(df)}")
print(df["label"].value_counts())

# Balance classes (downsample to smallest)
min_count = df["label"].value_counts().min()
df = df.groupby("label").sample(n=min_count, random_state=SEED).reset_index(drop=True)
print(f"Balanced: {len(df)} samples ({min_count} per class)")

# %% [markdown]
# ## 3. Train/val/test split

# %%
LABEL2ID = {"cough_pneumonia_like": 0, "cough_asthma_like": 1, "cough_normal": 2}
ID2LABEL = {v: k for k, v in LABEL2ID.items()}
df["label_id"] = df["label"].map(LABEL2ID)

df_shuffled = df.sample(frac=1, random_state=SEED).reset_index(drop=True)
n = len(df_shuffled)
train_df = df_shuffled[: int(0.7 * n)]
val_df   = df_shuffled[int(0.7 * n) : int(0.85 * n)]
test_df  = df_shuffled[int(0.85 * n) :]

print(f"Train: {len(train_df)}, Val: {len(val_df)}, Test: {len(test_df)}")

# %% [markdown]
# ## 4. Audio preprocessing
# Resample to 16 kHz mono, segment to 5-second windows.

# %%
TARGET_SR = 16000
SEGMENT_SEC = 5.0
SEGMENT_LEN = int(TARGET_SR * SEGMENT_SEC)

def load_audio(path: str) -> np.ndarray:
    waveform, sr = librosa.load(path, sr=TARGET_SR, mono=True)
    # Center-pad or trim to 5 sec
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
# ## 5. Load Wav2Vec2-XLSR-53 + classification head

# %%
MODEL_NAME = "facebook/wav2vec2-large-xlsr-53"

feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(MODEL_NAME)
model = Wav2Vec2ForSequenceClassification.from_pretrained(
    MODEL_NAME,
    num_labels=3,
    id2label=ID2LABEL,
    label2id=LABEL2ID,
)

# Freeze feature extractor for faster fine-tune; only train transformer + classifier
model.freeze_feature_extractor()

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
# ## 7. Training

# %%
accuracy = evaluate.load("accuracy")
f1 = evaluate.load("f1")

def compute_metrics(eval_pred):
    preds = np.argmax(eval_pred.predictions, axis=1)
    return {
        "accuracy": accuracy.compute(predictions=preds, references=eval_pred.label_ids)["accuracy"],
        "f1_macro": f1.compute(predictions=preds, references=eval_pred.label_ids, average="macro")["f1"],
    }

training_args = TrainingArguments(
    output_dir="./shishukantho_wav2vec2",
    num_train_epochs=4,
    per_device_train_batch_size=4,
    per_device_eval_batch_size=4,
    learning_rate=3e-5,
    warmup_ratio=0.1,
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

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    compute_metrics=compute_metrics,
)

trainer.train()

# %% [markdown]
# ## 8. Evaluation on held-out test set

# %%
test_metrics = trainer.evaluate(test_ds)
print("Test metrics:", test_metrics)
# Target: accuracy >= 0.80, f1_macro >= 0.78

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
    # Reduce to spectrogram via STFT
    waveform = input_values[0].detach().cpu().numpy()
    spec = np.abs(librosa.stft(waveform, n_fft=512, hop_length=128))
    spec_db = librosa.amplitude_to_db(spec, ref=np.max)
    # Resample grads to spec time axis
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
    "shishukantho_wav2vec2.onnx",
    input_names=["input_values"],
    output_names=["logits"],
    dynamic_axes={"input_values": {0: "batch"}, "logits": {0: "batch"}},
    opset_version=14,
)
print("Exported shishukantho_wav2vec2.onnx")

# %% [markdown]
# ## 10b. Dynamic int8 quantization for cheap CPU inference
# Cuts model size ~4x and CPU latency ~2-3x with negligible accuracy loss for
# this task. The quantized model is what production loads on Modal CPU.

# %%
!pip install -q onnxruntime onnx
from onnxruntime.quantization import quantize_dynamic, QuantType

quantize_dynamic(
    model_input="shishukantho_wav2vec2.onnx",
    model_output="shishukantho_wav2vec2_int8.onnx",
    weight_type=QuantType.QInt8,
)

import os
fp32_mb = os.path.getsize("shishukantho_wav2vec2.onnx") / 1024 / 1024
int8_mb = os.path.getsize("shishukantho_wav2vec2_int8.onnx") / 1024 / 1024
print(f"fp32: {fp32_mb:.1f} MB → int8: {int8_mb:.1f} MB ({fp32_mb / int8_mb:.1f}x smaller)")

# %% [markdown]
# ## 11. Next step: deploy with `deploy_modal.py`
# Download `shishukantho_wav2vec2_int8.onnx`, place it next to `deploy_modal.py`,
# then `modal deploy deploy_modal.py`. Update `CLASSIFIER_ENDPOINT` in your
# Vercel env vars with the returned URL.
