"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";
import SyncPolicy from "@/components/SyncPolicy";

type Row = { ambassador_id: number; full_name: string; college_name: string; rank: number;
  normalized_score: number; percentile_rank: number; star_rating: number; campaigns_scored: number;
  total_reach: number; total_engagements: number; published_posts: number; engagement_rate: number };
type Campaign = { campaign_id: number; title: string; start_date: string; end_date: string; finalized_at: string | null };
type Results = { leaderboard: Row[]; total_ranked: number; page_size: number; own_result: Row | null;
  campaign: Campaign | null; campaigns: Campaign[]; summary: { five_star: number; four_star: number; three_star: number } };
const number = (value: number) => Number(value).toLocaleString();

export default function RankingBoard({ admin = false }: { admin?: boolean }) {
  const [campaign, setCampaign] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let running = false;
    const controller = new AbortController();
    async function load(initial = false) {
      if (running || (!initial && document.hidden)) return;
      running = true;
      if (initial) setLoading(true);
      try {
        const q = new URLSearchParams({ page: String(page) });
        if (campaign) q.set("campaign_id", campaign);
        const r = await authFetch(`http://127.0.0.1:8000/${admin ? "admin" : "ambassador"}/rankings?${q}`, { signal: controller.signal });
        const d = await r.json();
        if (!r.ok) throw new Error(typeof d.detail === "string" ? d.detail : "Could not load rankings.");
        if (active) {
          if (page > Math.max(1, Math.ceil(d.total_ranked / d.page_size))) { setPage(1); return; }
          setData(d); setError("");
        }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Could not load rankings."); }
      finally { running = false; if (active) setLoading(false); }
    }
    void load(true);
    const timer = window.setInterval(() => void load(), 30000);
    return () => { active = false; controller.abort(); clearInterval(timer); };
  }, [admin, campaign, page, revision]);
  const own = data?.own_result;
  return <div className="space-y-6 text-[#202629]">
    <header><p className="text-sm font-semibold uppercase tracking-wider text-[#238C89]">{admin ? "Awards" : "Performance"}</p><h1 className="mt-2 text-3xl font-bold">{admin ? "Rankings & star awards" : "Your performance & ranking"}</h1>
      <p className="mt-3 text-sm text-gray-700">Choose overall performance or a single campaign. Instagram metrics and changed campaign ratings update automatically.</p></header>
    <section className="rounded-2xl border border-gray-200 bg-white p-6">
      <label className="text-sm font-semibold">Ranking view<select value={campaign} onChange={e => { setCampaign(e.target.value); setPage(1); }} className="ml-3 max-w-full rounded-lg border border-gray-300 bg-white p-3"><option value="">Overall · all scored campaigns</option>{data?.campaigns.map(c => <option key={c.campaign_id} value={c.campaign_id}>{c.title}{c.finalized_at ? " · Final" : ""}</option>)}</select></label>
      <button onClick={() => setRevision(value => value + 1)} className="ml-3 rounded-lg border px-4 py-3 text-sm">Refresh</button>
      {data?.campaign ? <p className="mt-4 text-sm text-gray-700">{data.campaign.finalized_at ? `Final ranking · fixed on ${new Date(data.campaign.finalized_at).toLocaleString()}. Later syncs and membership changes do not alter this campaign result.` : `Live campaign ranking · campaign closes at the end of ${data.campaign.end_date}, India time. Finalisation runs automatically after closing.`}</p> : <p className="mt-4 text-sm text-gray-700">Overall score = average of your normalized scores across scored campaigns, with equal weight for each campaign. Reach and engagements are summed across those results. Participation count is shown separately; unscored campaigns do not count as zero.</p>}
    </section>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {loading && <p role="status">Loading rankings...</p>}
    {!admin && data && <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Your rank", own ? `#${own.rank}` : "Not ranked yet"],
      ["Normalized score", own ? Number(own.normalized_score).toFixed(2) : "—"],
      ["Verified reach", own ? number(own.total_reach) : "—"],
      ["Engagements / posts", own ? `${number(own.total_engagements)} / ${own.published_posts}` : "—"],
    ].map(([label,value]) => <div key={label} className="rounded-2xl border border-gray-200 bg-white p-6"><p className="text-sm text-gray-700">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</section>}
    {admin && data && <section className="grid gap-4 sm:grid-cols-4">{[["Ranked ambassadors",data.total_ranked],["5 stars",data.summary.five_star],["4 stars",data.summary.four_star],["3 stars",data.summary.three_star]].map(([label,value]) => <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5"><p className="text-sm text-gray-700">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</section>}
    <section className="overflow-x-auto rounded-2xl border border-gray-200 bg-white"><table className="w-full text-left text-sm"><caption className="p-5 text-left text-xl font-bold">{campaign ? "Campaign leaderboard" : "Overall leaderboard"}</caption><thead className="bg-[#F8FAFA] text-gray-700"><tr>{["Rank","Ambassador","College","Campaigns scored","Reach","Engagements","Engagement rate","Score","Percentile","Stars"].map(h => <th key={h} className="px-4 py-4">{h}</th>)}</tr></thead><tbody>{data?.leaderboard.map(row => <tr key={row.ambassador_id} className={`border-t ${own?.ambassador_id === row.ambassador_id ? "bg-[#EDF8F7]" : ""}`}><td className="p-4 font-bold">{row.rank}</td><td className="p-4 font-semibold">{row.full_name}{own?.ambassador_id === row.ambassador_id ? " (you)" : ""}</td><td className="p-4">{row.college_name}</td><td className="p-4">{row.campaigns_scored}</td><td className="p-4">{number(row.total_reach)}</td><td className="p-4">{number(row.total_engagements)}</td><td className="p-4">{row.engagement_rate}%</td><td className="p-4 font-bold">{Number(row.normalized_score).toFixed(2)}</td><td className="p-4">{Number(row.percentile_rank).toFixed(2)}%</td><td className="whitespace-nowrap p-4 text-amber-700" aria-label={`${row.star_rating} stars`}>{"★".repeat(row.star_rating)}</td></tr>)}{data && !data.leaderboard.length && <tr><td colSpan={10} className="p-6">No eligible scored Instagram submissions yet. Missing metrics are not counted as zero.</td></tr>}</tbody></table></section>
    {data && <nav aria-label="Ranking pages" className="flex items-center justify-between text-sm"><span>Page {page} of {Math.max(1,Math.ceil(data.total_ranked/data.page_size))}</span><div className="flex gap-3"><button disabled={loading || page===1} onClick={() => setPage(p => p-1)} className="rounded-lg border bg-white px-4 py-2 disabled:opacity-50">Previous</button><button disabled={loading || page*data.page_size>=data.total_ranked} onClick={() => setPage(p => p+1)} className="rounded-lg border bg-white px-4 py-2 disabled:opacity-50">Next</button></div></nav>}
    <details className="rounded-2xl border border-gray-200 bg-white p-6"><summary className="cursor-pointer font-semibold">How updates and rankings work</summary><div className="mt-4"><SyncPolicy admin={admin} /><p className="mt-3 text-sm leading-6 text-gray-700">The existing campaign formula compares Instagram reach and engagement rate, weights their normalized percentiles at 30% and 70%, and averages an ambassador’s post scores. Campaign percentile determines three to five stars. Overall ranking averages campaign scores; equal overall scores share rank. Each post contributes only its latest eligible measurement, so hourly syncs are not added together.</p></div></details>
  </div>;
}
