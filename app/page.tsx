export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-12">
        <p className="text-sm font-medium text-pulmo-500">THE INFINITY AI BUILDFEST 2026 · HealthTech</p>
        <h1 className="mt-2 text-5xl font-bold tracking-tight">Baby Pulmo</h1>
        <p className="bn mt-1 text-2xl text-pulmo-900">বেবি পুলমো — listening to your child&apos;s breath</p>
        <p className="mt-6 text-lg text-slate-700">
          A Bangla voice-first WhatsApp AI that listens to a child&apos;s cough and tells the mother, in
          her own language, whether her baby has pneumonia. In 10 seconds. For free.
        </p>
      </header>

      <section className="mb-10 rounded-2xl border border-pulmo-500/20 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">Try the demo</h2>
        <p className="mt-2 text-slate-700">
          Send a 30-second cough voice note to our WhatsApp number. You&apos;ll receive a Bangla audio reply
          in under 15 seconds with classification, confidence score, and recommended action.
        </p>
        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 font-mono text-sm">
          WhatsApp: <span className="font-semibold">+1 415 523 8886</span>
          <br />
          Sandbox code: <span className="font-semibold">join &lt;your-code&gt;</span>
        </div>
      </section>

      <section className="mb-10 grid gap-4 md:grid-cols-3">
        <Stat label="Children U5 dying / year from pneumonia (WHO)" value="740,000" />
        <Stat label="Bangladesh: 1 doctor per" value="8,000 rural" />
        <Stat label="Pfizer paid for adult cough AI (ResApp, 2022)" value="$120M" />
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <ol className="mt-4 space-y-3 text-slate-700">
          <li>
            <span className="font-semibold">1.</span> Mother holds phone near coughing child, records 30 seconds
            on WhatsApp.
          </li>
          <li>
            <span className="font-semibold">2.</span> Wav2Vec2 (fine-tuned on Coswara) classifies the cough into
            6 pediatric respiratory categories with confidence + Grad-CAM heatmap.
          </li>
          <li>
            <span className="font-semibold">3.</span> RAG retrieves matching WHO IMCI severity protocol.
          </li>
          <li>
            <span className="font-semibold">4.</span> Claude generates Bangla audio guidance grounded in
            retrieved protocols.
          </li>
          <li>
            <span className="font-semibold">5.</span> Rules-gated severity triggers automatic CHW alert with
            audio attached and GPS location.
          </li>
        </ol>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold">Responsible AI</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
          <li>Decision support, not a diagnostic device.</li>
          <li>Rules-gated severity (deterministic), not LLM discretion.</li>
          <li>Mandatory human-in-loop on every red-flag escalation.</li>
          <li>Grad-CAM spectrogram explainability on every classification.</li>
          <li>WHO IMCI alignment + BMRC ethics review path.</li>
        </ul>
      </section>

      <footer className="mt-16 border-t pt-6 text-sm text-slate-500">
        <p>
          Baby Pulmo · Built for THE INFINITY AI BUILDFEST 2026 · BRAC University, Dhaka · 12 June 2026
        </p>
        <p className="mt-2">
          <a className="underline hover:text-pulmo-500" href="/chw">CHW dashboard →</a>
        </p>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-3xl font-bold text-pulmo-500">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{label}</p>
    </div>
  );
}
