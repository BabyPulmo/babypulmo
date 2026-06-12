import { NextResponse } from "next/server";

// Liveness probe for the Docker healthcheck (deploy/docker-compose.yml) and
// external uptime monitors. Intentionally dependency-free: it must stay green
// even when Supabase / classifier / TTS are unreachable, so it reports only
// that the Next.js server itself is up.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, service: "babypulmo-web" });
}
