# Baby Pulmo — Whisper Bangla onboarding ASR (Modal deploy)
# ──────────────────────────────────────────────────────────────────────────
# Modal serverless endpoint hosting OpenAI Whisper large-v3 for Bangla
# automatic speech recognition. Used by the WhatsApp onboarding flow when
# a caregiver answers the "say your child's age in years" Bangla audio
# prompt with a voice reply instead of a text reply.
#
# Rural Bangladesh has mixed text literacy; voice-only onboarding is the
# inclusive choice.
#
# v0 scaffold for prelim demo. Full pilot deployment Q3 2026.

import modal

app = modal.App("babypulmo-whisper")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "openai-whisper==20240930",
        "torch==2.4.0",
        "torchaudio==2.4.0",
        "soundfile==0.12.1",
        "ffmpeg-python==0.2.0",
    )
    .apt_install("ffmpeg")
)

MODEL_NAME = "large-v3"  # Bangla performs noticeably better on large-v3 vs medium


@app.cls(
    image=image,
    gpu="T4",  # ~$0.30/hr; large-v3 in fp16 fits in 16GB
    container_idle_timeout=300,
    timeout=300,
)
class WhisperBangla:
    @modal.enter()
    def load(self):
        import whisper
        self.model = whisper.load_model(MODEL_NAME)

    @modal.method()
    def transcribe(self, audio_url: str, language: str = "bn") -> dict:
        """Download audio from a signed URL, transcribe via Whisper, return text + segments."""
        import requests
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as f:
            r = requests.get(audio_url, timeout=30)
            r.raise_for_status()
            f.write(r.content)
            audio_path = f.name

        # transcribe — language='bn' forces Bangla decoder priors
        result = self.model.transcribe(
            audio_path,
            language=language,
            fp16=True,
            temperature=0.0,
            no_speech_threshold=0.6,
        )
        return {
            "text": result["text"].strip(),
            "language": result["language"],
            "segments": [
                {"start": s["start"], "end": s["end"], "text": s["text"]}
                for s in result.get("segments", [])
            ],
        }


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def transcribe_endpoint(item: dict):
    """HTTPS POST endpoint the Vercel webhook calls.

    Request: {"audio_url": "https://...", "language": "bn"}
    Response: {"text": "...", "language": "bn", "segments": [...]}
    """
    audio_url = item.get("audio_url")
    if not audio_url:
        return {"error": "audio_url required"}
    language = item.get("language", "bn")
    return WhisperBangla().transcribe.remote(audio_url, language)
