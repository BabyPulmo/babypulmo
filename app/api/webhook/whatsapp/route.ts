import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { supabaseAdmin } from "@/lib/supabase";
import { classifyCough } from "@/lib/classifier";
import { retrieveImci } from "@/lib/rag";
import { generateBanglaGuidance } from "@/lib/claude";
import { synthesizeBangla } from "@/lib/tts";
import { findNearestChw } from "@/lib/escalation";
import { audit } from "@/lib/audit";
import type { ChildProfile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM!;
const twilioClient = twilio(TWILIO_SID, TWILIO_AUTH);

const GREETING_BANGLA =
  "Assalamu alaikum! Ami ShishuKantho. Apnar shishur cough-er 30 second voice record-kore amake pathan. Ami 10 second-er moddhe bole debo ki problem ache. (Disclaimer: Ei tothyo doctor-er bikolpo noy. Joruri obostha-ye 999 kol korun.)";

const ERROR_BANGLA =
  "Drukito ekti problem holo. Onugroho kore abar try korun. Joruri obostha-ye 999 kol korun.";

// Default child profile when caregiver hasn't onboarded with age.
// In production: ask the caregiver for child age before first classification.
const DEFAULT_CHILD: ChildProfile = { ageMonths: 12, sex: "M" };

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const from = (form.get("From") as string) ?? "";
  const numMedia = parseInt((form.get("NumMedia") as string) ?? "0");
  const mediaUrl = form.get("MediaUrl0") as string | null;
  const mediaType = form.get("MediaContentType0") as string | null;

  if (!from) {
    return new NextResponse("missing From", { status: 400 });
  }

  const caregiverId = await upsertCaregiver(from);

  // No media: send greeting/onboarding
  if (numMedia === 0 || !mediaUrl) {
    await replyTwilio(from, GREETING_BANGLA);
    await audit({
      eventType: "whatsapp_greeting_sent",
      payload: { from },
      caregiverId
    });
    return new NextResponse("", { status: 200 });
  }

  try {
    // 1. Download audio from Twilio with auth
    const audioRes = await fetch(mediaUrl, {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64")
      }
    });
    if (!audioRes.ok) throw new Error(`Twilio media fetch ${audioRes.status}`);
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    const audioExt = mediaType?.includes("ogg") ? "ogg" : "mp3";

    // 2. Upload to Supabase Storage
    const recordingId = crypto.randomUUID();
    const storagePath = `recordings/${recordingId}.${audioExt}`;
    const uploadRes = await supabaseAdmin.storage
      .from("recordings")
      .upload(storagePath, audioBuffer, {
        contentType: mediaType ?? "audio/ogg",
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

    // 4. Retrieve IMCI chunks
    const chunks = await retrieveImci(
      classification.class,
      DEFAULT_CHILD.ageMonths,
      3
    );

    // 5. Bangla guidance (Claude reasoning, rules-gated severity)
    const guidance = await generateBanglaGuidance(
      classification,
      chunks,
      DEFAULT_CHILD
    );

    // 6. Bangla TTS
    let ttsUrl: string | null = null;
    try {
      const audioBlob = await synthesizeBangla(guidance.banglaText);
      const ttsPath = `tts/${recordingId}.mp3`;
      await supabaseAdmin.storage
        .from("recordings")
        .upload(ttsPath, audioBlob, { contentType: "audio/mpeg", upsert: true });
      const { data: ttsSigned } = await supabaseAdmin.storage
        .from("recordings")
        .createSignedUrl(ttsPath, 3600);
      ttsUrl = ttsSigned?.signedUrl ?? null;
    } catch (err) {
      console.warn("[tts] failed, falling back to text only", err);
    }

    await supabaseAdmin.from("guidance").insert({
      classification_id: classificationId,
      bangla_text: guidance.banglaText,
      audio_url: ttsUrl,
      retrieved_chunks: chunks.map((c) => ({ id: c.id, title: c.title })),
      recommended_action: guidance.recommendedAction
    });

    // 7. Reply to caregiver: Bangla audio + text card
    const cardBody = formatTextCard(classification, guidance.severity);
    if (ttsUrl) {
      await twilioClient.messages.create({
        from: TWILIO_FROM,
        to: from,
        body: cardBody + "\n\n" + guidance.banglaText,
        mediaUrl: [ttsUrl]
      });
    } else {
      await replyTwilio(from, cardBody + "\n\n" + guidance.banglaText);
    }

    // 8. Escalate if rules-gated severity triggers
    if (guidance.mustEscalate) {
      const chw = await findNearestChw();
      if (chw) {
        await supabaseAdmin.from("alerts").insert({
          classification_id: classificationId,
          caregiver_id: caregiverId,
          chw_id: chw.id,
          severity: guidance.severity,
          status: "pending"
        });

        const chwMsg =
          `🚨 ShishuKantho ALERT (${guidance.severity.toUpperCase()})\n` +
          `Class: ${classification.class} · ${(classification.confidence * 100).toFixed(0)}% conf\n` +
          `Caregiver: ${from}\n` +
          `Recommended action: ${guidance.recommendedAction}\n` +
          `Distance: ${chw.distanceKm} km`;

        await twilioClient.messages.create({
          from: TWILIO_FROM,
          to: chw.whatsappNumber,
          body: chwMsg,
          mediaUrl: [audioUrl]
        });
      }
    }

    // 9. Audit
    await audit({
      eventType: "classification_complete",
      payload: {
        class: classification.class,
        confidence: classification.confidence,
        mustEscalate: guidance.mustEscalate,
        severity: guidance.severity,
        retrievedChunkIds: chunks.map((c) => c.id)
      },
      recordingId,
      classificationId,
      caregiverId
    });

    return new NextResponse("", { status: 200 });
  } catch (err: any) {
    console.error("[whatsapp webhook] error", err);
    await audit({
      eventType: "classification_failed",
      payload: { error: err.message },
      caregiverId
    });
    await replyTwilio(from, ERROR_BANGLA);
    return new NextResponse("", { status: 200 });
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

async function replyTwilio(to: string, body: string) {
  await twilioClient.messages.create({ from: TWILIO_FROM, to, body });
}

function formatTextCard(
  c: { class: string; confidence: number },
  severity: string
): string {
  const sev = severity.toUpperCase();
  return `📋 ShishuKantho\n${sev}: ${c.class} (${(c.confidence * 100).toFixed(0)}% confidence)`;
}
