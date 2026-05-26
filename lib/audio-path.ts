import { createHash } from "crypto";

// Pure caregiver-audio path + size logic, kept free of the Supabase client so it
// can be unit-tested in isolation. lib/storage.ts composes these with the actual
// Storage upload.

export const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5MB

// Thrown when an inbound clip exceeds MAX_AUDIO_BYTES, so the webhook can reply
// with a specific Bangla message instead of the generic error.
export class FileTooLargeError extends Error {
  bytes: number;
  constructor(bytes: number) {
    super(`audio exceeds ${MAX_AUDIO_BYTES} bytes: ${bytes}`);
    this.name = "FileTooLargeError";
    this.bytes = bytes;
  }
}

export function assertWithinSize(byteLength: number): void {
  if (byteLength > MAX_AUDIO_BYTES) {
    throw new FileTooLargeError(byteLength);
  }
}

// recordings/{sha256(phone)}/{YYYY-MM-DD}/{message-id}.{ext}
// The caregiver phone is hashed so no plaintext number appears in the storage key.
export function buildAudioKey(
  caregiverPhone: string,
  messageId: string,
  mimeType: string
): string {
  const tenant = createHash("sha256").update(caregiverPhone).digest("hex");
  const date = new Date().toISOString().slice(0, 10);
  const ext = mimeType.includes("ogg") ? "ogg" : "mp3";
  const safeMessageId = messageId.replace(/[^A-Za-z0-9._-]/g, "_");
  return `${tenant}/${date}/${safeMessageId}.${ext}`;
}
