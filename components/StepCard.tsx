interface StepCardProps {
  number: number;
  icon: string;
  title: string;
  body: string;
  accent?: "blue" | "green" | "gold" | "medium" | "deep";
}

const ACCENT_BG: Record<NonNullable<StepCardProps["accent"]>, string> = {
  blue: "bg-pulmo-blue",
  green: "bg-pulmo-green",
  gold: "bg-pulmo-gold",
  medium: "bg-pulmo-medium",
  deep: "bg-pulmo-deep"
};

export function StepCard({ number, icon, title, body, accent = "blue" }: StepCardProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl text-white shadow-md ${ACCENT_BG[accent]}`}
        >
          {icon}
        </span>
        <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-pulmo-deep shadow ring-2 ring-pulmo-surface">
          {number}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-pulmo-deep">{title}</h3>
      <p className="mt-1 max-w-[16ch] text-xs leading-snug text-slate-600">{body}</p>
    </div>
  );
}
