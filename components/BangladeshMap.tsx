export function BangladeshMap() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-pulmo-surface p-4 shadow-sm">
      <svg viewBox="0 0 240 280" className="h-full w-full" aria-label="Stylized Bangladesh map">
        {/* Stylized country outline — placeholder simplified shape */}
        <path
          d="M60 30 L130 20 L180 50 L200 90 L210 140 L195 180 L210 215 L175 245 L130 260 L100 250 L75 270 L50 235 L40 200 L60 165 L40 130 L55 95 Z"
          fill="#E0EAFB"
          stroke="#2F80ED"
          strokeWidth="1.5"
        />
        {/* CHW dots */}
        {[
          [90, 70, "#2F80ED"],
          [140, 100, "#27A660"],
          [110, 145, "#2F80ED"],
          [165, 175, "#F2C94C"],
          [125, 220, "#27A660"]
        ].map(([cx, cy, fill], i) => (
          <g key={i}>
            <circle cx={cx as number} cy={cy as number} r="9" fill={fill as string} opacity="0.25" />
            <circle cx={cx as number} cy={cy as number} r="4" fill={fill as string} />
          </g>
        ))}
      </svg>
      <span className="absolute bottom-3 left-4 rounded-full bg-pulmo-green/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow">
        Community Trust · 100%
      </span>
    </div>
  );
}
