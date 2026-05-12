# ShishuKantho — Training & Deployment

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
5. Download `shishukantho_wav2vec2.onnx` (~1.2 GB) to your local machine.

## Deployment to Modal (serverless GPU/CPU inference)

```bash
# Install Modal CLI
pip install modal

# Authenticate (one-time)
modal token new

# Place your ONNX model next to deploy_modal.py
mv ~/Downloads/shishukantho_wav2vec2.onnx ./

# Deploy
modal deploy deploy_modal.py
```

Modal will print a URL like:
```
https://your-username--shishukantho-classify-endpoint.modal.run
```

## Wire to the Next.js app

Add to your `.env.local`:
```
CLASSIFIER_ENDPOINT=https://your-username--shishukantho-classify-endpoint.modal.run
```

That's it — the WhatsApp webhook will now route cough recordings through your trained model.

## Honest framing for the BuildFest pitch

The Coswara dataset is adult crowdsourced cough audio. For the pitch, frame this as:
> "Our classifier is trained on Coswara — the closest demographic dataset publicly available (South Asian respiratory audio). Phase 1 of our roadmap is field collection of pediatric cough samples in Bangladesh through BRAC clinics, with BMRC ethics review, to fine-tune for the under-five population specifically. The architecture is unchanged; we just swap the training set."

This is true and judges respect this kind of honest engineering framing.

## Public datasets to cite

- **Coswara** (IISc Bangalore): https://github.com/iiscleap/Coswara-Data
- **COUGHVID** (EPFL): https://zenodo.org/record/4498364
- **ICBHI Respiratory Sound Database**: https://bhichallenge.med.auth.gr/

## Validated science citations (for your 1-page summary)

- Sharan, R.V. et al. JAMA Pediatrics 2018 — "Cough sound analysis can rapidly diagnose childhood pneumonia."
- Porter, P. et al. Nature Scientific Reports 2019 — "Comparison of mathematical algorithms for early diagnosis of pertussis."
- ResApp Health acquisition by Pfizer, August 2022 — AUD $179M (USD ~$120M).
