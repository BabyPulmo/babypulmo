// /docs — Live documentation module. Renders the canonical project docs
// (architecture, costs, accuracy, team) as a single scrollable page plus an
// interactive DuckDB-WASM cell over the latest Parquet audit-log partition.
//
// Built per the BuildFest "live /docs module" bonus rubric. Acts as the
// project's live pitch deck + technical whitepaper + system dashboard.

import { promises as fs } from "node:fs";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AuditAnalytics from "./sections/AuditAnalytics";

export const dynamic = "force-static";
export const revalidate = 3600;

async function readMd(...rel: string[]): Promise<string> {
  const root = process.cwd();
  // The docs page is inside babypulmo/, but our canonical docs are spread
  // across babypulmo/ and the parent submission/ directory.
  const tries = [
    path.join(root, ...rel),
    path.join(root, "..", ...rel)
  ];
  for (const p of tries) {
    try {
      return await fs.readFile(p, "utf-8");
    } catch {}
  }
  return `*Document not found: ${rel.join("/")}*`;
}

export default async function DocsPage() {
  const [architecture, costs, accuracy, summary] = await Promise.all([
    readMd("ARCHITECTURE.md"),
    readMd("COSTS.md"),
    readMd("..", "submission", "accuracy.md").catch(() => readMd("submission", "accuracy.md")),
    readMd("..", "submission", "summary.md").catch(() => readMd("submission", "summary.md"))
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-bold">Baby Pulmo — Live Docs</h1>
        <p className="mt-2 text-zinc-600">
          Architecture, costs, realistic accuracy expectations, and live audit-log analytics for
          BuildFest 2026 judges.
        </p>
        <nav className="mt-4 flex flex-wrap gap-4 text-sm">
          <a href="#summary" className="text-emerald-600 underline">Summary</a>
          <a href="#architecture" className="text-emerald-600 underline">Architecture</a>
          <a href="#accuracy" className="text-emerald-600 underline">Accuracy</a>
          <a href="#costs" className="text-emerald-600 underline">Costs</a>
          <a href="#analytics" className="text-emerald-600 underline">Live analytics</a>
          <a href="#team" className="text-emerald-600 underline">Team</a>
        </nav>
      </header>

      <Section id="summary" title="Summary">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
      </Section>

      <Section id="architecture" title="Architecture">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{architecture}</ReactMarkdown>
      </Section>

      <Section id="accuracy" title="Accuracy expectations">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{accuracy}</ReactMarkdown>
      </Section>

      <Section id="costs" title="Costs">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{costs}</ReactMarkdown>
      </Section>

      <Section id="analytics" title="Live audit-log analytics (DuckDB-WASM)">
        <AuditAnalytics />
      </Section>

      <Section id="team" title="Team & advisors">
        <ul className="ml-6 list-disc text-sm">
          <li>Ferdous Alam — founder, lead engineer, deployment (Bangladesh)</li>
          <li>Faiyad Irfan Hares — backend & ML engineering (Canada / NRB)</li>
          <li>Shanta Khatun — UI, video, design (Bangladesh, female member)</li>
          <li>Abdullah Al Masum — business, data engineering (Bangladesh)</li>
          <li>Dr. Al Muktafi Saadi — clinical advisor, pediatrician (outreach in progress)</li>
        </ul>
      </Section>

      <footer className="mt-16 border-t pt-6 text-xs text-zinc-500">
        Generated from canonical project documents. Source: GitHub{" "}
        <a className="underline" href="https://github.com/BabyPulmo/babypulmo">BabyPulmo/babypulmo</a>.
      </footer>
    </main>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 border-t pt-8">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="prose prose-zinc mt-4 max-w-none text-sm">{children}</div>
    </section>
  );
}
