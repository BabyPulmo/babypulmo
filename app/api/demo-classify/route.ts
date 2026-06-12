import { NextRequest, NextResponse } from "next/server";
import { classifyCough, simulateClassification } from "@/lib/classifier";
import { decideSeverityMultiModal } from "@/lib/claude";
import { getStockBangla, synthesizeBanglaCached } from "@/lib/tts";
import { retrieveImci } from "@/lib/rag";
import { findNearestChw } from "@/lib/escalation";
import { audit } from "@/lib/audit";
import { supabaseAdmin } from "@/lib/supabase";
import type { ChildProfile, ClassificationResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// Interactive /demo backend. Mirrors the webhook's core decision pipeline, but driven
// by a browser recording instead of WhatsApp. Everything here is REAL except the
// disease class when no CLASSIFIER_ENDPOINT is set (simulated, clearly labeled):
//   real respiratory rate (measured in-browser) → real deterministic severity →
//   real stock Bangla → real audit row → real CHW escalation on /chw.

interface DemoRequest {
  audioBase64?: string;          // recorded blob, base64 (no data: prefix)
  audioMimeType?: string;        // e.g. "audio/webm"
  breathsPerMin?: number | null; // measured in the browser from the real recording
  rrConfidence?: "high" | "medium" | "low" | null;
  profile?: Partial<ChildProfile>;
}

const SIMULATED = !process.env.CLASSIFIER_ENDPOINT;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DemoRequest;
    const profile: ChildProfile = {
      ageMonths: clampInt(body.profile?.ageMonths, 0, 60, 12),
      sex: body.profile?.sex === "F" ? "F" : "M",
      fever: Boolean(body.profile?.fever),
      symptomDays: body.profile?.symptomDays
    };
    const breathsPerMin =
      typeof body.breathsPerMin === "number" && isFinite(body.breathsPerMin)
        ? Math.round(body.breathsPerMin)
        : null;

    // 1. Store the recording (best-effort) so a real Modal classifier could fetch it.
    let audioUrl: string | null = null;
    let recordingId: string | null = null;
    if (body.audioBase64) {
      try {
        const buf = Buffer.from(body.audioBase64, "base64");
        const ext = (body.audioMimeType ?? "audio/webm").includes("ogg") ? "ogg" : "webm";
        const path = `demo/${Date.now()}-${Math.floor(performance.now())}.${ext}`;
        const up = await supabaseAdmin.storage
          .from(process.env.TTS_CACHE_BUCKET ?? "recordings")
          .upload(path, buf, { contentType: body.audioMimeType ?? "audio/webm", upsert: true });
        if (!up.error) {
          const { data: signed } = await supabaseAdmin.storage
            .from(process.env.TTS_CACHE_BUCKET ?? "recordings")
            .createSignedUrl(path, 600);
          audioUrl = signed?.signedUrl ?? null;
          const rec = await supabaseAdmin
            .from("recordings")
            .insert({ storage_path: path, source: "web", duration_sec: null })
            .select("id");
          recordingId = rec.data?.[0]?.id ?? null;
        }
      } catch (e) {
        console.warn("[demo-classify] storage skipped:", (e as Error).message);
      }
    }

    // 2. Classify — real Modal endpoint when configured, else randomized simulation.
    let classification: ClassificationResult;
    if (SIMULATED || !audioUrl) {
      classification = simulateClassification();
    } else {
      classification = await classifyCough(audioUrl);
    }
    // The browser-measured RR is the real signal; prefer it over the classifier's.
    classification.breathsPerMin = breathsPerMin ?? classification.breathsPerMin ?? null;

    // 3. Real deterministic severity decision.
    const decision = decideSeverityMultiModal({
      classification,
      profile,
      breathsPerMin: classification.breathsPerMin ?? null,
      cxr: null
    });

    // 4. RAG context (keyword fallback when no OpenAI key) — titles only for display.
    let imciTitles: string[] = [];
    try {
      const chunks = await retrieveImci(classification.class, profile.ageMonths, 3);
      imciTitles = chunks.map((c) => c.title);
    } catch (e) {
      console.warn("[demo-classify] rag skipped:", (e as Error).message);
    }

    // 5. Real clinician-vetted (draft) Bangla guidance + optional TTS audio.
    const banglaText =
      getStockBangla(classification.class, decision.severity) ??
      "এই মুহূর্তে নির্দিষ্ট নির্দেশনা পাওয়া যায়নি — নিকটস্থ স্বাস্থ্যকর্মীর সঙ্গে যোগাযোগ করুন।";
    let ttsUrl: string | null = null;
    if (process.env.GCP_TTS_API_KEY) {
      try {
        ttsUrl = (await synthesizeBanglaCached(banglaText)).url;
      } catch (e) {
        console.warn("[demo-classify] tts skipped:", (e as Error).message);
      }
    }

    // 6. Persist classification + guidance + audit (so /docs analytics updates).
    let classificationId: string | null = null;
    try {
      const cls = await supabaseAdmin
        .from("classifications")
        .insert({
          recording_id: recordingId,
          predicted_class: classification.class,
          confidence: classification.confidence,
          class_probs: classification.classProbs,
          model_version: classification.modelVersion,
          inference_ms: classification.inferenceMs
        })
        .select("id");
      classificationId = cls.data?.[0]?.id ?? null;
    } catch (e) {
      console.warn("[demo-classify] classification insert skipped:", (e as Error).message);
    }

    await audit({
      eventType: "classification_complete",
      payload: {
        source: "web_demo",
        simulated: SIMULATED,
        class: classification.class,
        confidence: classification.confidence,
        breathsPerMin: classification.breathsPerMin,
        rrConfidence: body.rrConfidence ?? null,
        profileAgeMonths: profile.ageMonths,
        profileFever: profile.fever ?? null,
        severity: decision.severity,
        mustEscalate: decision.mustEscalate,
        decisionReason: decision.reason
      },
      recordingId: recordingId ?? undefined,
      classificationId: classificationId ?? undefined
    });

    // 7. Real escalation — severe cases create an alert that pops live on /chw.
    let escalatedTo: string | null = null;
    if (decision.mustEscalate) {
      try {
        const chw = await findNearestChw();
        await supabaseAdmin.from("alerts").insert({
          classification_id: classificationId,
          chw_id: chw?.id ?? null,
          severity: decision.severity === "low" ? "moderate" : decision.severity,
          status: "pending"
        });
        escalatedTo = chw?.name ?? "nearest CHW";
      } catch (e) {
        console.warn("[demo-classify] escalation skipped:", (e as Error).message);
      }
    }

    return NextResponse.json({
      simulated: SIMULATED,
      class: classification.class,
      confidence: classification.confidence,
      classProbs: classification.classProbs,
      modelVersion: classification.modelVersion,
      breathsPerMin: classification.breathsPerMin,
      rrConfidence: body.rrConfidence ?? classification.rrConfidence ?? null,
      severity: decision.severity,
      reason: decision.reason,
      mustEscalate: decision.mustEscalate,
      recommendedAction: decision.recommendedAction,
      banglaText,
      audioUrl: ttsUrl,
      imciTitles,
      escalatedTo
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/demo-classify]", err);
    if (err instanceof Error && err.cause) console.error("[/api/demo-classify] cause:", err.cause);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = typeof v === "number" ? Math.round(v) : NaN;
  if (!isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}
