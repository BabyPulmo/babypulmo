import { createHash } from "crypto";
import { supabaseAdmin } from "./supabase";
import type { CoughClass, Severity } from "./types";

const GCP_TTS_API_KEY = process.env.GCP_TTS_API_KEY;
const GCP_TTS_VOICE = process.env.GCP_TTS_VOICE ?? "bn-IN-Wavenet-A";
const CACHE_BUCKET = process.env.TTS_CACHE_BUCKET ?? "recordings";
const CACHE_PREFIX = "tts-cache";

// Hand-written rural-friendly Bangla scripts for the 7 (class, severity) tuples
// the rules layer can produce. When a classification matches one of these, the
// webhook can skip Claude AND hit the pre-warmed TTS cache — saving ~$0.054 per
// call. Romanized Bangla matches the convention used in the webhook greetings.
// Should be reviewed by a Bangla-native CHW before clinical deployment.
export const STOCK_BANGLA: Partial<Record<`${CoughClass}:${Severity}`, string>> = {
  "pneumonia:critical":
    "Apnar shishur cough-e pneumonia-r alamat dekha jacche. Ekjon CHW alert peyechen ebong drukito ashben. Doya kore shishuke shojaye boshiye rakhun ebong tarol khabar din. Joruri obostha-ye 999 kol korun. Ei tothyo doctor-er bikolpo noy.",
  "bronchiolitis:high":
    "Apnar shishur cough-e bronchiolitis-er alamat dekha jacche. Ekjon CHW alert peyechen ebong ashben. Shishur buk joto pora hocche kina dekhun. Bhoyer kichu nei, amra apnar pashe achi. Ei tothyo doctor-er bikolpo noy.",
  "croup:high":
    "Apnar shishur cough-e croup-er alamat dekha jacche. Ekjon CHW alert peyechen. Shishuke garam jol-er bhapra-r kachhe niye jaan, eta srash sojha kore. Bhoyer kichu nei. Ei tothyo doctor-er bikolpo noy.",
  "pertussis:high":
    "Apnar shishur cough-e whooping cough-er alamat dekha jacche. Agami 24 ghonta-r moddhe doctor-er kachhe niye jaan. CHW-ke jananu hoyeche. Apnar shishu shighroi sustho hobe inshallah. Ei tothyo doctor-er bikolpo noy.",
  "asthma:moderate":
    "Apnar shishur cough-e asthma-r alamat dekha jacche. Doya kore agami 24 ghonta-r moddhe doctor-er kachhe niye jaan. Shishuke dhumpaan ar dhula theke dure rakhun. Ei tothyo doctor-er bikolpo noy.",
  "normal:low":
    "Alhamdulillah, apnar shishur cough-e gambhir kichu paowa jaayni. Agami 24 ghonta lokkho korun. Joto bere gele abar voice pathan. Apnar shishu bhalo ache. Ei tothyo doctor-er bikolpo noy.",
  "insufficient_quality:low":
    "Audio sposhto chhilo na. Doya kore aro shanto jaygay giye 30 second-er ekti spoint cough record kore abar pathan. Dhonnobad."
};

export function getStockBangla(c: CoughClass, s: Severity): string | null {
  return STOCK_BANGLA[`${c}:${s}` as keyof typeof STOCK_BANGLA] ?? null;
}

function hashKey(text: string): string {
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
    throw new Error("GCP_TTS_API_KEY must be set");
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
