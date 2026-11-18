import { createHash } from "crypto";
import { supabaseAdmin } from "./supabase";
import type { CoughClass, Severity } from "./types";

const GCP_TTS_API_KEY = process.env.GCP_TTS_API_KEY;
const GCP_TTS_VOICE = process.env.GCP_TTS_VOICE ?? "bn-IN-Wavenet-A";
const CACHE_BUCKET = process.env.TTS_CACHE_BUCKET ?? "recordings";
const CACHE_PREFIX = "tts-cache";

// Bangla guidance scripts for the 7 (class, severity) tuples the rules layer can
// produce. Loaded at module init from STOCK_BANGLA_JSON env var (private content,
// clinician-reviewed). See BabyPulmo/clinical-content repo for the canonical
// values. If unset, decideSeverity callers fall back to Claude — slower and more
// expensive but functional.
function loadStockBangla(): Partial<Record<`${CoughClass}:${Severity}`, string>> {
  const raw = process.env.STOCK_BANGLA_JSON;
  if (!raw) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[tts] STOCK_BANGLA_JSON not set — every call will hit Claude");
    }
    return {};
  }
  try {
    return JSON.parse(raw) as Partial<Record<`${CoughClass}:${Severity}`, string>>;
  } catch (e) {
    console.error("[tts] STOCK_BANGLA_JSON parse error:", e);
    return {};
  }
}

export const STOCK_BANGLA = loadStockBangla();

export function getStockBangla(c: CoughClass, s: Severity): string | null {
  return STOCK_BANGLA[`${c}:${s}` as keyof typeof STOCK_BANGLA] ?? null;
}

// Fallbacks are pre-rendered into the audio cache alongside the stock scripts
// (scripts/tts-manifest.ts), so they play as audio even with no TTS provider.
export const GENERIC_BANGLA =
  "এই মুহূর্তে নির্দিষ্ট নির্দেশনা পাওয়া যায়নি — নিকটস্থ স্বাস্থ্যকর্মীর সঙ্গে যোগাযোগ করুন।";

export const SCREENING_UNAVAILABLE_BANGLA =
  "দুঃখিত, এই মুহূর্তে কাশি পরীক্ষার সেবাটি সাময়িকভাবে বন্ধ আছে। আপনার শিশুর দ্রুত শ্বাস, শ্বাসকষ্ট বা জ্বর থাকলে এখনই নিকটস্থ স্বাস্থ্যকর্মী বা হাসপাতালে যোগাযোগ করুন। জরুরি প্রয়োজনে ৯৯৯ নম্বরে কল করুন।";

export function hashKey(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 32);
}

export interface CachedTtsResult {
  url: string;
  cached: boolean;
  bytes: number;
  path: string;
}

// Returns a signed Supabase URL for the Bangla audio of `text`, using
// content-hash caching. Repeated calls with the same `text` skip ElevenLabs
// entirely. Pre-warm with `warmStockCache()` on deploy.
export async function synthesizeBanglaCached(text: string): Promise<CachedTtsResult> {
  const key = hashKey(text);
  const path = `${CACHE_PREFIX}/${key}.mp3`;

  const list = await supabaseAdmin.storage
    .from(CACHE_BUCKET)
    .list(CACHE_PREFIX, { search: `${key}.mp3`, limit: 1 });

  const existing = list.data?.[0];
  if (existing) {
    const { data: signed } = await supabaseAdmin.storage
      .from(CACHE_BUCKET)
      .createSignedUrl(path, 3600);
    if (signed?.signedUrl) {
      return {
        url: signed.signedUrl,
        cached: true,
        bytes: (existing.metadata?.size as number | undefined) ?? 0,
        path
      };
    }
  }

  const audio = await synthesizeBangla(text);
  const upload = await supabaseAdmin.storage
    .from(CACHE_BUCKET)
    .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
  if (upload.error) throw upload.error;

  const { data: signed } = await supabaseAdmin.storage
    .from(CACHE_BUCKET)
    .createSignedUrl(path, 3600);

  return {
    url: signed?.signedUrl ?? "",
    cached: false,
    bytes: audio.length,
    path
  };
}

// Pre-synthesizes every stock script so the next 12 calls hit the cache.
// Call once after deploy, or from a Next.js setup route.
export async function warmStockCache(): Promise<{ warmed: number; alreadyCached: number }> {
  let warmed = 0;
  let alreadyCached = 0;
  for (const text of Object.values(STOCK_BANGLA)) {
    if (!text) continue;
    const result = await synthesizeBanglaCached(text);
    if (result.cached) alreadyCached++;
    else warmed++;
  }
  return { warmed, alreadyCached };
}

// Raw Google Cloud Text-to-Speech synthesis using the bn-IN WaveNet voice.
// ~$16/1M chars (≈ $0.005 per 300-char Bangla utterance). Most callers should
// use synthesizeBanglaCached instead so repeat scripts cost nothing.
export async function synthesizeBangla(text: string): Promise<Buffer> {
  if (!GCP_TTS_API_KEY) {
    throw new Error(
      "No cached audio for this text and no GCP_TTS_API_KEY — pre-render it with scripts/prerender_tts.py"
    );
  }

  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GCP_TTS_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: "bn-IN",
          name: GCP_TTS_VOICE,
          ssmlGender: "FEMALE"
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 0.92,
          pitch: 0
        }
      })
    }
  );

  if (!res.ok) {
    throw new Error(`GCP TTS ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { audioContent: string };
  return Buffer.from(data.audioContent, "base64");
}
