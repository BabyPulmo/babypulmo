import { NextRequest, NextResponse } from "next/server";
import { graph } from "@/agents/chw-investigate/graph";

// CHW Investigation API — drives the LangGraph agent in
// agents/chw-investigate/graph.ts. Read-only RLS enforces zero write access
// at the DB layer. Audit-log entry for every CHW question + agent step.

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { question?: string };
  if (!body.question) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }
  try {
    const result = await graph.invoke({ question: body.question } as Parameters<
      typeof graph.invoke
    >[0]);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
