import { RecordingMockup } from "@/components/RecordingMockup";
import { ResultsCard } from "@/components/ResultsCard";
import { SpectrogramCard, ConfidenceDonut } from "@/components/SpectrogramCard";

export default function DemoPage() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="text-center text-3xl font-bold tracking-tight text-pulmo-blue">LIVE DEMO</h1>
        <p className="mt-2 text-center text-sm text-slate-600">See how Baby Pulmo works in real time</p>

        <div className="mt-12 grid items-start gap-12 lg:grid-cols-2">
          {/* Left — recording mockup */}
          <RecordingMockup timer="00:07" />

          {/* Right — results column */}
          <div className="space-y-4">
            <ResultsCard
              riskLevel="Moderate"
              confidence={89}
              possibleCondition="Bronchiolitis"
              recommendation="Visit nearby health center within 24 hours."
            />
            <div className="grid grid-cols-2 gap-4">
              <ConfidenceDonut value={89} />
              <SpectrogramCard />
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-pulmo-surface p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pulmo-blue text-white">
                ♪
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Bangla Audio Guidance
                </p>
                <p className="bn font-bangla mt-1 text-sm text-pulmo-deep">
                  শিশুর কাশিতে নিউমোনিয়ার আলামত — &lsquo;Signs of pneumonia in the child&rsquo;s cough.&rsquo;
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Verbatim Bangla from{" "}
                  <code className="font-mono">lib/tts.ts::STOCK_BANGLA</code>; rendered from a static fixture
                  in this demo — no runtime LLM.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-12 max-w-3xl text-center text-xs text-slate-400">
          Decision logic comes from{" "}
          <code className="font-mono">lib/claude.ts::decideSeverityMultiModal</code> (deterministic). The
          Bangla guidance is a clinician-vetted stock script per{" "}
          <code className="font-mono">ARCHITECTURE.md §3</code> carve-out.
        </p>
      </div>
    </section>
  );
}
