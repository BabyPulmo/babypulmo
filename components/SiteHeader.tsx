import Link from "next/link";

const NAV = [
  { label: "Home", href: "/" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "For Health Workers", href: "/chw" },
  { label: "Technology", href: "/technology" },
  { label: "Impact", href: "/impact" },
  { label: "About Us", href: "/docs" }
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-pulmo-surface bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-pulmo-blue">Baby Pulmo</span>
          <span className="hidden text-xs uppercase tracking-wider text-slate-500 sm:inline">
            Child&apos;s Voice
          </span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm font-medium text-pulmo-deep transition hover:text-pulmo-blue"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <button
            aria-label="Language toggle"
            className="hidden rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-pulmo-blue hover:text-pulmo-blue sm:inline-flex"
          >
            EN / বাং
          </button>
          <Link
            href="/demo"
            className="rounded-lg bg-pulmo-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pulmo-medium"
          >
            Try Demo
          </Link>
        </div>
      </div>
    </header>
  );
}
