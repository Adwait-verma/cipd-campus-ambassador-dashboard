"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";

type SyncStatus = {
  enabled: boolean;
  configured: boolean;
  interval_minutes: number;
  calls_last_hour: number;
  local_hourly_budget: number;
  posts: { post_id: number; full_name: string; status: string | null; last_success_at: string | null; next_attempt_at: string | null; last_error: string | null; eligible: boolean }[];
  cooldowns: { scope: string; paused_until: string; reason: string }[];
  reports: { report_month: string; status: string; last_error: string | null }[];
};

export default function InstagramSyncMonitor({ ambassadorId }: { ambassadorId?: number }) {
  const [data, setData] = useState<SyncStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let running = false;
    const controller = new AbortController();
    async function load() {
      if (running || document.hidden) return;
      running = true;
      try {
        const response = await authFetch(`http://127.0.0.1:8000/admin/instagram/sync-status${ambassadorId ? `?ambassador_id=${ambassadorId}` : ""}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Could not load sync status.");
        if (active) { setData(result); setError(""); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Could not load sync status."); }
      finally { running = false; }
    }
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => { active = false; controller.abort(); clearInterval(timer); };
  }, [ambassadorId, revision]);

  async function sync(postId: number) {
    setBusy(postId); setError("");
    try {
      const r = await authFetch(`http://127.0.0.1:8000/admin/campaign-posts/${postId}/sync-instagram-metrics`, { method: "POST" });
      const result = await r.json();
      if (!r.ok) throw new Error(result.detail || "Sync failed.");
    } catch (e) { setError(e instanceof Error ? e.message : "Sync failed."); }
    finally { setBusy(null); setRevision(value => value + 1); }
  }
  const time = (value: string | null) => value ? new Date(value).toLocaleString() : "Not yet scheduled";
  return <section className="my-6 rounded-2xl border border-gray-200 bg-white p-6 text-[#202629]">
    <h2 className="text-2xl font-bold">Instagram updates</h2>
    <p className="mt-2 text-sm text-gray-700">Active campaign posts refresh automatically. Changed metrics update campaign ratings after each batch. Failed requests keep the last successful values.</p>
    {data && <>
      <p className="mt-3 text-sm">Refresh target: every {data.interval_minutes} minutes · Local request budget: {data.calls_last_hour}/{data.local_hourly_budget} this hour.</p>
      {(!data.enabled || !data.configured) && <p className="mt-3 rounded-lg bg-amber-50 p-3">{!data.enabled ? "Scheduled sync is disabled." : "Instagram token encryption is not configured on this server."}</p>}
      {data.cooldowns.map(c => <p key={c.scope} className="mt-2 text-amber-800">{c.reason} Next attempt after {time(c.paused_until)}.</p>)}
      {data.reports.filter(r => r.status !== "READY").map(r => <p key={r.report_month} className="mt-2 text-amber-800">Report {r.report_month}: {r.last_error || "Refreshing source metrics before preparing emails."}</p>)}
      <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Post / ambassador</th><th className="p-2">Last synced</th><th className="p-2">Next attempt</th><th className="p-2">Connection</th><th className="p-2">Action</th></tr></thead><tbody>
        {data.posts.map(p => <tr key={p.post_id} className="border-b"><td className="p-2">#{p.post_id} · {p.full_name}</td><td className="p-2">{p.last_success_at ? time(p.last_success_at) : "Never synced"}</td><td className="p-2">{p.eligible ? time(p.next_attempt_at) : "No scheduled refresh"}</td><td className="p-2">{p.last_error || p.status || (p.eligible ? "Awaiting first sync" : "Needs an active membership, campaign and OAuth connection")}</td><td className="p-2"><button disabled={busy !== null || !data.configured} onClick={() => void sync(p.post_id)} className="rounded-lg bg-[#202629] px-3 py-2 text-white disabled:opacity-50">{busy === p.post_id ? "Syncing..." : "Sync now"}</button></td></tr>)}
        {!data.posts.length && <tr><td colSpan={5} className="p-3">No Instagram campaign submissions yet.</td></tr>}
      </tbody></table></div>
    </>}
    {error && <p role="status" className="mt-3 text-red-800">{error}</p>}
  </section>;
}
