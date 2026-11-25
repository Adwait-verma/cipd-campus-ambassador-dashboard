"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";

export default function SyncPolicy({ admin = false }: { admin?: boolean }) {
  const [policy, setPolicy] = useState<{ interval_minutes: number; enabled: boolean; connection_configured: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const r = await authFetch(`http://127.0.0.1:8000/${admin ? "admin" : "ambassador"}/instagram/sync-policy`);
        if (r.ok && active) setPolicy(await r.json());
      } catch { /* Other page requests display connection errors. */ }
    }
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [admin]);
  return <div className="text-sm leading-6 text-gray-700">
    {policy ? policy.enabled ? <>Instagram metrics update automatically, targeting every <strong>{policy.interval_minutes} minutes</strong> during active campaigns. Ratings follow changed metrics. API limits or connection issues can delay updates.</> : <>Automatic Instagram updates are paused. Contact the programme team if you need help.</> : "Instagram update schedule is loading."}
    <span className="mt-1 block text-xs text-gray-700">Campaign results are fixed after the closing date (India time), using metrics captured before closing. Overall ranking combines stored campaign scores.</span>
  </div>;
}
