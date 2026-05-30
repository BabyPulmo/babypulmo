import { supabaseAdmin } from "./supabase";
import type { ImciChunk, CoughClass } from "./types";

const COHERE_API_KEY = process.env.COHERE_API_KEY;

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

function buildQuery(coughClass: CoughClass, ageMonths: number): string {
  return `${coughClass} pediatric child ${ageMonths} months severity assessment treatment protocol`;
}

function ageRangeFor(ageMonths: number): string {
  return ageMonths < 2 ? "0-2m" : ageMonths < 60 ? "2m-5y" : "5y+";
}

// Contextual RAG retrieval — assumes `context` column populated by
// scripts/build-contextual-chunks.ts. Embeddings already stored over
// (context || ' ' || body), so the vector index naturally retrieves chunks
// whose situating prefix matches the query.
export async function retrieveImci(
  coughClass: CoughClass,
  ageMonths: number,
  topK = 3
): Promise<ImciChunk[]> {
  const ageRange = ageRangeFor(ageMonths);
  const query = buildQuery(coughClass, ageMonths);
  const embedding = await embed(query);

  const { data, error } = await supabaseAdmin.rpc("match_imci_chunks", {
    query_embedding: embedding,
    match_count: topK,
    age_filter: ageRange
  });

  if (error || !data || data.length === 0) {
    // Fallback: ILIKE keyword filter when embeddings aren't populated yet.
    const { data: fallback } = await supabaseAdmin
      .from("imci_chunks")
      .select("id, source, title, age_range, body, context")
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

// Hybrid Search — vector + tsvector union, then Cohere multilingual reranker
// orders the merged candidates. Bangla protocol text benefits from the
// multilingual reranker more than the embedding model alone does.
export async function retrieveImciHybrid(
  coughClass: CoughClass,
  ageMonths: number,
  topK = 3,
  candidatePool = 6
): Promise<ImciChunk[]> {
  const ageRange = ageRangeFor(ageMonths);
  const queryText = buildQuery(coughClass, ageMonths);
  const embedding = await embed(queryText);

  const { data, error } = await supabaseAdmin.rpc("match_imci_chunks_hybrid", {
    query_embedding: embedding,
    query_text: queryText,
    match_count: candidatePool,
    age_filter: ageRange
  });

  if (error || !data || data.length === 0) {
    // Fall back to pure vector path on hybrid failure.
    return retrieveImci(coughClass, ageMonths, topK);
  }

  const candidates: Array<ImciChunk & { score: number }> = data.map((c: any) => ({
    id: c.id,
    source: c.source,
    title: c.title,
    ageRange: c.age_range,
    body: c.body,
    similarity: c.vec_similarity,
    score: c.vec_similarity * 0.6 + c.ts_rank * 0.4
  }));

  // Cohere rerank when an API key is present; otherwise fall back to the
  // (vec * 0.6 + ts * 0.4) blended score.
  if (COHERE_API_KEY && candidates.length > 0) {
    const docs = candidates.map((c) => c.body);
    const reranked = await cohereRerank(queryText, docs);
    reranked.forEach(({ index, relevance_score }) => {
      candidates[index].score = relevance_score;
      candidates[index].similarity = relevance_score;
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, topK).map(({ score, ...c }) => c);
}

interface CohereRerankResult {
  index: number;
  relevance_score: number;
}

async function cohereRerank(
  query: string,
  documents: string[]
): Promise<CohereRerankResult[]> {
  const res = await fetch("https://api.cohere.ai/v1/rerank", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${COHERE_API_KEY}`
    },
    body: JSON.stringify({
      model: "rerank-multilingual-v3.0",
      query,
      documents,
      top_n: documents.length
    })
  });
  if (!res.ok) throw new Error(`Cohere rerank ${res.status}`);
  const data = (await res.json()) as { results: CohereRerankResult[] };
  return data.results;
}
