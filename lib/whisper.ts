// Whisper Bangla ASR client — calls the Modal endpoint deployed via
// colab/deploy_whisper_modal.py to transcribe caregiver onboarding voice
// replies (e.g. "say your child's age in years").
//
// Voice-only onboarding makes Baby Pulmo inclusive for caregivers who can
// read but are not comfortable typing Bangla, or who can only speak.

const WHISPER_ENDPOINT = process.env.WHISPER_ENDPOINT;
const WHISPER_API_KEY = process.env.WHISPER_API_KEY;

export interface TranscriptResult {
  text: string;
  language: string;
  segments?: Array<{ start: number; end: number; text: string }>;
}

export async function transcribeBangla(audioUrl: string): Promise<TranscriptResult> {
  if (!WHISPER_ENDPOINT) {
    return {
      text: "[whisper not configured — returning empty transcript]",
      language: "bn"
    };
  }
  const res = await fetch(WHISPER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(WHISPER_API_KEY ? { Authorization: `Bearer ${WHISPER_API_KEY}` } : {})
    },
    body: JSON.stringify({ audio_url: audioUrl, language: "bn" })
  });
  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`);
  return (await res.json()) as TranscriptResult;
}

// Heuristic Bangla→integer parser for the onboarding "child's age in years"
// reply. Handles "ek bochor", "2 bochor", "doy bochor", "tin bochor", and
// numeric digits. Returns null when no plausible integer is found, in which
// case the webhook falls back to asking the caregiver to type.
export function parseBanglaAgeYears(text: string): number | null {
  const cleaned = text.trim().toLowerCase();

  // 1. Western numerals
  const numMatch = cleaned.match(/\b(\d{1,2})\b/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 0 && n <= 18) return n;
  }

  // 2. Bangla numerals (০-৯)
  const bnDigits = "০১২৩৪৫৬৭৮৯";
  const bnNumMatch = cleaned.match(/[০-৯]+/);
  if (bnNumMatch) {
    const n = parseInt(
      [...bnNumMatch[0]].map((c) => bnDigits.indexOf(c)).join(""),
      10
    );
    if (n >= 0 && n <= 18) return n;
  }

  // 3. Bangla number words (romanized + Bangla script — partial set)
  const words: Record<string, number> = {
    ek: 1, "এক": 1,
    dui: 2, doi: 2, doy: 2, "দুই": 2,
    tin: 3, "তিন": 3,
    char: 4, "চার": 4,
    panch: 5, paach: 5, "পাঁচ": 5,
    choy: 6, choi: 6, "ছয়": 6
  };
  for (const [word, n] of Object.entries(words)) {
    if (cleaned.includes(word)) return n;
  }
  return null;
}
