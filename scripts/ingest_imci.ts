/**
 * Baby Pulmo — WHO IMCI ingest pipeline.
 *
 * Turns the WHO IMCI handbook PDF into `supabase/seed_imci_full.sql`:
 *   PDF (page-aware) → heading pre-split → semantic chunking via Claude API
 *   → OpenAI embeddings (text-embedding-3-large) → SQL INSERTs.
 *
 * This is TOOLING, run on demand (not part of the Next app build). It is
 * excluded from `tsc` and run via `tsx`:
 *
 *   npm install            # picks up pdfjs-dist + tsx (devDeps)
 *   # required env — the npm script loads these from .env.local via tsx
 *   # --env-file (or export them in your shell):
 *   #   OPENAI_API_KEY      embeddings (~pennies for the full corpus)
 *   #   ANTHROPIC_API_KEY   semantic chunking
 *   # generate the seed:
 *   npm run ingest:imci -- --pdf ./who-imci-handbook.pdf
 *   # → writes supabase/seed_imci_full.sql
 *
 *   # prove retrieval (needs the seed loaded into a live Supabase):
 *   #   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   npm run ingest:imci -- --proof
 *
 * The WHO IMCI handbook PDF path/URL is a REQUIRED input — there is no
 * hardcoded source. Obtain it from WHO's public materials.
 */

import { readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { embed } from "../lib/embeddings";

// ─── Config ─────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const CHUNK_MIN_TOKENS = 300;
const CHUNK_MAX_TOKENS = 500;
const MIN_TOTAL_CHUNKS = 150; // AC6 sanity floor
const OUT_PATH = path.resolve(process.cwd(), "supabase/seed_imci_full.sql");

interface ImciChunk {
  source: string; // who_imci | bd_dghs | …
  section: string;
  subsection: string;
  ageRange: string; // 0-2m | 2m-5y | 5y+ | all
  sourcePage: number;
  body: string;
}

// ─── 1. PDF → page-aware text ────────────────────────────────────────────────
interface Page {
  page: number;
  text: string;
}

async function loadPdfPages(pdfPath: string): Promise<Page[]> {
  // pdfjs-dist legacy build runs under Node without a DOM.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

  const pages: Page[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push({ page: p, text });
  }
  return pages;
}

// ─── 2. Heading-aware pre-split ──────────────────────────────────────────────
// Keep clinical decision-tree boundaries intact: split each page's text at
// detected section headings before handing sections to the LLM. This is a
// coarse pre-pass; Claude does the fine semantic chunking in step 3.
interface Section {
  heading: string;
  page: number;
  text: string;
}

const HEADING_RE =
  /(?:^|\s)((?:ASSESS|CLASSIFY|TREAT|IDENTIFY|CHECK|COUGH|FAST BREATHING|CHEST INDRAWING|DANGER SIGNS|PNEUMONIA|WHEEZE|STRIDOR|FEVER|DIARRHOEA|MALNUTRITION|ANAEMIA)[A-Z /,&-]{2,})/g;

function preSplit(pages: Page[]): Section[] {
  const sections: Section[] = [];
  for (const { page, text } of pages) {
    const parts = text.split(HEADING_RE).filter((s) => s && s.trim());
    if (parts.length <= 1) {
      sections.push({ heading: "", page, text });
      continue;
    }
    // split() with a capture group interleaves [pre, heading, body, heading, body...]
    for (let i = 0; i < parts.length; i += 2) {
      const heading = (parts[i + 1] ?? parts[i]).trim();
      const body = (parts[i + 2] ?? "").trim();
      if (body || heading) sections.push({ heading, page, text: body || heading });
    }
  }
  return sections;
}

// ─── 3. Semantic chunking via Claude API (raw fetch, no SDK) ─────────────────
async function chunkSection(section: Section): Promise<ImciChunk[]> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required for semantic chunking");
  }

  const prompt =
    `You are segmenting the WHO IMCI handbook for a clinical RAG index.\n` +
    `Split the SECTION TEXT into self-contained semantic chunks of about ` +
    `${CHUNK_MIN_TOKENS}-${CHUNK_MAX_TOKENS} tokens each, NEVER breaking a clinical ` +
    `decision rule across chunks (keep an "assess → classify → treat" unit together).\n` +
    `Return ONLY a JSON array; each item: ` +
    `{"section": string, "subsection": string, "age_range": "0-2m"|"2m-5y"|"5y+"|"all", "body": string}.\n\n` +
    `SECTION HEADING: ${section.heading || "(none)"}\n` +
    `SECTION TEXT:\n${section.text}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";
  const parsed = safeParseJsonArray(text);
  if (!parsed) {
    console.warn(`[chunk] malformed JSON for section p${section.page} — skipped`);
    return [];
  }

  return parsed
    .filter((c) => c && typeof c.body === "string" && c.body.trim())
    .map((c) => ({
      source: "who_imci",
      section: String(c.section ?? section.heading ?? ""),
      subsection: String(c.subsection ?? ""),
      ageRange: normalizeAge(c.age_range),
      sourcePage: section.page,
      body: c.body.trim()
    }));
}

function safeParseJsonArray(text: string): any[] | null {
  // Tolerate code fences / prose around the JSON.
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const v = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function normalizeAge(a: unknown): string {
  const s = String(a ?? "").toLowerCase();
  if (["0-2m", "2m-5y", "5y+", "all"].includes(s)) return s;
  return "all";
}

// ─── 4 + 5. Embed + emit SQL ─────────────────────────────────────────────────
function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

function vectorLiteral(v: number[]): string {
  return `'[${v.join(",")}]'::vector`;
}

async function generateSeed(chunks: ImciChunk[]): Promise<void> {
  const rows: string[] = [];
  for (const c of chunks) {
    const vec = await embed(`${c.section} ${c.subsection}\n${c.body}`.trim());
    const title = [c.section, c.subsection].filter(Boolean).join(" — ");
    const metadata = JSON.stringify({
      section: c.section,
      subsection: c.subsection,
      age_range: c.ageRange,
      source_page: c.sourcePage
    });
    rows.push(
      `('${sqlEscape(c.source)}', '${sqlEscape(title)}', '${sqlEscape(c.ageRange)}', ` +
        `'${sqlEscape(c.body)}', ${vectorLiteral(vec)}, '${sqlEscape(metadata)}'::jsonb)`
    );
  }

  const sql =
    `-- Baby Pulmo — full WHO IMCI RAG seed (generated by scripts/ingest_imci.ts)\n` +
    `-- ${chunks.length} chunks, embedded with OpenAI text-embedding-3-large (3072-dim).\n` +
    `-- Idempotent: adds the metadata column if absent; keeps the flat columns that\n` +
    `-- match_imci_chunks + lib/rag.ts already use.\n\n` +
    `alter table imci_chunks add column if not exists metadata jsonb;\n\n` +
    `insert into imci_chunks (source, title, age_range, body, embedding, metadata) values\n` +
    rows.join(",\n") +
    `;\n`;

  await writeFile(OUT_PATH, sql, "utf8");
  console.log(`Wrote ${chunks.length} chunks → ${OUT_PATH}`);
}

// ─── 6. Retrieval proof (--proof) ────────────────────────────────────────────
const SAMPLE_QUERIES = [
  "child with cough and fast breathing",
  "severe chest indrawing in a 3 year old",
  "wheezing infant trial of bronchodilator",
  "stridor when calm croup treatment",
  "whooping cough paroxysmal apnoea infant",
  "danger signs requiring urgent referral",
  "amoxicillin dosing for pneumonia",
  "cough more than 14 days",
  "normal cough no antibiotics reassurance",
  "when should the mother return immediately"
];

async function runProof(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("--proof needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  for (const q of SAMPLE_QUERIES) {
    const embedding = await embed(q);
    const { data, error } = await supabase.rpc("match_imci_chunks", {
      query_embedding: embedding,
      match_count: 3,
      age_filter: null
    });
    console.log(`\nQ: ${q}`);
    if (error) {
      console.log(`  ERROR: ${error.message}`);
      continue;
    }
    for (const row of data ?? []) {
      console.log(`  [${row.similarity?.toFixed?.(3)}] ${row.title}`);
    }
  }
}

// ─── Entry ───────────────────────────────────────────────────────────────────
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  if (process.argv.includes("--proof")) {
    await runProof();
    return;
  }

  const pdfPath = arg("pdf") ?? process.env.IMCI_PDF_PATH;
  if (!pdfPath) {
    throw new Error("provide the WHO IMCI PDF: --pdf <path> (or IMCI_PDF_PATH)");
  }

  console.log(`Loading ${pdfPath} …`);
  const pages = await loadPdfPages(pdfPath);
  console.log(`  ${pages.length} pages with text`);

  const sections = preSplit(pages);
  console.log(`  ${sections.length} pre-split sections → chunking via Claude …`);

  const chunks: ImciChunk[] = [];
  for (const section of sections) {
    chunks.push(...(await chunkSection(section)));
  }
  console.log(`  ${chunks.length} chunks`);

  if (chunks.length < MIN_TOTAL_CHUNKS) {
    throw new Error(
      `only ${chunks.length} chunks (< ${MIN_TOTAL_CHUNKS}) — check PDF extraction / chunking`
    );
  }

  await generateSeed(chunks);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
