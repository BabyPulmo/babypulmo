import { TechSourceCard } from "@/components/TechSourceCard";

const SWATCHES = [
  { name: "Primary Blue", hex: "#2F80ED", bg: "bg-pulmo-blue" },
  { name: "Health Green", hex: "#27A660", bg: "bg-pulmo-green" },
  { name: "Alert Gold", hex: "#F2C94C", bg: "bg-pulmo-gold" },
  { name: "Medium Blue", hex: "#1672DF", bg: "bg-pulmo-medium" },
  { name: "Deep Brand", hex: "#1F3937", bg: "bg-pulmo-deep" },
  { name: "Surface", hex: "#F5F7FA", bg: "bg-pulmo-surface border border-slate-200" }
];

const ICONS = [
  { label: "RECORD", icon: "●" },
  { label: "AUDIO", icon: "≋" },
  { label: "AI", icon: "⌖" },
  { label: "MEDICAL", icon: "✚" },
  { label: "TIME", icon: "◷" },
  { label: "REPORT", icon: "▤" },
  { label: "SAFETY", icon: "✿" },
  { label: "SYNC", icon: "↻" }
];

export default function TechnologyPage() {
  return (
    <div className="space-y-16 pb-16">
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <h1 className="text-center text-3xl font-bold tracking-tight text-pulmo-blue">
            BUILT WITH RESEARCH. POWERED BY TECHNOLOGY.
          </h1>
          <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-pulmo-blue" />

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <TechSourceCard icon="◫" title="Coswara Dataset" sub="5,000+ South Asian respiratory samples" />
            <TechSourceCard icon="▶" title="COUGHVID" sub="Video dataset for cough understanding" />
            <TechSourceCard icon="✚" title="WHO IMCI" sub="Global clinical guidelines" />
            <TechSourceCard icon="◐" title="DGHS Protocols" sub="Bangladesh pediatric care standards" />
            <TechSourceCard icon="✿" title="Explainable AI" sub="Grad-CAM visual insights" />
          </div>
        </div>
      </section>
    </div>
  );
}
