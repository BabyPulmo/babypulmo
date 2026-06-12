// demo-trigger-alert.ts — the live "wow" moment for the demo.
// Inserts one CRITICAL alert as the service role; the /chw dashboard (subscribed to
// postgres_changes on `alerts`) pops it in real time, no refresh. Run it mid-demo
// from a terminal while the dashboard is on screen.
//
//   npx tsx --env-file=.env.local scripts/demo-trigger-alert.ts            # fire one alert
//   npx tsx --env-file=.env.local scripts/demo-trigger-alert.ts --cleanup  # remove the alerts THIS script created
//
// Inserted ids are logged to scripts/.demo-alerts.json so --cleanup removes exactly
// those rows and never touches the seed_demo.sql alerts. (To reset the whole board
// instead, just re-run supabase/seed_demo.sql.)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { supabaseAdmin } from "../lib/supabase";

const LOG = join(process.cwd(), "scripts", ".demo-alerts.json");

function readLog(): string[] {
  if (!existsSync(LOG)) return [];
  try { return JSON.parse(readFileSync(LOG, "utf8")); } catch { return []; }
}
function writeLog(ids: string[]) { writeFileSync(LOG, JSON.stringify(ids, null, 2)); }

async function fireAlert() {
  // {severity, status} only — caregiver_location is nullable and the dashboard renders
  // fine without it. (Proven insert shape from the realtime verification.)
  const { data, error } = await supabaseAdmin
    .from("alerts")
    .insert({ severity: "critical", status: "pending" })
    .select("id");
  if (error) throw error;
  const id = data![0].id as string;
  writeLog([...readLog(), id]);
  console.log(`🚨 CRITICAL alert inserted (id ${id.slice(0, 8)}…) — watch /chw light up.`);
}

async function cleanup() {
  const ids = readLog();
  if (ids.length === 0) { console.log("nothing to clean (no logged demo alerts)."); return; }
  const { data, error } = await supabaseAdmin.from("alerts").delete().in("id", ids).select("id");
  if (error) throw error;
  writeLog([]);
  console.log(`🧹 removed ${data?.length ?? 0} demo alert(s).`);
}

async function main() {
  if (process.argv.includes("--cleanup")) await cleanup();
  else await fireAlert();
}

main().catch((e) => {
  console.error("ERR", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
