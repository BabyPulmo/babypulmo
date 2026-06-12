"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseAnon } from "@/lib/supabase";
import { KpiTile } from "@/components/KpiTile";
import { AlertRow } from "@/components/AlertRow";

interface Alert {
  id: string;
  classification_id: string;
  caregiver_id: string;
  chw_id: string;
  severity: "critical" | "high" | "moderate";
  status: "pending" | "acknowledged" | "resolved" | "failed";
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

const SIDEBAR = [
  { label: "CHW Dashboard", href: "/chw", active: true },
  { label: "Alerts", href: "/chw", badge: "●" },
  { label: "Patients", href: "/chw" },
  { label: "Map View", href: "/chw" },
  { label: "Reports", href: "/chw" },
  { label: "Audio Library", href: "/chw" },
  { label: "Settings", href: "/chw" }
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} d ago`;
}

export default function ChwDashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabaseAnon
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setAlerts((data as Alert[]) ?? []);
      setLoading(false);
    };
    load();

    const channel = supabaseAnon
      .channel("alerts-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload) => {
          setAlerts((prev) => [payload.new as Alert, ...prev]);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const kpi = useMemo(() => {
    const newAlerts = alerts.filter((a) => a.status === "pending").length;
    const high = alerts.filter((a) => a.severity === "critical" || a.severity === "high").length;
    const referrals = alerts.filter((a) => a.status === "resolved").length;
    return { newAlerts, total: alerts.length, high, referrals };
  }, [alerts]);

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8 lg:px-6">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-24 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            CHW Console
          </p>
          <p className="px-2 text-xs text-slate-400">Rural Health Center</p>
          <nav className="mt-3 space-y-1">
            {SIDEBAR.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                  s.active
                    ? "bg-pulmo-blue text-white"
                    : "text-pulmo-deep hover:bg-pulmo-surface"
                }`}
              >
                {s.label}
                {s.badge && (
                  <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white">
                    {s.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 space-y-6">
        <header>
          <h1 className="text-center text-3xl font-bold tracking-tight text-pulmo-blue">
            FOR HEALTH WORKERS
          </h1>
          <p className="mt-2 text-center text-sm text-slate-600">
            Real-time alerts. Smarter triage. Faster response.
          </p>
        </header>

        {/* KPI grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile icon="◆" value={kpi.newAlerts} label="NEW ALERTS" accent="blue" />
          <KpiTile icon="◫" value={kpi.total} label="TOTAL PATIENTS" accent="blue" />
          <KpiTile icon="!" value={kpi.high} label="HIGH RISK" sub="Critical + High" accent="red" />
          <KpiTile icon="↗" value={kpi.referrals} label="REFERRALS" sub="Resolved" accent="green" />
        </div>

        {/* Recent Alerts + Map */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-pulmo-deep">Recent Alerts</h2>
            </div>

            {loading && <p className="mt-4 text-sm text-slate-500">Loading alerts…</p>}

            {!loading && alerts.length === 0 && (
              <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-pulmo-surface p-6 text-center text-sm text-slate-500">
                No alerts yet. A cough recording to the Baby Pulmo WhatsApp number triggers one.
              </p>
            )}

            <div className="mt-4 space-y-2">
              {alerts.slice(0, 8).map((a) => (
                <AlertRow
                  key={a.id}
                  severity={a.severity}
                  title={`Cough · ${a.classification_id?.slice(0, 8) ?? "unknown"}`}
                  location={`Caregiver ${a.caregiver_id?.slice(0, 6) ?? "—"}`}
                  timeAgo={timeAgo(a.created_at)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-pulmo-deep">Patient Location Map</h2>
            </div>
            <div className="mt-4 aspect-square overflow-hidden rounded-lg border border-slate-100 bg-pulmo-surface">
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pulmo-blue/10 via-pulmo-green/10 to-pulmo-gold/10 text-center">
                <p className="max-w-xs px-4 text-xs text-slate-500">
                  Mapbox tile map placeholder. Wire to PostGIS{" "}
                  <code className="font-mono">chw_registry</code> with{" "}
                  <code className="font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</code>. See{" "}
                  <code className="font-mono">design.md §7</code>.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
