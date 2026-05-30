# Baby Pulmo — Training & Deployment

## Notebooks in this directory

| Notebook | Purpose |
|---|---|
| `train_wav2vec2.py` | Fine-tune Wav2Vec2-XLSR-53 on the **fused pediatric subset** of Coswara + COUGHVID + ICBHI (age ≤ 5 yr) with 50–2500 Hz bandpass + SpecAugment + class-weighted CE. Outputs int8 ONNX. |
| `deploy_modal.py` | Deploy the int8 ONNX classifier to Modal serverless CPU (2 vCPU / 2 GB). Returns class + confidence + Grad-CAM + auto-measured respiratory rate. |
| `cxr_vision_modal.py` *(Phase 3A)* | Deploy TorchXrayVision DenseNet121 (pretrained on CheXpert + NIH ChestX-ray14) as a Modal endpoint. Returns `{pneumonia_prob, consolidation_prob, no_finding_prob}` for the multi-modal severity decision. |
| `deploy_whisper_modal.py` *(Phase 2F)* | Deploy OpenAI Whisper large-v3 on Modal T4 GPU for Bangla onboarding ASR ("say child's age"). |
| `distill_to_mobile.py` *(Phase 3C)* | Knowledge-distill the Wav2Vec2 teacher into a MobileNetV3 student over mel-spectrograms, export to ONNX → GGUF Q4_K_M for on-device Android inference via llama.cpp. |

## Training (Google Colab, ~2 hours on T4 GPU)

1. Open [colab.research.google.com](https://colab.research.google.com)
2. New notebook → Runtime → Change runtime type → **T4 GPU**
3. Convert `train_wav2vec2.py` to a notebook:
   ```bash
   !pip install jupytext
   !jupytext --to ipynb train_wav2vec2.py
   ```
   Or copy/paste each `# %%` cell into a fresh notebook cell.
4. Run all cells. Expect ~2 hours end-to-end.
5. Download `babypulmo_wav2vec2.onnx` (~1.2 GB) to your local machine.

## Deployment to Modal (serverless GPU/CPU inference)

```bash
# Install Modal CLI
pip install modal

# Authenticate (one-time)
modal token new

# Place your ONNX model next to deploy_modal.py
mv ~/Downloads/babypulmo_wav2vec2.onnx ./

# Deploy
modal deploy deploy_modal.py
```

Modal will print a URL like:
```
https://your-username--babypulmo-classify-endpoint.modal.run
```

## Wire to the Next.js app

Add to your `.env.local`:
```
CLASSIFIER_ENDPOINT=https://your-username--babypulmo-classify-endpoint.modal.run
```

That's it — the WhatsApp webhook will now route cough recordings through your trained model.

## Honest framing for the BuildFest pitch

`train_wav2vec2.py` filters Coswara, COUGHVID, and ICBHI to the pediatric subset (age ≤ 5 yr) using each dataset's age metadata. The combined pediatric sample count is documented in the script's §2 output. For the pitch, frame this as:
> "Our classifier is trained on the fused pediatric subset of Coswara + COUGHVID + ICBHI — the three largest publicly available respiratory-sound datasets with age metadata, filtered to under-fives. Phase 1 of our roadmap is field collection of additional pediatric cough samples in Bangladesh through BRAC clinics, with BMRC ethics review, plus federated fine-tuning with partner hospitals (Flower scaffold in `babypulmo/federated/`) so hospital pediatric ward audio can refine the model without leaving the hospital network."

This is true and judges respect this kind of honest engineering framing.

## Public datasets to cite

- **Coswara** (IISc Bangalore): https://github.com/iiscleap/Coswara-Data
- **COUGHVID** (EPFL): https://zenodo.org/record/4498364
- **ICBHI Respiratory Sound Database**: https://bhichallenge.med.auth.gr/

## Validated science citations (for your 1-page summary)

- Sharan, R.V. et al. JAMA Pediatrics 2018 — "Cough sound analysis can rapidly diagnose childhood pneumonia."
- Porter, P. et al. Nature Scientific Reports 2019 — "Comparison of mathematical algorithms for early diagnosis of pertussis."
- ResApp Health acquisition by Pfizer, August 2022 — AUD $179M (USD ~$120M).
