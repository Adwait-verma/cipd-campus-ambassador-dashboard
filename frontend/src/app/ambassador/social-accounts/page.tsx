"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";

type Account = { account_id: number; profile_handle: string; follower_count: number; verified: boolean; updated_at: string };
export default function SocialAccountsPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const stored = sessionStorage.getItem("cipd_user");
        if (!stored) { window.location.replace("/login"); return; }
        const user = JSON.parse(stored);
        const [r, membership] = await Promise.all([
          authFetch(`http://127.0.0.1:8000/ambassador/social-accounts/${user.user_id}`, { signal: controller.signal }),
          authFetch("http://127.0.0.1:8000/ambassador/membership", { signal: controller.signal }),
        ]);
        const [data, member] = await Promise.all([r.json(), membership.json()]);
        if (!r.ok || !membership.ok) throw new Error(data.detail || member.detail || "Could not load Instagram connection.");
        if (active) { setUserId(user.user_id); setAccount(data.accounts.find((a: { platform: string }) => a.platform === "INSTAGRAM") || null); setStatus(member.status); }
      } catch (e) { if (active) setMessage(e instanceof Error ? e.message : "Could not load Instagram connection."); }
      finally { if (active) setLoading(false); }
    }
    void load();
    const params = new URLSearchParams(window.location.search);
    if (params.get("instagram") === "connected") queueMicrotask(() => { if (active) setMessage("Instagram connected successfully."); });
    if (params.get("instagram") === "error") queueMicrotask(() => { if (active) setMessage("Instagram could not be connected. Try again or contact programme support."); });
    return () => { active = false; controller.abort(); };
  }, [revision]);

  async function connect() {
    setWorking(true); setMessage("");
    try {
      const r = await authFetch("http://127.0.0.1:8000/ambassador/social-accounts/instagram/authorize");
      const data = await r.json();
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Could not start Instagram connection.");
      window.location.assign(data.authorize_url);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not connect Instagram."); setWorking(false); }
  }
  async function disconnect() {
    if (!userId || !window.confirm("Disconnect Instagram? You will become PENDING and stop entering new campaign scores until you reconnect. Fixed campaign results remain stored.")) return;
    setWorking(true); setMessage("");
    try {
      const r = await authFetch(`http://127.0.0.1:8000/ambassador/social-accounts/${userId}/INSTAGRAM`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Could not disconnect Instagram.");
      setMessage("Instagram disconnected. Reconnect when you are ready to participate."); setRevision(v => v+1);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not disconnect Instagram."); }
    finally { setWorking(false); }
  }
  return <div className="mx-auto max-w-5xl space-y-6 text-[#202629]">
    <header><p className="text-sm font-semibold uppercase tracking-wider text-[#238C89]">Instagram</p><h1 className="mt-2 text-3xl font-bold">Your Instagram account</h1><p className="mt-3 text-gray-700">Connect the Instagram Business or Creator account you will use for CiPD campaigns. Personal Instagram accounts must be switched to a professional account first.</p></header>
    {loading ? <p>Loading Instagram connection...</p> : <>
      <section className="rounded-2xl border border-[#CDE6E4] bg-[#F1FAFA] p-6"><h2 className="text-xl font-bold">{status === "LEFT" ? "Programme membership ended" : account?.verified ? "ACTIVE · Instagram verified" : "PENDING · Connect Instagram"}</h2><p className="mt-2 text-sm text-gray-700">{status === "LEFT" ? "Contact CiPD if you would like to rejoin. Your historical results are retained." : account?.verified ? "You can submit campaign posts from this connected Instagram account." : "Registration is complete. Connect Instagram to become eligible for campaigns and scoring."}</p></section>
      <section className="rounded-2xl border border-gray-200 bg-white p-7"><h2 className="text-xl font-bold">Instagram connection</h2>
        {account ? <div className="mt-5 grid gap-4 text-sm sm:grid-cols-3"><div><p className="text-gray-600">Account</p><p className="mt-1 font-semibold">{account.profile_handle}</p></div><div><p className="text-gray-600">Followers at connection</p><p className="mt-1 font-semibold">{Number(account.follower_count || 0).toLocaleString()}</p></div><div><p className="text-gray-600">Connection updated</p><p className="mt-1 font-semibold">{new Date(account.updated_at).toLocaleString()}</p></div></div> : <p className="mt-4 text-sm text-gray-700">You will be redirected to Instagram to approve access. CiPD uses permitted campaign-post metrics to calculate your performance.</p>}
        {status !== "LEFT" && <div className="mt-5 flex flex-wrap gap-3"><button disabled={working} onClick={() => void connect()} className="rounded-xl bg-[#202629] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{working ? "Working..." : account ? "Reconnect Instagram" : "Connect Instagram"}</button>{account && <button disabled={working} onClick={() => void disconnect()} className="rounded-xl border px-5 py-3 text-sm font-semibold disabled:opacity-50">Disconnect</button>}</div>}
      </section>
      <section className="rounded-2xl border border-gray-200 bg-white p-6"><h2 className="font-bold">After connecting</h2><p className="mt-2 text-sm leading-6 text-gray-700">Publish your campaign post on this account and submit its direct Instagram URL. Metrics are fetched automatically during the campaign, and changed metrics update ratings. If permission expires, reconnect here. A connection failure preserves your last successful metrics.</p></section>
    </>}
    {message && <p role="status" className="rounded-xl border bg-white p-4 text-sm">{message}</p>}
  </div>;
}
