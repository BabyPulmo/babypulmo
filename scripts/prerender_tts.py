#!/usr/bin/env python3
"""Offline Bangla TTS for the caregiver audio cache.

Model: ai4bharat/indic-parler-tts (Apache-2.0, commercial use allowed). Runs once
on a laptop; production only serves the resulting MP3s from Supabase Storage.

  python prerender_tts.py tts-manifest.json out_dir/      # -> out_dir/<hash>.mp3
Needs: parler-tts, soundfile, torch, ffmpeg on PATH, a Hugging Face login with
the model's (auto-approved) terms accepted.
"""
import json, os, subprocess, sys

import soundfile as sf
import torch
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer

MODEL = "ai4bharat/indic-parler-tts"
DESCRIPTION = os.environ.get(
    "BP_VOICE_DESCRIPTION",
    "Aditi speaks in a calm, warm and reassuring tone at a moderate pace, with very clear audio "
    "and no background noise.",
)


def main():
    manifest, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    entries = json.load(open(manifest, encoding="utf-8"))
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL).to(device)
    tok = AutoTokenizer.from_pretrained(MODEL)
    desc_tok = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
    desc = desc_tok(DESCRIPTION, return_tensors="pt").to(device)

    for e in entries:
        mp3 = os.path.join(out, e["hash"] + ".mp3")
        if os.path.exists(mp3):
            print("skip", e["key"]); continue
        torch.manual_seed(42)
        prompt = tok(e["text"], return_tensors="pt").to(device)
        with torch.no_grad():
            audio = model.generate(
                input_ids=desc.input_ids, attention_mask=desc.attention_mask,
                prompt_input_ids=prompt.input_ids, prompt_attention_mask=prompt.attention_mask,
            )
        wav = os.path.join(out, e["hash"] + ".wav")
        sf.write(wav, audio.cpu().numpy().squeeze(), model.config.sampling_rate)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-af", "loudnorm=I=-16:TP=-1.5",
                        "-ar", "44100", "-ac", "1", "-b:a", "96k", mp3], check=True)
        os.remove(wav)
        print("ok", e["key"], mp3)


if __name__ == "__main__":
    main()
