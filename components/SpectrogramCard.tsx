export function SpectrogramCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-md">
      <div className="relative h-32 overflow-hidden rounded-lg bg-pulmo-deep">
        {/* Synthetic spectrogram placeholder */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 200 80" className="h-full w-full" aria-hidden>
            {Array.from({ length: 80 }).map((_, i) => {
              const x = i * 2.5;
              const h = 20 + Math.abs(Math.sin(i * 0.3) * 30) + Math.abs(Math.cos(i * 0.5) * 15);
              return (
                <line
                  key={i}
                  x1={x}
                  y1={40 - h / 2}
                  x2={x}
                  y2={40 + h / 2}
                  stroke="#F2C94C"
                  strokeWidth="1.6"
                  opacity={0.6 + Math.sin(i * 0.4) * 0.3}
                />
              );
            })}
          </svg>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Cough Audio Signature
      </p>
    </div>
  );
}

export function ConfidenceDonut({ value = 89 }: { value?: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-4 shadow-md">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">AI Analysis</p>
      <svg viewBox="0 0 80 80" className="mt-2 h-24 w-24">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#E5E7EB" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="#2F80ED"
          strokeWidth="6"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="44" textAnchor="middle" className="fill-pulmo-deep text-xs font-bold">
          {value}%
        </text>
      </svg>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Confidence</p>
    </div>
  );
}
