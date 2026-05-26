// OpenAI text embeddings for IMCI semantic retrieval.
// Fail-loud: a missing key in production silently degrades RAG to keyword grep,
// so we crash at import instead of hiding a broken pipeline.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL = "text-embedding-3-large";

// Exponential backoff for transient 429s (up to 3 retries).
const RETRY_BACKOFFS_MS = [250, 500, 1000];

if (process.env.NODE_ENV === "production" && !OPENAI_API_KEY) {
  throw new Error(
    "OPENAI_API_KEY is required in production for semantic IMCI retrieval"
  );
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface EmbedDeps {
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

export async function embed(text: string, deps: EmbedDeps = {}): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set; cannot embed query");
  }

  const doFetch = deps.fetchImpl ?? fetch;
  const doSleep = deps.sleepImpl ?? defaultSleep;

  for (let attempt = 0; ; attempt++) {
    const res = await doFetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({ input: text, model: EMBEDDING_MODEL })
    });

    if (res.ok) {
      const data = await res.json();
      return data.data[0].embedding;
    }

    // Auth errors are not transient — fail immediately, no retry.
    if (res.status === 401 || res.status === 403) {
      throw new Error(`OpenAI embeddings auth error ${res.status}`);
    }

    // Rate-limited — back off and retry, then give up loudly.
    if (res.status === 429 && attempt < RETRY_BACKOFFS_MS.length) {
      await doSleep(RETRY_BACKOFFS_MS[attempt]);
      continue;
    }

    throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
  }
}
