#!/usr/bin/env node
// Baby Pulmo CHW Routing MCP Server
// ────────────────────────────────────────────────────────────────────────────
// Exposes Community Health Worker geo-routing as MCP tools so partner systems
// (BRAC operations dashboard, Bangladesh DGHS district health planning,
// telemedicine triage apps) can drive the same PostGIS Haversine + district
// load-balancing primitives Baby Pulmo's production webhook uses.

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

const TOOLS: Tool[] = [
  {
    name: "nearest_chw",
    description:
      "PostGIS Haversine lookup for the nearest available Community Health Worker to a (lat, lon) coordinate within `radius_km`. Returns CHWs ranked by distance, with current case-load and last-active timestamp.",
    inputSchema: {
      type: "object",
      properties: {
        lat: { type: "number" },
        lon: { type: "number" },
        radius_km: { type: "number", default: 25 },
        max_results: { type: "number", default: 5 }
      },
      required: ["lat", "lon"]
    }
  },
  {
    name: "chw_load_balance",
    description:
      "Returns CHWs across a named district, ordered by current case load ascending. Used by partner-system batch dispatch where geo-distance is less important than equalizing CHW workload.",
    inputSchema: {
      type: "object",
      properties: {
        district: { type: "string" },
        max_results: { type: "number", default: 10 }
      },
      required: ["district"]
    }
  }
];

const server = new Server(
  { name: "babypulmo-chw-routing", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    if (name === "nearest_chw") {
      const p = z
        .object({
          lat: z.number(),
          lon: z.number(),
          radius_km: z.number().default(25),
          max_results: z.number().default(5)
        })
        .parse(args);
      return jsonResult(await nearestChw(p.lat, p.lon, p.radius_km, p.max_results));
    }
    if (name === "chw_load_balance") {
      const p = z
        .object({
          district: z.string(),
          max_results: z.number().default(10)
        })
        .parse(args);
      return jsonResult(await chwLoadBalance(p.district, p.max_results));
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

async function nearestChw(
  lat: number,
  lon: number,
  radiusKm: number,
  maxResults: number
) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return [
      {
        id: "demo-chw-1",
        name: "Demo CHW (Bogura)",
        district: "Bogura",
        whatsapp_number: "8801711111111",
        distance_km: 3.2,
        active_cases: 4
      },
      {
        id: "demo-chw-2",
        name: "Demo CHW (Sherpur)",
        district: "Sherpur",
        whatsapp_number: "8801822222222",
        distance_km: 8.1,
        active_cases: 2
      }
    ].slice(0, maxResults);
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_nearest_chw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ lat, lon, radius_km: radiusKm, max_results: maxResults })
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function chwLoadBalance(district: string, maxResults: number) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return [
      { id: "demo-chw-2", name: "Demo CHW (Sherpur)", district, active_cases: 2 },
      { id: "demo-chw-1", name: "Demo CHW (Bogura)", district, active_cases: 4 }
    ].slice(0, maxResults);
  }
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/chws?district=eq.${encodeURIComponent(district)}&order=active_cases.asc&limit=${maxResults}`,
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

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[babypulmo-chw-routing-mcp] ready on stdio");
