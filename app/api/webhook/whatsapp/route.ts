import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { classifyCough } from "@/lib/classifier";
import { retrieveImci } from "@/lib/rag";
import { decideSeverity } from "@/lib/claude";
import { getStockBangla, synthesizeBanglaCached } from "@/lib/tts";
import { findNearestChw } from "@/lib/escalation";
import { audit } from "@/lib/audit";
import {
  verifyMetaSignature,
  extractMessages,
  downloadMedia,
  sendText,
  sendAudio
} from "@/lib/whatsapp";
import type { ChildProfile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;

const GREETING_BANGLA =
  "Assalamu alaikum! Ami ShishuKantho. Apnar shishur cough-er 30 second voice record-kore amake pathan. Ami 10 second-er moddhe bole debo ki problem ache. (Disclaimer: Ei tothyo doctor-er bikolpo noy. Joruri obostha-ye 999 kol korun.)";

const ERROR_BANGLA =
  "Drukito ekti problem holo. Onugroho kore abar try korun. Joruri obostha-ye 999 kol korun.";

// Default child profile when caregiver hasn't onboarded with age.
// In production: ask the caregiver for child age before first classification.
const DEFAULT_CHILD: ChildProfile = { ageMonths: 12, sex: "M" };

// Meta webhook verification handshake (configured once in Meta App Dashboard).
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("invalid json", { status: 400 });
  }

  const messages = extractMessages(payload);
  if (messages.length === 0) {
    return new NextResponse("ok", { status: 200 });
  }

  const msg = messages[0];
  const from = msg.from;
  const caregiverId = await upsertCaregiver(from);

  // Greeting / non-audio fallback
  if (msg.type !== "audio" || !msg.audio) {
    await sendText(from, GREETING_BANGLA);
    await audit({
      eventType: "whatsapp_greeting_sent",
      payload: { from },
      caregiverId
    });
    return new NextResponse("ok", { status: 200 });
  }

  try {
    // 1. Download voice note from Meta
    const { buffer: audioBuffer, mimeType } = await downloadMedia(msg.audio.id);
    const audioExt = mimeType.includes("ogg") ? "ogg" : "mp3";

    // 2. Upload to Supabase Storage
    const recordingId = crypto.randomUUID();
    const storagePath = `recordings/${recordingId}.${audioExt}`;
    const uploadRes = await supabaseAdmin.storage
      .from("recordings")
      .upload(storagePath, audioBuffer, {
        contentType: mimeType ?? "audio/ogg",
        upsert: false
      });
    if (uploadRes.error) throw uploadRes.error;

    const { data: signed } = await supabaseAdmin.storage
      .from("recordings")
      .createSignedUrl(storagePath, 3600);
    const audioUrl = signed?.signedUrl ?? "";

    await supabaseAdmin.from("recordings").insert({
      id: recordingId,
      caregiver_id: caregiverId,
      storage_path: storagePath,
      source: "whatsapp"
    });

    // 3. Classify
    const classification = await classifyCough(audioUrl);

    const { data: cls } = await supabaseAdmin
      .from("classifications")
      .insert({
        recording_id: recordingId,
        predicted_class: classification.class,
        confidence: classification.confidence,
        class_probs: classification.classProbs,
        heatmap_url: classification.heatmapUrl,
        model_version: classification.modelVersion,
        inference_ms: classification.inferenceMs
      })
      .select("id")
      .single();

    const classificationId = cls?.id;

    // 4. Retrieve IMCI chunks (logged for audit / explainability only)
    const chunks = await retrieveImci(
      classification.class,
      DEFAULT_CHILD.ageMonths,
      3
    );

    // 5. Bangla guidance — pure stock library, rules-gated severity, no LLM.
    const decision = decideSeverity(classification);
    const banglaText =
      getStockBangla(classification.class, decision.severity) ?? ERROR_BANGLA;

    // 6. Bangla TTS — content-hash cached. Stock scripts pre-warmed via
    // `warmStockCache()` so almost every call hits the cache and skips GCP TTS.
    let ttsUrl: string | null = null;
    try {
      const tts = await synthesizeBanglaCached(banglaText);
      ttsUrl = tts.url;
      console.log(
        `[tts] ${tts.cached ? "HIT" : "MISS"} bytes=${tts.bytes} path=${tts.path}`
      );
    } catch (err) {
      console.warn("[tts] failed, falling back to text only", err);
    }

    await supabaseAdmin.from("guidance").insert({
      classification_id: classificationId,
      bangla_text: banglaText,
      audio_url: ttsUrl,
      retrieved_chunks: chunks.map((c) => ({ id: c.id, title: c.title })),
      recommended_action: decision.recommendedAction
    });

    // 7. Reply to caregiver: text card + Bangla audio (free service-window msg)
    const cardBody = formatTextCard(classification, decision.severity);
    await sendText(from, cardBody + "\n\n" + banglaText);
    if (ttsUrl) {
      await sendAudio(from, ttsUrl);
    }

    // 8. Escalate if rules-gated severity triggers (paid utility message)
    if (decision.mustEscalate) {
      const chw = await findNearestChw();
      if (chw) {
        await supabaseAdmin.from("alerts").insert({
          classification_id: classificationId,
          caregiver_id: caregiverId,
          chw_id: chw.id,
          severity: decision.severity,
          status: "pending"
        });

        const chwMsg =
          `🚨 ShishuKantho ALERT (${decision.severity.toUpperCase()})\n` +
          `Class: ${classification.class} · ${(classification.confidence * 100).toFixed(0)}% conf\n` +
          `Caregiver: ${from}\n` +
          `Recommended action: ${decision.recommendedAction}\n` +
          `Distance: ${chw.distanceKm} km`;

        await sendText(stripWaPrefix(chw.whatsappNumber), chwMsg);
        await sendAudio(stripWaPrefix(chw.whatsappNumber), audioUrl);
      }
    }

    // 9. Audit
    await audit({
      eventType: "classification_complete",
      payload: {
        class: classification.class,
        confidence: classification.confidence,
        mustEscalate: decision.mustEscalate,
        severity: decision.severity,
        retrievedChunkIds: chunks.map((c) => c.id)
      },
      recordingId,
      classificationId,
      caregiverId
    });

    return new NextResponse("ok", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[whatsapp webhook] error", err);
    await audit({
      eventType: "classification_failed",
      payload: { error: message },
      caregiverId
    });
    try {
      await sendText(from, ERROR_BANGLA);
    } catch {
      // swallow — we already returned an error path
    }
    return new NextResponse("ok", { status: 200 });
  }
}

async function upsertCaregiver(whatsappNumber: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("caregivers")
    .upsert(
      { whatsapp_number: whatsappNumber },
      { onConflict: "whatsapp_number" }
    )
    .select("id")
    .single();
  return data!.id;
}

// CHW numbers in seed data are stored with the legacy "whatsapp:+" Twilio prefix.
// Meta Cloud API expects bare digits (e.g. "8801711111111").
function stripWaPrefix(n: string): string {
  return n.replace(/^whatsapp:/, "").replace(/^\+/, "");
}

function formatTextCard(
  c: { class: string; confidence: number },
  severity: string
): string {
  const sev = severity.toUpperCase();
  return `📋 ShishuKantho\n${sev}: ${c.class} (${(c.confidence * 100).toFixed(0)}% confidence)`;
}
