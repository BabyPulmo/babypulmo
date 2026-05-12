const VOICE_ID = process.env.ELEVENLABS_BANGLA_VOICE_ID;
const API_KEY = process.env.ELEVENLABS_API_KEY;

// Synthesizes Bangla text into MP3 audio.
// Uses ElevenLabs multilingual v2 model which supports Bangla.
// Returns the raw MP3 buffer.
export async function synthesizeBangla(text: string): Promise<Buffer> {
  if (!API_KEY || !VOICE_ID) {
    throw new Error("ELEVENLABS_API_KEY and ELEVENLABS_BANGLA_VOICE_ID must be set");
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.75,
          style: 0.2,
          use_speaker_boost: true
        }
      })
    }
  );

  if (!res.ok) {
    throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
