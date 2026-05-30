type Severity = "critical" | "high" | "moderate" | "low";

interface AlertRowProps {
  severity: Severity;
  title: string;
  location?: string;
  timeAgo: string;
}

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-red-50 text-red-600",
  moderate: "bg-pulmo-gold/30 text-amber-700",
  low: "bg-pulmo-green/20 text-pulmo-green"
};

const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-red-500",
  high: "bg-red-500",
  moderate: "bg-pulmo-gold",
  low: "bg-pulmo-green"
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High Risk",
  moderate: "Moderate Risk",
  low: "Low Risk"
};

export function AlertRow({ severity, title, location, timeAgo }: AlertRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-white px-4 py-3 transition hover:border-pulmo-blue/30">
      <div className="flex items-center gap-3">
        <span className={`h-2 w-2 rounded-full ${SEVERITY_DOT[severity]}`} />
        <div>
          <p className="text-sm font-semibold text-pulmo-deep">{title}</p>
          {location && <p className="text-xs text-slate-500">{location}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 text-right">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_BADGE[severity]}`}>
          {SEVERITY_LABEL[severity]}
        </span>
        <span className="text-xs text-slate-400">{timeAgo}</span>
      </div>
    </div>
  );
}
