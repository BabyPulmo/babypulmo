import { ImpactStat } from "@/components/ImpactStat";
import { BangladeshMap } from "@/components/BangladeshMap";

const OUTCOMES = [
  { icon: "◷", title: "Early Detection", body: "Saves young lives through timely intervention." },
  { icon: "♪", title: "Timely Guidance", body: "Improves outcomes with precise AI protocols." },
  { icon: "♡", title: "Health Equity", body: "Levels child healthcare regardless of location." },
  { icon: "↗", title: "Stronger Future", body: "Healthier tomorrows for the next generation." }
];

export default function ImpactPage() {
  return (
    <div className="space-y-16 pb-16">
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-pulmo-blue">
            GLOBAL IMPACT
          </p>
          <h1 className="mt-2 text-center text-3xl font-bold tracking-tight text-pulmo-deep">
            OUR IMPACT IN RURAL BANGLADESH
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-600">
            AI-powered care for every child, everywhere. Reducing mortality through technology and empathy.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ImpactStat
              number="40%"
              label="Rural children lack early diagnosis protocols today."
              accent="blue"
            />
            <ImpactStat
              number="Millions"
              label="of children can benefit from early AI detection."
              accent="green"
            />
            <ImpactStat
              number="Bangla"
              label="native AI support designed specifically for our communities."
              accent="blue"
            />
            <ImpactStat
              number="Stronger"
              label="communities through smarter, faster local healthcare."
              accent="blue"
            />
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-2xl font-bold text-pulmo-deep">Reaching Rural Bangladesh</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Empowering caregivers &amp; health workers with AI-driven guidance in the hardest-to-reach places.
          </p>

          <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
            <BangladeshMap />
            <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
              <div className="relative aspect-[5/3] bg-gradient-to-br from-pulmo-gold/30 via-pulmo-green/20 to-pulmo-blue/20">
                <div className="absolute inset-0 flex items-end justify-start p-6">
                  <p className="rounded-xl bg-white/85 px-3 py-2 text-xs text-slate-600 backdrop-blur">
                    Community-trust photo placeholder. Replace with commissioned photo before press launch.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OUTCOMES.map((o) => (
              <div key={o.title} className="rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-sm">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-pulmo-blue/10 text-pulmo-blue">
                  {o.icon}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-pulmo-deep">{o.title}</h3>
                <p className="mt-1 text-xs text-slate-500">{o.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
