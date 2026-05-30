interface ImpactStatProps {
  number: string;
  label: string;
  accent?: "blue" | "green" | "gold";
}

const ACCENT_TEXT: Record<NonNullable<ImpactStatProps["accent"]>, string> = {
  blue: "text-pulmo-blue",
  green: "text-pulmo-green",
  gold: "text-pulmo-gold"
};

export function ImpactStat({ number, label, accent = "blue" }: ImpactStatProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <p className={`text-4xl font-bold ${ACCENT_TEXT[accent]}`}>{number}</p>
      <p className="mt-2 text-sm leading-snug text-slate-600">{label}</p>
    </div>
  );
}
