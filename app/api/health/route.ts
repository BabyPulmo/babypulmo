import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight liveness/readiness probe. Consumed by the Docker healthcheck,
// the GitHub Actions deploy probe, and the CHW dashboard status pill.
// Always returns 200 with a per-dependency payload; honestly reports
// `classifier: "mock"` when no classifier endpoint is configured.
//
// Intentionally does NOT import lib/rag.ts or lib/embeddings.ts — those throw at
// module init in production without OPENAI_API_KEY, which must not take down the
// health endpoint.

type DepStatus = "ok" | "down";
type ClassifierStatus = "ok" | "mock" | "down";

const DB_TIMEOUT_MS = 1500;
const CLASSIFIER_TIMEOUT_MS = 1000;

async function checkDb(): Promise<DepStatus> {
  try {
    // supabase-js has no raw `SELECT 1`; a head-only query is the cheap
    // equivalent and confirms connectivity + table existence.
    const { error } = await supabaseAdmin
      .from("chws")
      .select("id", { head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(DB_TIMEOUT_MS));
    return error ? "down" : "ok";
  } catch {
    return "down";
  }
}

async function checkClassifier(): Promise<ClassifierStatus> {
  const endpoint = process.env.CLASSIFIER_ENDPOINT;
  if (!endpoint) return "mock";
  try {
    // Reachability ping: any HTTP response (even 405 from a POST-only endpoint)
    // means the service is up. Only a network error / timeout is "down".
    await fetch(endpoint, {
      method: "HEAD",
      signal: AbortSignal.timeout(CLASSIFIER_TIMEOUT_MS)
    });
    return "ok";
  } catch {
    return "down";
  }
}

export async function GET() {
  const [db, classifier] = await Promise.all([checkDb(), checkClassifier()]);
  const tts: DepStatus = process.env.GCP_TTS_API_KEY ? "ok" : "down";

  const body = {
    ok: db === "ok" && tts === "ok" && classifier !== "down",
    db,
    classifier,
    tts,
    commit:
      process.env.GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
    ts: new Date().toISOString()
  };

  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" }
  });
}
