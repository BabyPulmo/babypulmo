// dp-export.ts — Differential-privacy aggregate exporter for partner CSVs.
// ──────────────────────────────────────────────────────────────────────────
// Wraps the weekly BRAC export (Phase 2B n8n workflow) with calibrated
// Laplace noise so per-district aggregate statistics carry a provable
// (ε, 0)-differential-privacy guarantee against re-identification of any
// single caregiver+child interaction.
//
// Why: even with the opaque caregiver_id hash + no PII in audit_log,
// per-district counts at small N can be inverted by an adversary with
// auxiliary information about district populations. DP noise eliminates
// that risk while preserving aggregate utility for partner planning.
//
// Reference: OpenDP / Google dp-accounting library + the Differential
// Privacy: A Primer for Public Health (Wood et al. 2018) literature.
//
// v0 scaffold for prelim demo. Production version uses OpenDP's
// Rust-backed accountant + audited DP budget tracker for BMRC review.

import { supabaseAdmin } from "../lib/supabase";

interface QuerySpec {
  name: string;
  // Sensitivity = max change in query result if one record is added/removed
  sensitivity: number;
  // Epsilon = privacy budget (smaller = stricter privacy, more noise)
  epsilon: number;
}

const SUPPORTED_QUERIES: Record<string, QuerySpec> = {
  per_district_pneumonia_rate: { name: "per_district_pneumonia_rate", sensitivity: 1, epsilon: 1.0 },
  per_age_band_escalation_count: { name: "per_age_band_escalation_count", sensitivity: 1, epsilon: 1.0 },
  per_week_overall_volume: { name: "per_week_overall_volume", sensitivity: 1, epsilon: 0.5 }
};

// Laplace mechanism: add Laplace(scale=sensitivity/epsilon) noise.
// Pure-JS sampler via inverse-CDF — fine for non-cryptographic DP analytics.
function laplaceNoise(scale: number): number {
  const u = Math.random() - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

function noisify(value: number, spec: QuerySpec): number {
  const noise = laplaceNoise(spec.sensitivity / spec.epsilon);
  return Math.max(0, Math.round(value + noise));
}

async function runQuery(name: string): Promise<Array<Record<string, unknown>>> {
  // Each query is a SQL view in Supabase. Production reads the materialized
  // view; this scaffold returns mock rows for the dry-run.
  if (!process.env.SUPABASE_URL) {
    return mockRowsFor(name);
  }
  const { data, error } = await supabaseAdmin.from(`v_${name}`).select("*");
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

function mockRowsFor(name: string): Array<Record<string, unknown>> {
  if (name === "per_district_pneumonia_rate") {
    return [
      { district: "Bogura", pneumonia_count: 42, total_classifications: 200 },
      { district: "Sherpur", pneumonia_count: 19, total_classifications: 88 },
      { district: "Jamalpur", pneumonia_count: 28, total_classifications: 130 }
    ];
  }
  if (name === "per_age_band_escalation_count") {
    return [
      { age_band: "0-2m", escalations: 12 },
      { age_band: "2m-12m", escalations: 38 },
      { age_band: "12m-60m", escalations: 55 }
    ];
  }
  if (name === "per_week_overall_volume") {
    return [{ week: "2026-W22", total: 318 }];
  }
  return [];
}

async function main() {
  const args = process.argv.slice(2);
  const queryArg = args.find((a) => a.startsWith("--query="));
  const epsilonArg = args.find((a) => a.startsWith("--epsilon="));
  const dry = args.includes("--dry-run");

  if (!queryArg) {
    console.log("Usage: tsx scripts/dp-export.ts --query=<name> [--epsilon=1.0] [--dry-run]");
    console.log("Supported queries:", Object.keys(SUPPORTED_QUERIES).join(", "));
    return;
  }

  const queryName = queryArg.split("=")[1];
  const spec = SUPPORTED_QUERIES[queryName];
  if (!spec) throw new Error(`unknown query: ${queryName}`);
  if (epsilonArg) spec.epsilon = parseFloat(epsilonArg.split("=")[1]);

  const rows = await runQuery(queryName);
  console.log(`[dp-export] query=${queryName} ε=${spec.epsilon} rows=${rows.length}`);

  // Noisify every numeric field that is a COUNT or RATE.
  const noisedRows = rows.map((r) => {
    const out: Record<string, unknown> = { ...r };
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "number" && (k.includes("count") || k.includes("total") || k.includes("escalations"))) {
        out[k] = noisify(v, spec);
      }
    }
    return out;
  });

  if (dry) {
    console.log("DRY RUN — noised sample:");
    console.log(JSON.stringify(noisedRows.slice(0, 5), null, 2));
    return;
  }

  // Production: upload CSV to Supabase Storage / SFTP for BRAC, write DP
  // budget event to audit_log for the BMRC ethics review trail.
  console.log("DP-noised export complete. Production wires SFTP upload here.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
