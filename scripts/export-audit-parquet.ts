// export-audit-parquet.ts — Lakehouse-lite layer.
// Nightly (via Vercel cron) exports the audit_log partition for the previous
// day to a Parquet file in Supabase Storage. The /docs Audit Analytics cell
// reads the latest Parquet via DuckDB-WASM and renders interactive analytics
// (per-class confidence histogram, escalation time-to-care, per-district
// volume) entirely client-side — zero compute on the Vercel function.
//
// Why Parquet + DuckDB? Columnar storage is right for time-series append-only
// analytics; DuckDB-WASM eliminates server cost; both compose with future
// Apache Iceberg / Delta upgrades for partner-data warehousing.
//
// Run:
//   npx tsx scripts/export-audit-parquet.ts                 # yesterday
//   npx tsx scripts/export-audit-parquet.ts --date=2026-05-29
//   npx tsx scripts/export-audit-parquet.ts --dry-run

import { supabaseAdmin } from "../lib/supabase";
import { parquetWriteFile } from "hyparquet-writer";

const BUCKET = process.env.AUDIT_PARQUET_BUCKET ?? "lakehouse";
const PREFIX = "audit_log";

function previousDayUtcIso(): { startIso: string; endIso: string; partition: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const partition = start.toISOString().slice(0, 10);
  return { startIso: start.toISOString(), endIso: end.toISOString(), partition };
}

async function fetchAuditPartition(startIso: string, endIso: string) {
  const { data, error } = await supabaseAdmin
    .from("audit_log")
    .select(
      "id, created_at, event_type, payload, recording_id, classification_id, caregiver_id"
    )
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

interface AuditRow {
  id: string;
  created_at: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  recording_id: string | null;
  classification_id: string | null;
  caregiver_id: string | null;
}

function flattenForParquet(rows: AuditRow[]) {
  // Extract the multi-modal signals from payload into typed columns so
  // DuckDB can query them without JSON unpacking on every analytic query.
  return rows.map((r) => {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      ts: r.created_at,
      event_type: r.event_type,
      cough_class: typeof p.class === "string" ? p.class : null,
      confidence: typeof p.confidence === "number" ? p.confidence : null,
      breaths_per_min: typeof p.breathsPerMin === "number" ? p.breathsPerMin : null,
      rr_confidence: typeof p.rrConfidence === "string" ? p.rrConfidence : null,
      age_months: typeof p.profileAgeMonths === "number" ? p.profileAgeMonths : null,
      fever: typeof p.profileFever === "boolean" ? p.profileFever : null,
      symptom_days: typeof p.profileSymptomDays === "number" ? p.profileSymptomDays : null,
      severity: typeof p.severity === "string" ? p.severity : null,
      must_escalate: typeof p.mustEscalate === "boolean" ? p.mustEscalate : null,
      decision_reason: typeof p.decisionReason === "string" ? p.decisionReason : null,
      recording_id: r.recording_id,
      classification_id: r.classification_id,
      caregiver_id_hash: r.caregiver_id // already opaque hash, OK to retain
    };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dateArg = args.find((a) => a.startsWith("--date="));

  let startIso: string, endIso: string, partition: string;
  if (dateArg) {
    partition = dateArg.split("=")[1];
    startIso = `${partition}T00:00:00.000Z`;
    endIso = `${partition}T23:59:59.999Z`;
  } else {
    ({ startIso, endIso, partition } = previousDayUtcIso());
  }

  console.log(`[export] partition=${partition} window=[${startIso}, ${endIso})`);
  const rows = await fetchAuditPartition(startIso, endIso);
  console.log(`[export] ${rows.length} rows`);

  const flat = flattenForParquet(rows as AuditRow[]);

  if (dryRun) {
    console.log("[export] dry-run sample:", flat.slice(0, 3));
    return;
  }

  const tmpPath = `/tmp/${PREFIX}_${partition}.parquet`;
  await parquetWriteFile({
    filename: tmpPath,
    columnData: columnize(flat)
  });

  const fs = await import("node:fs/promises");
  const buf = await fs.readFile(tmpPath);
  const storagePath = `${PREFIX}/${PREFIX}_${partition}.parquet`;
  const up = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: "application/octet-stream", upsert: true });
  if (up.error) throw up.error;

  // Also write a manifest file pointing the /docs DuckDB-WASM cell at the
  // newest partition without having to list the bucket.
  const manifest = { latest: storagePath, partition, rowCount: flat.length, exportedAt: new Date().toISOString() };
  await supabaseAdmin.storage
    .from(BUCKET)
    .upload(`${PREFIX}/manifest.json`, JSON.stringify(manifest, null, 2), {
      contentType: "application/json",
      upsert: true
    });
  console.log(`[export] uploaded ${storagePath} + manifest.json`);
}

function columnize(rows: ReturnType<typeof flattenForParquet>) {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]) as Array<keyof (typeof rows)[0]>;
  return keys.map((k) => ({
    name: String(k),
    data: rows.map((r) => r[k] as string | number | boolean | null)
  }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
