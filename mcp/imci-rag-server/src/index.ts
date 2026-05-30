#!/usr/bin/env node
// Baby Pulmo IMCI / DGHS RAG MCP Server
// ────────────────────────────────────────────────────────────────────────────
// Exposes the WHO IMCI + Bangladesh DGHS pediatric protocol knowledge base
// over MCP. Same pgvector index Baby Pulmo's production webhook uses; same
// Anthropic-style Contextual RAG retrieval (per-chunk situating prefix).
//
// Tools:
//   • query_imci(symptom, age_months)             — Contextual-RAG retrieval
//   • query_imci_contextual(...)                  — explicit alias used by
//                                                   downstream clinical agents
//                                                   that want the prefix back
//   • list_imci_sections()                        — index of IMCI section titles
//   • get_dosing(drug, age_months, weight_kg)     — Bangladesh DGHS dosing rows
//
// Why: any clinical AI assistant (Claude Desktop session by a pediatrician,
// hospital EHR agent, telemedicine app) can pull the same authoritative
// pediatric protocol passages the Baby Pulmo runtime cites — single source
// of truth for clinical references.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const TOOLS: Tool[] = [
  {
    name: "query_imci",
    description:
      "Contextual-RAG retrieval over the WHO IMCI + Bangladesh DGHS pediatric respiratory protocols. Returns top-K chunks ranked by embedding similarity over (context-prefix || ' ' || body). Use for any caregiver / clinician question about pediatric pneumonia / bronchiolitis / asthma / croup management.",
    inputSchema: {
      type: "object",
      properties: {
        symptom: { type: "string", description: "Free-text symptom or clinical question." },
        age_months: {
          type: "number",
          description: "Child age in months; results are age-band filtered (0-2m, 2m-5y, 5y+)."
        },
        top_k: { type: "number", default: 3 }
      },
      required: ["symptom", "age_months"]
    }
  },
  {
    name: "query_imci_contextual",
    description:
      "Same as query_imci but also returns each chunk's situating context prefix (generated one-shot at ingest by scripts/build-contextual-chunks.ts). Use when the downstream clinical agent needs to cite WHICH IMCI section a chunk belongs to.",
    inputSchema: {
      type: "object",
      properties: {
        symptom: { type: "string" },
        age_months: { type: "number" },
        top_k: { type: "number", default: 3 }
      },
      required: ["symptom", "age_months"]
    }
  },
  {
    name: "list_imci_sections",
    description:
      "Return the full index of IMCI / DGHS / UNICEF section titles available in the knowledge base. Useful for clinical agents that want to verify coverage before retrieval.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_dosing",
    description:
      "Look up Bangladesh DGHS / WHO IMCI pediatric drug dosing for amoxicillin / azithromycin / dexamethasone / salbutamol etc. by age (months) and optional weight (kg).",
    inputSchema: {
      type: "object",
      properties: {
        drug: { type: "string" },
        age_months: { type: "number" },
        weight_kg: { type: ["number", "null"] }
      },
      required: ["drug", "age_months"]
    }
  }
];

const server = new Server(
  { name: "babypulmo-imci-rag", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    if (name === "query_imci" || name === "query_imci_contextual") {
      const { symptom, age_months, top_k } = z
        .object({
          symptom: z.string(),
          age_months: z.number(),
          top_k: z.number().default(3)
        })
        .parse(args);
      return jsonResult(
        await queryImci(symptom, age_months, top_k, name === "query_imci_contextual")
      );
    }
    if (name === "list_imci_sections") return jsonResult(await listSections());
    if (name === "get_dosing") {
      const { drug, age_months, weight_kg } = z
        .object({
          drug: z.string(),
          age_months: z.number(),
          weight_kg: z.number().nullable().optional()
        })
        .parse(args);
      return jsonResult(getDosing(drug, age_months, weight_kg ?? null));
    }
    return errorResult(`unknown tool: ${name}`);
  } catch (e) {
    return errorResult(e instanceof Error ? e.message : String(e));
  }
});

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }]
  };
}
function errorResult(msg: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: msg }]
  };
}

async function embed(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) return new Array(3072).fill(0);
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({ input: text, model: "text-embedding-3-large" })
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

async function queryImci(
  symptom: string,
  ageMonths: number,
  topK: number,
  includeContext: boolean
) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return mockChunks(includeContext);
  const ageRange = ageMonths < 2 ? "0-2m" : ageMonths < 60 ? "2m-5y" : "5y+";
  const embedding = await embed(symptom);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_imci_chunks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_count: topK,
      age_filter: ageRange
    })
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    title: r.title,
    age_range: r.age_range,
    body: r.body,
    similarity: r.similarity,
    ...(includeContext ? { context: r.context } : {})
  }));
}

function mockChunks(includeContext: boolean) {
  return [
    {
      id: "demo-1",
      source: "who_imci",
      title: "Pneumonia: Fast Breathing Classification",
      age_range: "2m-5y",
      body:
        "A child with cough or difficult breathing with fast breathing (50+ breaths/minute for age 2m-12m, 40+ for age 12m-5y) without chest indrawing has pneumonia. Give amoxicillin for 5 days.",
      similarity: 0.81,
      ...(includeContext
        ? {
            context:
              "WHO IMCI fast-breathing decision rule for children 2 months to 5 years; defines the tachypnea thresholds that trigger pneumonia classification and oral amoxicillin treatment."
          }
        : {})
    }
  ];
}

async function listSections() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return [
      { source: "who_imci", title: "Pneumonia: Severe — Chest Indrawing Signs", age_range: "2m-5y" },
      { source: "who_imci", title: "Pneumonia: Fast Breathing Classification", age_range: "2m-5y" },
      { source: "who_imci", title: "No Pneumonia: Cough or Cold", age_range: "2m-5y" }
    ];
  }
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/imci_chunks?select=source,title,age_range&order=source.asc,title.asc`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return await res.json();
}

// Hard-coded dosing table (Bangladesh DGHS Standard Treatment Guidelines).
// In production this would itself be retrieved from a dosing-specific
// pgvector index; the table is included here for offline / disconnected
// CHW use.
function getDosing(drug: string, ageMonths: number, weightKg: number | null) {
  const d = drug.toLowerCase();
  if (d.includes("amox")) {
    return {
      drug: "amoxicillin",
      route: "oral",
      dose: weightKg ? `${(40 * weightKg).toFixed(0)} mg twice daily for 5 days` : "40 mg/kg twice daily for 5 days",
      indication: "pneumonia (IMCI fast-breathing classification, no chest indrawing)",
      contraindication: "penicillin allergy"
    };
  }
  if (d.includes("azith")) {
    return {
      drug: "azithromycin",
      route: "oral",
      dose: weightKg ? `${(10 * weightKg).toFixed(0)} mg once daily for 5 days` : "10 mg/kg once daily for 5 days",
      indication: "suspected pertussis or atypical pneumonia",
      contraindication: "macrolide allergy"
    };
  }
  if (d.includes("dexa") || d.includes("budes")) {
    return {
      drug: "dexamethasone (oral) or budesonide (nebulised)",
      route: "oral / nebulised",
      dose: "0.6 mg/kg PO single dose for moderate croup",
      indication: "moderate-severe croup with stridor"
    };
  }
  if (d.includes("salb") || d.includes("alb")) {
    return {
      drug: "salbutamol (albuterol)",
      route: "MDI + spacer",
      dose: "100 mcg per puff, 2-6 puffs every 20 minutes",
      indication: "acute wheeze, asthma exacerbation"
    };
  }
  return { error: `no dosing entry for ${drug}; supported: amoxicillin, azithromycin, dexamethasone, salbutamol` };
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[babypulmo-imci-rag-mcp] ready on stdio");
