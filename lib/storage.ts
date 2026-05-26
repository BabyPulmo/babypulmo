import { supabaseAdmin } from "./supabase";
import { buildAudioKey, assertWithinSize } from "./audio-path";

// Caregiver cough audio is sensitive. All caregiver-audio writes go through
// uploadCaregiverAudio: per-caregiver hashed prefix (no plaintext phone in the
// path), date partitioning, a 5MB reject, and short-lived signed URLs.
// Path/size logic lives in ./audio-path (kept Supabase-free for unit testing).

export { FileTooLargeError } from "./audio-path";

const BUCKET = "recordings";
const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour — enough for CHW playback

export interface UploadCaregiverAudioParams {
  buffer: Buffer;
  mimeType: string;
  caregiverPhone: string; // raw WhatsApp number — hashed, never stored in the path
  messageId: string; // Meta message id, used as the filename
}

export interface UploadCaregiverAudioResult {
  storagePath: string;
  signedUrl: string;
}

export async function uploadCaregiverAudio(
  params: UploadCaregiverAudioParams
): Promise<UploadCaregiverAudioResult> {
  const { buffer, mimeType, caregiverPhone, messageId } = params;

  assertWithinSize(buffer.length); // throws FileTooLargeError before any upload

  const storagePath = buildAudioKey(caregiverPhone, messageId, mimeType);

  const upload = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType || "audio/ogg",
      upsert: false
    });
  if (upload.error) throw upload.error;

  const { data: signed } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  return { storagePath, signedUrl: signed?.signedUrl ?? "" };
}
