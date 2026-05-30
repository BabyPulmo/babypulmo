// build-contextual-chunks.ts — one-shot ingest job that generates a Claude-
// written context prefix for every imci_chunks row, then re-embeds over
// (context || ' ' || body) for Contextual RAG retrieval (Anthropic 2024-09).
//
// Run:
//   npx tsx scripts/build-contextual-chunks.ts                 # all rows
//   npx tsx scripts/build-contextual-chunks.ts --first=10      # smoke test
//   npx tsx scripts/build-contextual-chunks.ts --dry-run --first=3
//
// Cost: ~$0.10 lifetime for the ~200 IMCI chunks (one Claude Haiku call each
// at ingest; never re-run at request time). Embeddings re-generated for any
// row where `context` changed.

import { supabaseAdmin } from "../lib/supabase";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const CONTEXT_PROMPT = (chunk: {
  source: string;
  title: string;
  age_range: string;
  body: string;
}) => `<document_source>${chunk.source}</document_source>
<section_title>${chunk.title}</section_title>
<age_range>${chunk.age_range}</age_range>
<chunk_body>
${chunk.body}
</chunk_body>

Please write a short (40–60 token) context paragraph that situates this chunk inside the WHO IMCI / Bangladesh DGHS clinical-decision-support framework. The paragraph will be PREPENDED to the chunk before embedding for Contextual RAG retrieval, so it should help a retriever match this chunk to caregiver questions like "my 18-month-old has fast breathing" or "should I give amoxicillin to a 3-year-old with cough?". Mention the decision type (severity classification / dosing / referral threshold), the relevant age band, and the symptom or red flag this chunk addresses. Output ONLY the context paragraph — no preamble, no XML tags.`;

interface ChunkRow {
  id: string;
  source: string;
  title: string;
  age_range: string;
  body: string;
  context: string | null;
}

async function claudeContext(chunk: ChunkRow): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    // Deterministic fallback so the script can dry-run without API keys
    return `[${chunk.source} · ${chunk.age_range}] ${chunk.title}. Applies to caregiver questions about pediatric respiratory symptoms in the ${chunk.age_range} age band.`;
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: CONTEXT_PROMPT(chunk) }]
    })
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content: Array<{ text: string }> };
  return data.content[0].text.trim();
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

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const firstArg = args.find((a) => a.startsWith("--first="));
  const first = firstArg ? parseInt(firstArg.split("=")[1], 10) : undefined;

  let query = supabaseAdmin
    .from("imci_chunks")
    .select("id, source, title, age_range, body, context");
  if (first) query = query.limit(first);

  const { data: chunks, error } = await query;
  if (error) throw error;
  if (!chunks || chunks.length === 0) {
    console.log("No imci_chunks found — seed_imci.sql first.");
    return;
  }

  console.log(`Processing ${chunks.length} chunks${dryRun ? " (dry-run)" : ""}`);

  let processed = 0;
  for (const chunk of chunks as ChunkRow[]) {
    const context = await claudeContext(chunk);
    const combined = `${context}\n\n${chunk.body}`;
    const embedding = await embed(combined);

    if (dryRun) {
      console.log(`\n--- ${chunk.id} :: ${chunk.title} ---`);
      console.log("CONTEXT:", context);
      console.log("EMBED dim:", embedding.length, "first 4:", embedding.slice(0, 4));
    } else {
      const { error: updErr } = await supabaseAdmin
        .from("imci_chunks")
        .update({ context, embedding })
        .eq("id", chunk.id);
      if (updErr) {
        console.error(`failed to update ${chunk.id}:`, updErr);
        continue;
      }
      console.log(`✓ ${chunk.id} :: ${chunk.title}`);
    }
    processed++;
  }
  console.log(`\nDone. ${processed} chunks processed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
