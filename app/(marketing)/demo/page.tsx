"use client";

import { useState } from "react";
import { CoughRecorder, type DemoResult } from "@/components/CoughRecorder";
import { ConfidenceDonut } from "@/components/SpectrogramCard";
import type { ChildProfile } from "@/lib/types";

const SEVERITY_STYLE: Record<DemoResult["severity"], string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  moderate: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-emerald-100 text-emerald-800 border-emerald-200"
};

const REASON_LABEL: Record<string, string> = {
  cxr_override: "Chest X-ray override",
  tachypnea_override: "Fast-breathing (tachypnea) override",
  audio_class: "Cough-class rule",
  fail_closed_default: "Fail-closed default (no rule matched)"
};

export default function DemoPage() {
  const [ageMonths, setAgeMonths] = useState(12);
  const [fever, setFever] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);

  const profile: ChildProfile = { ageMonths, sex: "M", fever };

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="text-center text-3xl font-bold tracking-tight text-pulmo-blue">LIVE DEMO</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Record a real cough — we measure the breathing rate from your audio and run the real
          decision engine.
        </p>

        <div className="mt-12 grid items-start gap-12 lg:grid-cols-2">
          {/* Left — recorder + profile */}
          <div className="space-y-6">
            <CoughRecorder profile={profile} onResult={setResult} />

            <div className="mx-auto max-w-[280px] space-y-3 rounded-2xl border border-slate-100 bg-pulmo-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Child profile (changes the decision)
              </p>
              <label className="block text-sm text-pulmo-deep">
                Age: <span className="font-semibold">{ageMonths} months</span>
                <input
                  type="range"
                  min={1}
                  max={59}
                  value={ageMonths}
                  onChange={(e) => setAgeMonths(Number(e.target.value))}
                  className="mt-1 w-full"
                />
                <span className="text-[11px] text-slate-500">
                  Tachypnea threshold: ≥{ageMonths < 2 ? 60 : ageMonths < 12 ? 50 : 40} breaths/min
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-pulmo-deep">
                <input type="checkbox" checked={fever} onChange={(e) => setFever(e.target.checked)} />
                Fever reported
              </label>
            </div>
          </div>

          {/* Right — result */}
          <div className="space-y-4">
            {!result ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-pulmo-surface p-8 text-center">
                <p className="text-sm text-slate-500">
                  Tap the blue button to record. Your result — measured breathing rate, severity
                  decision, and Bangla guidance — appears here.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Classification
                      </p>
                      <p className="mt-1 text-2xl font-bold capitalize text-pulmo-deep">
                        {result.class.replace(/_/g, " ")}
                      </p>
                    </div>
                    <ConfidenceDonut value={Math.round(result.confidence * 100)} />
                  </div>

                  {result.simulated && (
                    <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                      ⚠ Simulated classifier ({result.modelVersion}) — the disease model is in
                      training. Everything below is real.
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-pulmo-surface p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">
                        Breathing rate
                      </p>
                      <p className="mt-0.5 font-semibold text-pulmo-deep">
                        {result.breathsPerMin != null ? `${result.breathsPerMin} /min` : "not measured"}
                      </p>
                      <p className="text-[10px] text-slate-400">measured from your recording</p>
                    </div>
                    <div className={`rounded-lg border p-3 ${SEVERITY_STYLE[result.severity]}`}>
                      <p className="text-[11px] uppercase tracking-wide opacity-70">Severity</p>
                      <p className="mt-0.5 font-semibold capitalize">{result.severity}</p>
                      <p className="text-[10px] opacity-70">{REASON_LABEL[result.reason] ?? result.reason}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-pulmo-surface p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pulmo-blue text-white">
                    ♪
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Bangla Guidance {result.audioUrl ? "(audio)" : "(text)"}
                    </p>
                    <p className="bn font-bangla mt-1 text-sm text-pulmo-deep">{result.banglaText}</p>
                    {result.audioUrl && (
                      <audio controls src={result.audioUrl} className="mt-2 w-full" />
                    )}
                    <p className="mt-1 text-[10px] text-slate-400">
                      Deterministic decision + clinician-vetted stock script — no runtime LLM
                      (<code className="font-mono">lib/claude.ts</code>, <code className="font-mono">lib/tts.ts</code>).
                    </p>
                  </div>
                </div>

                {result.mustEscalate && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    🚨 Severe case — escalated to {result.escalatedTo ?? "nearest CHW"}. Check the{" "}
                    <a href="/chw" className="font-semibold underline">CHW dashboard</a> — it appears live.
                  </div>
                )}

                {result.imciTitles.length > 0 && (
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 text-xs text-slate-600">
                    <p className="font-semibold text-pulmo-deep">Retrieved WHO IMCI protocol</p>
                    <ul className="mt-1 list-disc pl-5">
                      {result.imciTitles.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <p className="mx-auto mt-12 max-w-3xl text-center text-xs text-slate-400">
          Decision logic comes from{" "}
          <code className="font-mono">lib/claude.ts::decideSeverityMultiModal</code> (deterministic).
          The breathing rate is measured in your browser by{" "}
          <code className="font-mono">lib/respiratory-rate.ts</code>. Bangla guidance is a
          clinician-vetted stock script per <code className="font-mono">ARCHITECTURE.md §3</code>.
        </p>
      </div>
    </section>
  );
}
