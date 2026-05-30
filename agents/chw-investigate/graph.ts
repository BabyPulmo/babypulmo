// CHW investigation agent — LangGraph orchestration powering /chw/investigate.
//
// ──────────────────────────────────────────────────────────────────────────
// CLINICAL POSTURE: This agent is a CHW-side investigation tool ONLY. It
// READS from audit_log and from the IMCI RAG; it never WRITES, never sends
// a caregiver message, and never participates in a severity decision. RLS
// enforces read-only at the database layer. See ARCHITECTURE.md §3 carve-out.
// ──────────────────────────────────────────────────────────────────────────
//
// Pipeline:
//   parse_question → plan_sql → run_sql → query_imci → summarize → END
//
// Example question: "Show me Bogura pneumonia cases last week with
// confidence < 0.6 that did not get a CHW response within 30 minutes."
//
// → plan_sql:  WHERE district = 'Bogura' AND severity = 'high'
//              AND created_at >= now() - interval '7 days'
//              AND (payload->>'confidence')::float < 0.6
// → run_sql:   {rows: [...]}
// → query_imci(symptom='pneumonia', age_months=18) → 3 IMCI chunks
// → summarize: "12 cases match. 4 of them ..."

import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";

interface InvestigateState {
  question: string;
  plannedSql?: string;
  sqlResult?: Array<Record<string, unknown>>;
  imciContext?: string;
  summary?: string;
}

const llm = process.env.ANTHROPIC_API_KEY
  ? new ChatAnthropic({ model: "claude-haiku-4-5-20251001", temperature: 0.1 })
  : null;

async function parseQuestion(_: InvestigateState): Promise<Partial<InvestigateState>> {
  // No-op in the scaffold; production version extracts (district, time_window,
  // class_filter, confidence_threshold) structured params via tool-use.
  return {};
}

async function planSql(state: InvestigateState): Promise<Partial<InvestigateState>> {
  // Stub: ship a safe template the production version will parameterize.
  const sql = `
    SELECT id, created_at, payload, recording_id, caregiver_id
    FROM audit_log
    WHERE event_type = 'classification_complete'
      AND created_at >= NOW() - INTERVAL '7 days'
      AND (payload->>'severity') = 'high'
      AND (payload->>'confidence')::float < 0.6
    ORDER BY created_at DESC
    LIMIT 50;
  `;
  return { plannedSql: sql.trim() };
}

async function runSql(state: InvestigateState): Promise<Partial<InvestigateState>> {
  // Scaffold: production hits Supabase service-role with the planned SQL.
  // Production also wraps in a read-only transaction + sets statement_timeout.
  return {
    sqlResult: [
      {
        id: "demo-1",
        created_at: "2026-05-28T14:32:00Z",
        confidence: 0.42,
        cough_class: "pneumonia",
        breaths_per_min: 53,
        district: "Bogura"
      }
    ]
  };
}

async function queryImci(state: InvestigateState): Promise<Partial<InvestigateState>> {
  // In production calls the imci-rag-mcp server's query_imci tool.
  return {
    imciContext:
      "WHO IMCI fast-breathing rule (2-12 months): ≥50 bpm = pneumonia. Borderline cases require chest indrawing assessment."
  };
}

async function summarize(state: InvestigateState): Promise<Partial<InvestigateState>> {
  if (!llm) {
    return {
      summary: `Scaffold mode — found ${state.sqlResult?.length ?? 0} matching cases. Set ANTHROPIC_API_KEY for full summary.`
    };
  }
  const out = await llm.invoke([
    {
      role: "system",
      content:
        "You summarize CHW investigation results for a Bangladesh Community Health Worker. Reply in Bangla. Cite the IMCI context. Never claim a diagnosis — only describe what the data shows and what the CHW should investigate further."
    },
    {
      role: "user",
      content: `Question: ${state.question}\n\nSQL result (${state.sqlResult?.length ?? 0} rows): ${JSON.stringify(state.sqlResult)}\n\nIMCI context: ${state.imciContext}`
    }
  ]);
  return { summary: typeof out.content === "string" ? out.content : JSON.stringify(out.content) };
}

const graph = new StateGraph<InvestigateState>({
  channels: {
    question: { value: (x, y) => y ?? x, default: () => "" },
    plannedSql: { value: (x, y) => y ?? x, default: () => undefined },
    sqlResult: { value: (x, y) => y ?? x, default: () => undefined },
    imciContext: { value: (x, y) => y ?? x, default: () => undefined },
    summary: { value: (x, y) => y ?? x, default: () => undefined }
  }
})
  .addNode("parse_question", parseQuestion)
  .addNode("plan_sql", planSql)
  .addNode("run_sql", runSql)
  .addNode("query_imci", queryImci)
  .addNode("summarize", summarize)
  .addEdge(START, "parse_question")
  .addEdge("parse_question", "plan_sql")
  .addEdge("plan_sql", "run_sql")
  .addEdge("run_sql", "query_imci")
  .addEdge("query_imci", "summarize")
  .addEdge("summarize", END)
  .compile();

export { graph };
export type { InvestigateState };
