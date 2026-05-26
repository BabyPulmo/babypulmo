import { supabaseAdmin } from "./supabase";
import { embed } from "./embeddings";
import type { ImciChunk, CoughClass } from "./types";

export async function retrieveImci(
  coughClass: CoughClass,
  ageMonths: number,
  topK = 3
): Promise<ImciChunk[]> {
  const ageRange = ageMonths < 2 ? "0-2m" : ageMonths < 60 ? "2m-5y" : "5y+";
  const query = `${coughClass} pediatric child ${ageMonths} months severity assessment treatment protocol`;

  // The only sanctioned keyword fallback: an intentionally-unembeddable (empty)
  // query. Errors and rate-limits propagate from embed() instead of silently
  // degrading to grep.
  if (query.trim() === "") {
    return keywordSearch(coughClass, ageRange, topK);
  }

  const embedding = await embed(query);

  const { data, error } = await supabaseAdmin.rpc("match_imci_chunks", {
    query_embedding: embedding,
    match_count: topK,
    age_filter: ageRange
  });

  if (error) {
    throw new Error(`match_imci_chunks RPC failed: ${error.message}`);
  }

  // 0 rows is an honest "no matches" (e.g. embeddings not seeded) — return it as
  // such rather than masking it with a keyword search.
  return (data ?? []).map((c: any) => ({
    id: c.id,
    source: c.source,
    title: c.title,
    ageRange: c.age_range,
    body: c.body,
    similarity: c.similarity
  }));
}

// Keyword search over IMCI bodies. Reserved for the empty-query path above.
async function keywordSearch(
  coughClass: CoughClass,
  ageRange: string,
  topK: number
): Promise<ImciChunk[]> {
  const { data } = await supabaseAdmin
    .from("imci_chunks")
    .select("id, source, title, age_range, body")
    .or(`age_range.eq.${ageRange},age_range.eq.all`)
    .ilike("body", `%${coughClass}%`)
    .limit(topK);

  return (data ?? []).map((c) => ({
    id: c.id,
    source: c.source,
    title: c.title,
    ageRange: c.age_range,
    body: c.body,
    similarity: 0
  }));
}
