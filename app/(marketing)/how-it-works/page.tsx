import Link from "next/link";
import { StepCard } from "@/components/StepCard";

const ARCHITECTURE_CHIPS = [
  { label: "User Interaction", sub: "(WhatsApp · API)" },
  { label: "Audio Processing", sub: "(librosa · ONNX)" },
  { label: "AI Intelligence", sub: "(Wav2Vec2)" },
  { label: "Knowledge Retrieval", sub: "(RAG · pgvector)" },
  { label: "Decision Layer", sub: "(rules-gated)" },
  { label: "Agent Orchestration", sub: "(MCP · LangGraph)" },
  { label: "Data Infrastructure", sub: "(Supabase · Modal)" },
  { label: "Scalability", sub: "(Continuous training)" }
];

export default function HowItWorks() {
  return (
    <div className="space-y-16 pb-16">
      {/* Steps */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <h1 className="text-center text-3xl font-bold tracking-tight text-pulmo-deep">HOW IT WORKS</h1>
          <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-pulmo-blue" />

          <div className="mt-12 grid gap-10 md:grid-cols-3 lg:grid-cols-6">
            <StepCard number={1} icon="●" title="Record Cough" body="Caregiver records child's cough via WhatsApp in Bangla." accent="blue" />
            <StepCard number={2} icon="≋" title="Audio Preprocessing" body="AI removes noise, segments cough, checks audio quality." accent="medium" />
            <StepCard number={3} icon="⌖" title="AI Respiratory Analysis" body="Wav2Vec2-XLSR-53 analyzes patterns from thousands of samples." accent="green" />
            <StepCard number={4} icon="◆" title="Severity Detection" body="Six-class pediatric classification with confidence scores." accent="gold" />
            <StepCard number={5} icon="◫" title="Medical Knowledge Retrieval" body="RAG retrieves WHO IMCI & DGHS protocols for predicted condition." accent="blue" />
            <StepCard number={6} icon="◐" title="Guidance & Referral" body="Bangla audio guidance & alert sent to nearest health worker." accent="green" />
          </div>
        </div>
      </section>

      {/* AI Architecture chip strip */}
      <section className="bg-pulmo-surface">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <h2 className="text-center text-xl font-semibold text-pulmo-blue">AI ARCHITECTURE OVERVIEW</h2>
          <p className="mt-1 text-center text-sm text-slate-600">
            Modular, cloud-native backend for scalable pediatric care.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
            {ARCHITECTURE_CHIPS.map((chip, i) => (
              <div key={chip.label} className="rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm">
                <span className="text-[10px] text-pulmo-blue">{`0${i + 1}`}</span>
                <p className="mt-1 text-xs font-semibold text-pulmo-deep">{chip.label}</p>
                <p className="text-[10px] text-slate-500">{chip.sub}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs">
            <span className="rounded-full border border-pulmo-blue/20 bg-white px-4 py-1.5 font-semibold text-pulmo-blue">
              WHO guided · IMCI aligned
            </span>
            <span className="rounded-full border border-pulmo-blue/20 bg-white px-4 py-1.5 font-semibold text-pulmo-blue">
              Bangladesh focused · DGHS protocols
            </span>
            <span className="rounded-full border border-pulmo-blue/20 bg-white px-4 py-1.5 font-semibold text-pulmo-blue">
              Bangla Voice Support
            </span>
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="rounded-2xl bg-pulmo-blue px-8 py-10 text-white shadow-md sm:px-12">
            <h3 className="text-2xl font-semibold">Empowering health workers with AI precision.</h3>
            <p className="mt-2 max-w-2xl text-white/80">
              Our technology is designed for the frontlines of rural healthcare, providing immediate,
              actionable insights where they are needed most.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/technology"
                className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-pulmo-blue shadow-sm transition hover:bg-slate-100"
              >
                View Technology Whitepaper
              </Link>
              <Link
                href="/impact"
                className="rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Request Field Study Data
              </Link>
            </div>
          </div>
        </div>
      </section>

      <p className="mx-auto max-w-3xl px-6 text-center text-xs text-slate-400">
        Clinical decisions are deterministic per{" "}
        <code className="font-mono">lib/claude.ts::decideSeverityMultiModal</code>. No runtime LLM in the
        caregiver path — see <code className="font-mono">ARCHITECTURE.md §3</code> carve-out.
      </p>
    </div>
  );
}
