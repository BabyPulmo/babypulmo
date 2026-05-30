interface StatTileProps {
  icon: string;
  label: string;
  sub?: string;
}

export function StatTile({ icon, label, sub }: StatTileProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pulmo-blue/10 text-pulmo-blue">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-pulmo-deep">{label}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}
