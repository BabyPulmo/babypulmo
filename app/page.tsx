import Link from "next/link";
import { StatTile } from "@/components/StatTile";
import { StepCard } from "@/components/StepCard";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-pulmo-blue">
              THE INFINITY AI BUILDFEST 2026 · HealthTech
            </p>
            <h1 className="mt-3 text-5xl font-bold leading-tight text-pulmo-deep">Baby Pulmo</h1>
            <p className="bn font-bangla mt-2 text-2xl italic text-slate-600">
            </p>
            <p className="mt-6 text-lg text-slate-700">
              AI Pediatric Diagnostic for Rural Bangladesh
            </p>
            <p className="mt-2 text-base text-slate-600">
              Early detection. Timely guidance.
              <br />
              Healthier children, stronger communities.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-lg bg-pulmo-blue px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-pulmo-medium"
              >
                ● Record Cough
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-lg bg-pulmo-green px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                ◇ Try WhatsApp
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-pulmo-deep shadow-sm transition hover:border-pulmo-blue hover:text-pulmo-blue"
              >
                Learn How It Works →
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 md:grid-cols-4">
              <StatTile icon="✓" label="WHO guided" sub="IMCI aligned" />
              <StatTile icon="◎" label="Bangladesh focused" sub="DGHS protocols" />
              <StatTile icon="♪" label="Bangla Voice Support" sub="Child & caregiver friendly" />
              <StatTile icon="✿" label="AI Explainability" sub="Transparent & private" />
            </div>
          </div>
          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-gradient-to-br from-pulmo-blue/30 via-pulmo-green/20 to-pulmo-gold/30 shadow-xl">
              <div className="absolute inset-0 flex items-end justify-center pb-8 text-center">
                <p className="rounded-xl bg-white/80 px-4 py-3 text-xs text-slate-600 backdrop-blur">
                  Mother-child hero illustration placeholder.
                  <br />
                  See <code className="font-mono">design.md §7</code>.
                </p>
              </div>
            </div>
            <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-pulmo-deep shadow-md backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-pulmo-green" />
              AI Analysis · 89% Confidence
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-pulmo-surface">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight text-pulmo-deep">HOW IT WORKS</h2>
          <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-pulmo-blue" />
          <div className="mt-12 grid gap-8 md:grid-cols-3 lg:grid-cols-6">
            <StepCard number={1} icon="●" title="Record Cough" body="Caregiver records child's cough via WhatsApp in Bangla." accent="blue" />
            <StepCard number={2} icon="≋" title="Audio Preprocessing" body="AI removes noise, segments cough, checks audio quality." accent="medium" />
            <StepCard number={3} icon="⌖" title="AI Respiratory Analysis" body="Wav2Vec2-XLSR-53 analyzes patterns from thousands of samples." accent="green" />
            <StepCard number={4} icon="●" title="Severity Detection" body="Six-class pediatric classification with confidence scores." accent="gold" />
            <StepCard number={5} icon="◫" title="Medical Knowledge Retrieval" body="RAG retrieves WHO IMCI & DGHS protocols for predicted condition." accent="blue" />
            <StepCard number={6} icon="◐" title="Guidance & Referral" body="Bangla audio guidance & alert sent to nearest health worker." accent="green" />
          </div>
        </div>
      </section>

      {/* Trust + CTA bar */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16">
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
    </>
  );
}
