import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Returns the signed URL of the latest Parquet audit_log partition for the
// DuckDB-WASM analytics cell. The manifest.json is written by
// scripts/export-audit-parquet.ts at every nightly export.

export const runtime = "nodejs";

export async function GET() {
  const bucket = process.env.AUDIT_PARQUET_BUCKET ?? "lakehouse";
  try {
    const { data: file } = await supabaseAdmin.storage
      .from(bucket)
      .download("audit_log/manifest.json");
    if (!file) {
      return NextResponse.json({ error: "manifest not found" }, { status: 404 });
    }
    const manifest = JSON.parse(await file.text()) as { latest?: string };
    if (!manifest.latest) {
      return NextResponse.json({ error: "manifest empty" }, { status: 404 });
    }
    const { data: signed } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(manifest.latest, 3600);
    return NextResponse.json({ url: signed?.signedUrl ?? null });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
