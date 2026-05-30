interface KpiTileProps {
  icon: string;
  value: string | number;
  label: string;
  sub?: string;
  accent?: "blue" | "green" | "gold" | "red";
}

const ACCENT_TEXT: Record<NonNullable<KpiTileProps["accent"]>, string> = {
  blue: "text-pulmo-blue",
  green: "text-pulmo-green",
  gold: "text-pulmo-gold",
  red: "text-red-500"
};

export function KpiTile({ icon, value, label, sub, accent = "blue" }: KpiTileProps) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`text-lg ${ACCENT_TEXT[accent]}`} aria-hidden>
          {icon}
        </span>
      </div>
      <p className={`mt-2 text-3xl font-bold ${ACCENT_TEXT[accent]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
