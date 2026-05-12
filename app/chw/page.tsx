"use client";

import { useEffect, useState } from "react";
import { supabaseAnon } from "@/lib/supabase";

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

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm font-medium text-shishu-500">
          ShishuKantho · CHW Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Live Alerts</h1>
        <p className="mt-1 text-slate-600">
          Pediatric cough escalations from the rules-gated severity layer. Each
          alert includes the original audio recording and confidence score.
        </p>
      </header>

      {loading && (
        <p className="text-slate-500">Loading alerts…</p>
      )}

      {!loading && alerts.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-slate-500">
            No alerts yet. Send a cough recording to the ShishuKantho WhatsApp
            number to trigger one.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`rounded-xl border-l-4 bg-white p-5 shadow-sm transition-colors ${
              a.severity === "critical"
                ? "border-red-500"
                : a.severity === "high"
                ? "border-orange-500"
                : "border-yellow-500"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  a.severity === "critical"
                    ? "bg-red-100 text-red-700"
                    : a.severity === "high"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {a.severity}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(a.created_at).toLocaleString()}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Status
                </p>
                <p className="mt-1 font-medium capitalize">{a.status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Alert ID
                </p>
                <p className="mt-1 font-mono text-xs">{a.id.slice(0, 8)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Classification
                </p>
                <p className="mt-1 font-mono text-xs">
                  {a.classification_id?.slice(0, 8) ?? "-"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <footer className="mt-12 border-t pt-6 text-sm text-slate-500">
        <p>
          ShishuKantho · CHWs in Bogura district receive WhatsApp alerts with
          attached audio when severity rules trigger escalation.
        </p>
      </footer>
    </main>
  );
}
