"use client";
import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/api";
type Campaign = { title: string; description: string | null; mandatory_hashtag: string | null; target_url: string | null; start_date: string; end_date: string; is_active: boolean; archived_at: string | null; finalized_at: string | null };
export default function CampaignManagement({ campaignId }: { campaignId: number }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const r = await authFetch(`http://127.0.0.1:8000/admin/campaigns/${campaignId}/management`);
    const d = await r.json(); if (!r.ok) throw new Error(d.detail);
    setCampaign(d.campaign); setDirty(d.recalculation_needed);
  }, [campaignId]);
  useEffect(() => {
    let active = true;
    const refresh = () => load().catch(e => { if (active) setMessage(e.message); });
    void refresh();
    const timer = window.setInterval(() => { if (!editing && !document.hidden) void refresh(); }, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [load, editing]);
  async function recalculate() {
    setBusy(true);
    try { const r = await authFetch(`http://127.0.0.1:8000/admin/campaigns/${campaignId}/calculate-ratings`, { method: "POST" }); const d = await r.json(); if (!r.ok) throw new Error(d.detail); await load(); setMessage(d.message); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Calculation failed."); } finally { setBusy(false); }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!campaign) return; setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await authFetch(`http://127.0.0.1:8000/admin/campaigns/${campaignId}/management`, { method: "PUT", body: JSON.stringify({ ...values, is_active: values.state === "open", archived: values.state === "archived" }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.detail); setMessage(d.message); setEditing(false); await load(); window.location.reload();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Save failed."); } finally { setBusy(false); }
  }
  return <section className="my-6 rounded-2xl border border-gray-200 bg-white p-6 text-[#202629]">
    {dirty && <div className="mb-4 rounded-xl bg-amber-50 p-4"><p className="font-semibold">Metrics updated—recalculation needed</p><button disabled={busy} onClick={recalculate} className="mt-3 rounded-lg bg-[#202629] px-4 py-2 text-white">{busy ? "Working..." : "Recalculate now"}</button></div>}
    <h2 className="text-xl font-bold">Campaign management {campaign && `· ${campaign.archived_at ? "Archived" : campaign.is_active ? "Open" : "Closed"}`}</h2>
    {campaign?.finalized_at && <p className="mt-3 rounded-xl bg-[#EDF8F7] p-4 text-sm font-semibold">Final ranking · this campaign’s results and metrics are fixed. Create a new campaign for another round.</p>}
    <p className="mt-2 text-sm text-gray-600">Closing or archiving stops submissions and preserves existing posts and ratings. Editing does not resend the campaign announcement.</p>
    <button className="mt-3 font-semibold text-[#6855B5]" onClick={() => setEditing(!editing)}>{editing ? "Cancel editing" : "Edit details / close / archive"}</button>
    {editing && campaign && <form onSubmit={save} className="mt-4 grid gap-4">
      {([['title','Title'],['description','Guidelines'],['mandatory_hashtag','Hashtag'],['target_url','Official URL'],['start_date','Start date'],['end_date','End date']] as const).map(([key,label]) => <label key={key} className="text-sm font-semibold">{label}{key === "description" ? <textarea name={key} defaultValue={campaign[key] ?? ""} rows={5} className="mt-1 block w-full rounded-lg border p-3" /> : <input name={key} type={key.endsWith("date") ? "date" : key === "target_url" ? "url" : "text"} readOnly={Boolean(campaign.finalized_at) && key.endsWith("date")} required={key === "title" || key.endsWith("date")} defaultValue={campaign[key] ?? ""} className="mt-1 block w-full rounded-lg border p-3" />}</label>)}
      <label>Status<select name="state" defaultValue={campaign.archived_at ? "archived" : campaign.finalized_at ? "closed" : campaign.is_active ? "open" : "closed"} className="ml-3 rounded-lg border p-2"><option value="open" disabled={Boolean(campaign.finalized_at)}>Open</option><option value="closed">Closed</option><option value="archived">Archived</option></select></label>
      <button disabled={busy} className="rounded-xl bg-[#202629] p-3 text-white">Save campaign</button>
    </form>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
