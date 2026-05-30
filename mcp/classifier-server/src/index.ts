#!/usr/bin/env node
// Baby Pulmo Classifier MCP Server
// ────────────────────────────────────────────────────────────────────────────
// Exposes Baby Pulmo's three runtime primitives as MCP tools over stdio so
// any MCP-capable client (Claude Desktop, Cursor, Continue, a hospital EHR
// integration agent) can drive them.
//
//   • classify_cough         — pediatric cough → 6-class + confidence + RR
//   • score_severity         — multi-modal severity decision (audio + RR +
//                              ChildProfile + optional CXR finding)
//   • find_nearest_chw       — PostGIS-backed nearest Community Health Worker
//
// Same backing endpoints as the production webhook — this server is a thin
// MCP adapter, not a re-implementation. Reuse across clients means a single
// versioned classifier surface for every downstream consumer.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const CLASSIFIER_ENDPOINT = process.env.CLASSIFIER_ENDPOINT;
const CLASSIFIER_API_KEY = process.env.CLASSIFIER_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const COUGH_CLASSES = [
  "healthy",
  "common_cold",
  "bronchiolitis",
  "pneumonia",
  "asthma",
  "croup"
] as const;

const TACHYPNEA_THRESHOLDS = {
  "0-2m": 60,
  "2m-12m": 50,
  "12m-60m": 40
} as const;

const TOOLS: Tool[] = [
  {
    name: "classify_cough",
    description:
      "Run the Baby Pulmo Wav2Vec2 pediatric cough classifier on a 30-second voice note. Returns 6-class probabilities (healthy / common_cold / bronchiolitis / pneumonia / asthma / croup), confidence, Grad-CAM heatmap URL, and an automatically-measured respiratory rate (breaths/min). Audio expected as a signed HTTPS URL to a WAV / OGG / MP3 file.",
    inputSchema: {
      type: "object",
      properties: {
        audio_url: {
          type: "string",
          description: "Signed HTTPS URL to the 30-second voice note."
        }
      },
      required: ["audio_url"]
    }
  },
  {
    name: "score_severity",
    description:
      "Apply Baby Pulmo's deterministic, rules-gated multi-modal severity decision over (cough class + confidence + breathsPerMin + ChildProfile + optional CXR finding). Returns one of {critical / high / moderate / low} severity, a recommended action, an escalation boolean, and a reason code (audio_class / tachypnea_override / cxr_override / fail_closed_default). NO LLM is invoked — this is the same deterministic function the production webhook uses, exposed for integration testing and clinical-assistant tooling.",
    inputSchema: {
      type: "object",
      properties: {
        cough_class: { type: "string", enum: COUGH_CLASSES as unknown as string[] },
        confidence: { type: "number", description: "0.0 to 1.0" },
        breaths_per_min: {
          type: ["number", "null"],
          description:
            "Auto-measured respiratory rate; null when audio too noisy to count."
        },
        age_months: { type: "number" },
        fever: { type: "boolean" },
        cxr_pneumonia_prob: {
          type: ["number", "null"],
          description: "Optional chest X-ray pneumonia probability if a CXR was uploaded."
        }
      },
      required: ["cough_class", "confidence", "age_months"]
    }
  },
  {
    name: "find_nearest_chw",
    description:
      "PostGIS Haversine lookup for the nearest available Community Health Worker to a (lat, lon) coordinate within a given radius. Used by the production webhook's escalation path; exposed here so investigation tooling (Claude Desktop, hospital ER assistants) can run the same query.",
    inputSchema: {
      type: "object",
      properties: {
        lat: { type: "number" },
        lon: { type: "number" },
        radius_km: { type: "number", default: 25 }
      },
      required: ["lat", "lon"]
    }
  }
];

const server = new Server(
  { name: "babypulmo-classifier", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    if (name === "classify_cough") {
      const { audio_url } = z.object({ audio_url: z.string().url() }).parse(args);
      return jsonResult(await callClassifier(audio_url));
    }
    if (name === "score_severity") {
      return jsonResult(scoreSeverity(args ?? {}));
    }
    if (name === "find_nearest_chw") {
      const { lat, lon, radius_km } = z
        .object({
          lat: z.number(),
          lon: z.number(),
          radius_km: z.number().default(25)
        })
        .parse(args);
      return jsonResult(await findNearestChw(lat, lon, radius_km));
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

async function callClassifier(audioUrl: string) {
  if (!CLASSIFIER_ENDPOINT) {
    return mockClassification(audioUrl);
  }
  const res = await fetch(CLASSIFIER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(CLASSIFIER_API_KEY ? { Authorization: `Bearer ${CLASSIFIER_API_KEY}` } : {})
    },
    body: JSON.stringify({ audio_url: audioUrl })
  });
  if (!res.ok) throw new Error(`classifier ${res.status}: ${await res.text()}`);
  return await res.json();
}

function mockClassification(audioUrl: string) {
  return {
    class: "pneumonia",
    confidence: 0.71,
    class_probs: {
      healthy: 0.02,
      common_cold: 0.06,
      bronchiolitis: 0.12,
      pneumonia: 0.71,
      asthma: 0.06,
      croup: 0.03
    },
    breaths_per_min: 52,
    rr_confidence: "medium",
    model_version: "mock-v0",
    audio_url: audioUrl
  };
}

function scoreSeverity(args: Record<string, unknown>) {
  const coughClass = String(args.cough_class ?? "");
  const confidence = Number(args.confidence ?? 0);
  const breathsPerMin =
    args.breaths_per_min === null || args.breaths_per_min === undefined
      ? null
      : Number(args.breaths_per_min);
  const ageMonths = Number(args.age_months ?? 12);
  const cxrPneumonia =
    args.cxr_pneumonia_prob === null || args.cxr_pneumonia_prob === undefined
      ? null
      : Number(args.cxr_pneumonia_prob);

  const respiratoryClasses = ["pneumonia", "bronchiolitis", "croup"];
  const tachypneaThreshold = tachypneaFor(ageMonths);

  if (cxrPneumonia !== null && cxrPneumonia >= 0.6) {
    return {
      severity: "critical",
      recommended_action: "see_chw_now",
      must_escalate: true,
      reason: "cxr_override"
    };
  }
  if (
    breathsPerMin !== null &&
    breathsPerMin >= tachypneaThreshold &&
    respiratoryClasses.includes(coughClass) &&
    confidence >= 0.3
  ) {
    return {
      severity: "critical",
      recommended_action: "see_chw_now",
      must_escalate: true,
      reason: "tachypnea_override"
    };
  }
  if (coughClass === "healthy") {
    return {
      severity: "low",
      recommended_action: "normal",
      must_escalate: false,
      reason: "audio_class"
    };
  }
  if (confidence >= 0.5) {
    return {
      severity: respiratoryClasses.includes(coughClass) ? "high" : "moderate",
      recommended_action: respiratoryClasses.includes(coughClass)
        ? "see_chw_now"
        : "see_doctor_24h",
      must_escalate: respiratoryClasses.includes(coughClass),
      reason: "audio_class"
    };
  }
  return {
    severity: "high",
    recommended_action: "see_chw_now",
    must_escalate: true,
    reason: "fail_closed_default"
  };
}

function tachypneaFor(ageMonths: number): number {
  if (ageMonths < 2) return TACHYPNEA_THRESHOLDS["0-2m"];
  if (ageMonths < 12) return TACHYPNEA_THRESHOLDS["2m-12m"];
  if (ageMonths < 60) return TACHYPNEA_THRESHOLDS["12m-60m"];
  return Infinity;
}

async function findNearestChw(lat: number, lon: number, radiusKm: number) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return [
      {
        id: "demo-chw-1",
        name: "Demo CHW (Bogura)",
        whatsapp_number: "8801711111111",
        district: "Bogura",
        distance_km: 3.2
      }
    ];
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_nearest_chw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ lat, lon, radius_km: radiusKm })
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return await res.json();
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[babypulmo-classifier-mcp] ready on stdio");
