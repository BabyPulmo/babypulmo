import { createHmac, timingSafeEqual } from "crypto";

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET!;
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface MetaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "audio" | "image" | "video" | "document" | "location" | string;
  audio?: { id: string; mime_type: string };
  text?: { body: string };
  location?: { latitude: number; longitude: number };
}

// Verifies the X-Hub-Signature-256 header Meta attaches to every webhook POST.
// Constant-time comparison avoids timing side-channels.
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader || !APP_SECRET) return false;
  const expected =
    "sha256=" + createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function extractMessages(payload: unknown): MetaMessage[] {
  const p = payload as {
    entry?: { changes?: { value?: { messages?: MetaMessage[] } }[] }[];
  };
  return p?.entry?.[0]?.changes?.[0]?.value?.messages ?? [];
}

export async function downloadMedia(
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const meta = await fetch(`${GRAPH_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
  });
  if (!meta.ok) {
    throw new Error(`Meta media metadata ${meta.status}: ${await meta.text()}`);
  }
  const { url, mime_type } = (await meta.json()) as {
    url: string;
    mime_type: string;
  };

  const blob = await fetch(url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
  });
  if (!blob.ok) {
    throw new Error(`Meta media download ${blob.status}`);
  }
  return {
    buffer: Buffer.from(await blob.arrayBuffer()),
    mimeType: mime_type
  };
}

async function postMessage(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error(`Meta send ${res.status}: ${await res.text()}`);
  }
}

export async function sendText(to: string, body: string): Promise<void> {
  await postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body }
  });
}

export async function sendAudio(to: string, audioLink: string): Promise<void> {
  await postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "audio",
    audio: { link: audioLink }
  });
}
