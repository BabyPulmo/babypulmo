// CHW Investigation Dashboard — /chw/investigate
// ──────────────────────────────────────────────────────────────────────────
// Natural-language investigation of the escalation queue, powered by the
// LangGraph agent in agents/chw-investigate/graph.ts. CHWs ask questions
// like "show me Bogura pneumonia cases last week with confidence < 0.6";
// the agent decomposes → SQL → IMCI RAG → Bangla summary.
//
// READ-ONLY by RLS at the database layer. The agent has zero write access.
// Caregiver runtime path remains deterministic + LLM-free.

"use client";

import { useState } from "react";

interface InvestigationResult {
  question: string;
  plannedSql?: string;
  sqlResult?: Array<Record<string, unknown>>;
  imciContext?: string;
  summary?: string;
}

export default function InvestigatePage() {
  const [question, setQuestion] = useState(
    "Show me Bogura pneumonia cases last week with confidence < 0.6"
  );
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runInvestigation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chw/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const data = (await res.json()) as InvestigationResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">CHW Investigation</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Natural-language queries over the audit log. Read-only — this dashboard cannot send a
        caregiver message, change a severity, or trigger an escalation. Every query + agent
        reasoning step is logged for BMRC review.
      </p>

      <div className="mt-6 space-y-3">
        <label htmlFor="q" className="block text-sm font-medium">Question</label>
        <textarea
          id="q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <button
          onClick={runInvestigation}
          disabled={loading || question.trim().length === 0}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Investigating…" : "Investigate"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {result && (
        <section className="mt-8 space-y-6">
          {result.summary && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <h2 className="text-sm font-semibold text-emerald-900">Summary (Bangla)</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm">{result.summary}</p>
            </div>
          )}
          {result.imciContext && (
            <div className="rounded-md border p-4">
              <h2 className="text-sm font-semibold">IMCI context</h2>
              <p className="mt-1 text-sm text-zinc-700">{result.imciContext}</p>
            </div>
          )}
          {result.plannedSql && (
            <details className="rounded-md border p-4">
              <summary className="cursor-pointer text-sm font-semibold">Planned SQL</summary>
              <pre className="mt-2 overflow-x-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">
                {result.plannedSql.trim()}
              </pre>
            </details>
          )}
          {result.sqlResult && result.sqlResult.length > 0 && (
            <details className="rounded-md border p-4" open>
              <summary className="cursor-pointer text-sm font-semibold">
                Matching cases ({result.sqlResult.length})
              </summary>
              <table className="mt-3 w-full table-auto text-xs">
                <thead className="bg-zinc-100 text-left">
                  <tr>
                    {Object.keys(result.sqlResult[0]).map((k) => (
                      <th key={k} className="px-2 py-1 font-medium">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.sqlResult.map((row, i) => (
                    <tr key={i} className="border-t">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-2 py-1 align-top">
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </section>
      )}

      <footer className="mt-12 border-t pt-6 text-xs text-zinc-500">
        Clinical posture: this investigation dashboard is CHW-side tooling. Caregiver-facing
        decisions remain deterministic + clinician-vetted stock-script (no runtime LLM). See{" "}
        <a href="/docs" className="underline">ARCHITECTURE</a> §3 carve-out.
      </footer>
    </main>
  );
}
