interface TechSourceCardProps {
  icon: string;
  title: string;
  sub: string;
}

export function TechSourceCard({ icon, title, sub }: TechSourceCardProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pulmo-blue/10 text-xl text-pulmo-blue">
        {icon}
      </span>
      <h3 className="mt-3 text-sm font-semibold text-pulmo-deep">{title}</h3>
      <p className="mt-1 max-w-[18ch] text-xs text-slate-500">{sub}</p>
    </div>
  );
}
