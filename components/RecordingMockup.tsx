export function RecordingMockup({ timer = "00:07" }: { timer?: string }) {
  return (
    <div className="mx-auto w-full max-w-[280px]">
      <div className="relative aspect-[9/19] rounded-[2.5rem] border-[10px] border-pulmo-deep bg-white shadow-2xl">
        {/* Notch */}
        <div className="absolute left-1/2 top-2 h-4 w-20 -translate-x-1/2 rounded-full bg-pulmo-deep" />
        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-6 text-[10px] text-pulmo-deep">
          <span>9:41</span>
          <span>● ▾</span>
        </div>
        {/* Body */}
        <div className="flex h-[calc(100%-3rem)] flex-col items-center justify-between p-6">
          <div className="flex flex-col items-center pt-12">
            <p className="text-xs text-slate-500">Recording…</p>
            <p className="mt-1 text-4xl font-bold text-pulmo-deep">{timer}</p>
          </div>
          {/* Waveform */}
          <div className="flex h-20 items-end gap-1">
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-pulmo-blue"
                style={{ height: `${20 + Math.abs(Math.sin(i * 0.7)) * 60}%` }}
              />
            ))}
          </div>
          {/* Stop button */}
          <div className="flex flex-col items-center gap-3 pb-6">
            <button
              aria-label="Stop recording"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg"
            >
              <span className="block h-4 w-4 rounded-sm bg-white" />
            </button>
            <p className="max-w-[14ch] text-center text-[11px] leading-snug text-slate-500">
              Please record the child&apos;s cough in a quiet place.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
