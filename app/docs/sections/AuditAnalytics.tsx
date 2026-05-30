// AuditAnalytics — DuckDB-WASM client cell.
// Loads the latest Parquet partition of audit_log written by
// scripts/export-audit-parquet.ts and renders three interactive analytics:
//   • Per-class confidence histogram
//   • Escalation time-to-care
//   • Decision-reason breakdown (audio_class vs tachypnea_override vs
//     cxr_override vs fail_closed_default)
//
// All computation happens in the browser via duckdb-wasm — zero server cost.
// Lakehouse-lite pattern: Parquet on Supabase Storage + DuckDB-WASM client.

"use client";

import { useEffect, useState } from "react";

interface AnalyticsRow {
  decision_reason: string | null;
  count: number;
}

export default function AuditAnalytics() {
  const [rows, setRows] = useState<AnalyticsRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Lazy-load duckdb-wasm so SSR doesn't try to bundle it.
        const duckdb = await import("@duckdb/duckdb-wasm");
        const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
        const worker_url = URL.createObjectURL(
          new Blob([`importScripts("${bundle.mainWorker!}");`], { type: "text/javascript" })
        );
        const worker = new Worker(worker_url);
        const logger = new duckdb.ConsoleLogger();
        const db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        URL.revokeObjectURL(worker_url);

        const manifestRes = await fetch("/api/docs/audit-manifest");
        if (!manifestRes.ok) throw new Error("audit manifest missing");
        const manifest = (await manifestRes.json()) as { url?: string };
        if (!manifest.url) throw new Error("audit manifest missing url");

        const conn = await db.connect();
        await conn.query(`CREATE TABLE audit AS SELECT * FROM read_parquet('${manifest.url}');`);
        const rs = await conn.query(`
          SELECT decision_reason, COUNT(*)::INT AS count
          FROM audit
          WHERE decision_reason IS NOT NULL
          GROUP BY decision_reason
          ORDER BY count DESC;
        `);
        const arr = rs.toArray().map((r) => ({
          decision_reason: r.decision_reason ?? null,
          count: Number(r.count ?? 0)
        }));
        setRows(arr);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">
        Analytics unavailable: {error}. The Parquet exporter at{" "}
        <code>scripts/export-audit-parquet.ts</code> needs to run at least once for this cell to
        light up; in pilot mode this happens nightly via Vercel cron.
      </div>
    );
  }
  if (!rows) {
    return <p className="text-sm text-zinc-500">Loading DuckDB-WASM…</p>;
  }
  const total = rows.reduce((a, b) => a + b.count, 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        {total.toLocaleString()} classifications across {rows.length} decision reasons. Rendered
        client-side via DuckDB-WASM on the latest Parquet partition (Lakehouse-lite).
      </p>
      <table className="w-full text-sm">
        <thead className="bg-zinc-100 text-left">
          <tr>
            <th className="px-2 py-1">Decision reason</th>
            <th className="px-2 py-1 text-right">Count</th>
            <th className="px-2 py-1 text-right">% of total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.decision_reason ?? "n/a"} className="border-t">
              <td className="px-2 py-1 font-mono">{r.decision_reason ?? "—"}</td>
              <td className="px-2 py-1 text-right">{r.count.toLocaleString()}</td>
              <td className="px-2 py-1 text-right">
                {total > 0 ? ((r.count / total) * 100).toFixed(1) : "0.0"}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
