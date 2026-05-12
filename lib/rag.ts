import { supabaseAdmin } from "./supabase";
import type { ImciChunk, CoughClass } from "./types";

async function embed(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    // Demo fallback: return zero vector when OpenAI key is absent.
    return new Array(3072).fill(0);
  }
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({ input: text, model: "text-embedding-3-large" })
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

export async function retrieveImci(
  coughClass: CoughClass,
  ageMonths: number,
  topK = 3
): Promise<ImciChunk[]> {
  const ageRange = ageMonths < 2 ? "0-2m" : ageMonths < 60 ? "2m-5y" : "5y+";
  const query = `${coughClass} pediatric child ${ageMonths} months severity assessment treatment protocol`;
  const embedding = await embed(query);

  // Try vector match via rpc
  const { data, error } = await supabaseAdmin.rpc("match_imci_chunks", {
    query_embedding: embedding,
    match_count: topK,
    age_filter: ageRange
  });

  if (error || !data || data.length === 0) {
    // Fallback: filter by class keyword in body when embeddings aren't populated yet
    const { data: fallback } = await supabaseAdmin
      .from("imci_chunks")
      .select("id, source, title, age_range, body")
      .or(`age_range.eq.${ageRange},age_range.eq.all`)
      .ilike("body", `%${coughClass}%`)
      .limit(topK);
    return (fallback ?? []).map((c) => ({
      id: c.id,
      source: c.source,
      title: c.title,
      ageRange: c.age_range,
      body: c.body,
      similarity: 0
    }));
  }

  return data.map((c: any) => ({
    id: c.id,
    source: c.source,
    title: c.title,
    ageRange: c.age_range,
    body: c.body,
    similarity: c.similarity
  }));
}
