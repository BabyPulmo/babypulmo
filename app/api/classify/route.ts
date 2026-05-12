import { NextRequest, NextResponse } from "next/server";
import { classifyCough } from "@/lib/classifier";

export const runtime = "nodejs";
export const maxDuration = 30;

// Proxy endpoint: takes a public/signed audio URL, returns classifier output.
// Useful for direct testing without WhatsApp; the production path is /api/webhook/whatsapp.
export async function POST(req: NextRequest) {
  try {
    const { audio_url } = await req.json();
    if (!audio_url) {
      return NextResponse.json({ error: "audio_url required" }, { status: 400 });
    }
    const result = await classifyCough(audio_url);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[/api/classify]", err);
    return NextResponse.json({ error: err.message ?? "classification failed" }, { status: 500 });
  }
}
