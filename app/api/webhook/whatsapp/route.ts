import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { classifyCough } from "@/lib/classifier";
import { retrieveImci } from "@/lib/rag";
import { decideSeverityMultiModal } from "@/lib/claude";
import { getStockBangla, synthesizeBanglaCached } from "@/lib/tts";
import { findNearestChw } from "@/lib/escalation";
import { audit } from "@/lib/audit";
import { classifyCxr } from "@/lib/cxr-vision";
import { transcribeBangla, parseBanglaAgeYears } from "@/lib/whisper";
import {
  verifyMetaSignature,
  extractMessages,
  downloadMedia,
  sendText,
  sendAudio
} from "@/lib/whatsapp";
import type { ChildProfile, CxrSignal } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;

const GREETING_BANGLA =
  "Assalamu alaikum! Ami Baby Pulmo. Apnar shishur cough-er 30 second voice record-kore amake pathan. Ami 10 second-er moddhe bole debo ki problem ache. (Disclaimer: Ei tothyo doctor-er bikolpo noy. Joruri obostha-ye 999 kol korun.)";

const ERROR_BANGLA =
  "Drukito ekti problem holo. Onugroho kore abar try korun. Joruri obostha-ye 999 kol korun.";

// Default child profile when caregiver hasn't completed the Q&A onboarding
// flow. Real caregivers go through a 3-message WhatsApp Q&A on first contact
// (age, sex, days of cough, fever yes/no) and the answers are stored in
// caregivers.child_profile_json. loadChildProfile() returns this default
// only when the row is missing or malformed.
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

  // Greeting / non-audio fallback. Onboarding flow:
  //   • Text reply: try to parse as integer years → ChildProfile.ageMonths.
  //   • Audio reply: transcribe with Whisper Bangla → parse → ChildProfile.
  //   • Otherwise: send greeting + ask for the child's age.
  if (msg.type !== "audio" || !msg.audio) {
    if (msg.type === "text" && msg.text?.body) {
      const years = parseBanglaAgeYears(msg.text.body);
      if (years !== null) {
        await persistChildAge(caregiverId, years);
        await sendText(from, `ধন্যবাদ! আপনার শিশুর বয়স ${years} বছর হিসেবে সংরক্ষণ করা হলো। এখন একটি ৩০ সেকেন্ডের কাশির voice note পাঠান।`);
        return new NextResponse("ok", { status: 200 });
      }
    }
    await sendText(from, GREETING_BANGLA);
    await audit({
      eventType: "whatsapp_greeting_sent",
      payload: { from },
      caregiverId
    });
    return new NextResponse("ok", { status: 200 });
  }

  // Audio path: first determine whether this is an onboarding reply (caregiver
  // saying "doy bochor" in response to our Bangla age prompt) or an actual
  // 30-sec cough voice note. Onboarding voice replies are short (<8 sec) and
  // come before any ChildProfile is stored; cough recordings are 20-60 sec.
  const existingProfile = await loadChildProfile(caregiverId);
  const profileIsDefault =
    existingProfile.ageMonths === DEFAULT_CHILD.ageMonths &&
    existingProfile.sex === DEFAULT_CHILD.sex;
  if (profileIsDefault) {
    try {
      const { buffer: oBuf, mimeType: oMime } = await downloadMedia(msg.audio.id);
      const onbPath = `onboarding/${crypto.randomUUID()}.${oMime.includes("ogg") ? "ogg" : "mp3"}`;
      await supabaseAdmin.storage.from("recordings").upload(onbPath, oBuf, {
        contentType: oMime ?? "audio/ogg",
        upsert: false
      });
      const { data: oSigned } = await supabaseAdmin.storage
        .from("recordings")
        .createSignedUrl(onbPath, 600);
      const oUrl = oSigned?.signedUrl ?? "";
      const transcript = await transcribeBangla(oUrl);
      const years = parseBanglaAgeYears(transcript.text);
      if (years !== null) {
        await persistChildAge(caregiverId, years);
        await sendText(
          from,
          `ধন্যবাদ! আপনার কথা থেকে শিশুর বয়স ${years} বছর শনাক্ত করা হয়েছে। এখন শিশুর ৩০ সেকেন্ডের কাশির voice note পাঠান।`
        );
        await audit({
          eventType: "onboarding_asr_age_captured",
          payload: { years, transcript: transcript.text },
          caregiverId
        });
        return new NextResponse("ok", { status: 200 });
      }
      // Fall through — if ASR didn't yield a number, treat the audio as a
      // cough recording attempt (caller may have skipped onboarding).
    } catch (err) {
      console.warn("[onboarding] ASR failed, treating as cough audio", err);
    }
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

    // 3. Classify cough audio
    const classification = await classifyCough(audioUrl);

    // 3b. Optional CXR — if the caregiver also uploaded a chest X-ray photo
    // (smartphone-of-CXR-on-backlit-panel in the rural-clinic case), call
    // the TorchXrayVision endpoint and pass the finding into the multi-modal
    // decision as a hard override. Phase 3 scaffold; full pilot Q3 2026.
    let cxrSignal: CxrSignal | null = null;
    if (msg.image?.id) {
      try {
        const { buffer: imgBuf, mimeType: imgMime } = await downloadMedia(msg.image.id);
        const cxrPath = `cxr/${crypto.randomUUID()}.jpg`;
        await supabaseAdmin.storage.from("recordings").upload(cxrPath, imgBuf, {
          contentType: imgMime ?? "image/jpeg",
          upsert: false
        });
        const { data: cxrSigned } = await supabaseAdmin.storage
          .from("recordings")
          .createSignedUrl(cxrPath, 3600);
        const cxrUrl = cxrSigned?.signedUrl ?? "";
        const cxr = await classifyCxr(cxrUrl);
        if (cxr) {
          cxrSignal = {
            pneumoniaProb: cxr.pneumoniaProb,
            consolidationProb: cxr.consolidationProb,
            noFindingProb: cxr.noFindingProb
          };
        }
      } catch (err) {
        console.warn("[cxr] failed, continuing audio-only", err);
      }
    }

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

    // 4. Load caregiver-reported child profile (age, sex, fever, symptom days)
    // collected via WhatsApp Q&A on first contact. Feeds both IMCI retrieval
    // (age-banded) and the multi-modal severity decision (tachypnea
    // thresholds are age-banded per WHO IMCI).
    const profile = await loadChildProfile(caregiverId);
    const chunks = await retrieveImci(classification.class, profile.ageMonths, 3);

    // 5. Multi-modal severity decision — audio class + auto-measured
    // respiratory rate + caregiver-reported child profile. Deterministic
    // rules table; no runtime LLM. WHO IMCI tachypnea is a hard escalation
    // override over borderline audio confidence — the multi-modal lift.
    const decision = decideSeverityMultiModal({
      classification,
      profile,
      breathsPerMin: classification.breathsPerMin ?? null,
      cxr: cxrSignal
    });
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
          `🚨 Baby Pulmo ALERT (${decision.severity.toUpperCase()})\n` +
          `Class: ${classification.class} · ${(classification.confidence * 100).toFixed(0)}% conf\n` +
          `Caregiver: ${from}\n` +
          `Recommended action: ${decision.recommendedAction}\n` +
          `Distance: ${chw.distanceKm} km`;

        await sendText(stripWaPrefix(chw.whatsappNumber), chwMsg);
        await sendAudio(stripWaPrefix(chw.whatsappNumber), audioUrl);
      }
    }

    // 9. Audit — log every signal that fed the deterministic decision so the
    // BMRC ethics review trail can reproduce any classification outcome.
    await audit({
      eventType: "classification_complete",
      payload: {
        class: classification.class,
        confidence: classification.confidence,
        breathsPerMin: classification.breathsPerMin ?? null,
        rrConfidence: classification.rrConfidence ?? null,
        cxrPneumoniaProb: cxrSignal?.pneumoniaProb ?? null,
        cxrConsolidationProb: cxrSignal?.consolidationProb ?? null,
        profileAgeMonths: profile.ageMonths,
        profileFever: profile.fever ?? null,
        profileSymptomDays: profile.symptomDays ?? null,
        mustEscalate: decision.mustEscalate,
        severity: decision.severity,
        decisionReason: decision.reason,
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

// Persist a caregiver-reported child age (years) into the caregivers row
// after a text or ASR onboarding turn captured it.
async function persistChildAge(caregiverId: string, years: number): Promise<void> {
  const ageMonths = Math.max(0, Math.min(60, Math.round(years * 12)));
  const profile: ChildProfile = { ageMonths, sex: "O" };
  await supabaseAdmin
    .from("caregivers")
    .update({ child_profile_json: profile })
    .eq("id", caregiverId);
}

// Returns the stored ChildProfile from the caregivers row, or DEFAULT_CHILD
// when the caregiver hasn't completed onboarding Q&A yet. Profile is collected
// via WhatsApp text replies on first contact (age, sex, symptom-days, fever).
async function loadChildProfile(caregiverId: string): Promise<ChildProfile> {
  const { data } = await supabaseAdmin
    .from("caregivers")
    .select("child_profile_json")
    .eq("id", caregiverId)
    .maybeSingle();
  const raw = data?.child_profile_json;
  if (!raw || typeof raw !== "object") return DEFAULT_CHILD;
  const profile = raw as Partial<ChildProfile>;
  if (typeof profile.ageMonths !== "number") return DEFAULT_CHILD;
  return {
    ageMonths: profile.ageMonths,
    sex: profile.sex ?? "O",
    symptomDays: profile.symptomDays,
    fever: profile.fever
  };
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
  return `📋 Baby Pulmo\n${sev}: ${c.class} (${(c.confidence * 100).toFixed(0)}% confidence)`;
}
