interface ResultsCardProps {
  riskLevel: "Low" | "Moderate" | "High" | "Critical";
  confidence: number;
  possibleCondition: string;
  recommendation: string;
}

const RISK_BG: Record<ResultsCardProps["riskLevel"], string> = {
  Low: "bg-pulmo-green/20 text-pulmo-green",
  Moderate: "bg-pulmo-gold/30 text-amber-700",
  High: "bg-red-100 text-red-700",
  Critical: "bg-red-500 text-white"
};

export function ResultsCard({
  riskLevel,
  confidence,
  possibleCondition,
  recommendation
}: ResultsCardProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-pulmo-deep">Results</h3>
        <button aria-label="Refresh" className="text-pulmo-blue">
          ↻
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Risk Level</p>
          <span
            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${RISK_BG[riskLevel]}`}
          >
            {riskLevel}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Confidence</p>
          <p className="mt-2 text-xl font-bold text-pulmo-deep">{confidence}%</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Possible Condition
        </p>
        <p className="mt-1 text-xl font-bold text-pulmo-blue">{possibleCondition}</p>
      </div>

      <div className="mt-5 rounded-xl border border-pulmo-blue/20 bg-pulmo-blue/5 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-pulmo-blue">
          Recommendation
        </p>
        <p className="mt-1 text-sm text-pulmo-deep">{recommendation}</p>
      </div>

      <button
        type="button"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-pulmo-blue py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-pulmo-medium"
      >
        ▶ Play Bangla Guidance
      </button>
    </div>
  );
}
