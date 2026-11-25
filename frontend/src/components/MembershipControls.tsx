"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";

export default function MembershipControls({ ambassadorId }: { ambassadorId?: number }) {
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const url = ambassadorId ? `/admin/ambassadors/${ambassadorId}` : "/ambassador/membership";
    authFetch(`http://127.0.0.1:8000${url}`).then(async r => {
      const d = await r.json(); if (!r.ok) throw new Error(d.detail);
      setStatus(d.ambassador?.status ?? d.status);
    }).catch(e => setMessage(e.message));
  }, [ambassadorId]);
  async function change() {
    if (!window.confirm(ambassadorId ? "Restore membership after confirming this ambassador wants to rejoin?" : "Leave the programme? Programme emails and new submissions stop. Your account and historical data will be retained. You will need to contact CiPD to rejoin. This does not remove you from the WhatsApp group.")) return;
    setBusy(true);
    try {
      const path = ambassadorId ? `/admin/ambassadors/${ambassadorId}/reinstate` : "/ambassador/membership/leave";
      const r = await authFetch(`http://127.0.0.1:8000${path}`, { method: "POST" });
      const d = await r.json(); if (!r.ok) throw new Error(d.detail);
      setStatus(d.status); setMessage(d.message);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not update membership."); }
    finally { setBusy(false); }
  }
  if (ambassadorId && status !== "LEFT") return null;
  return <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-[#202629]">
    <h2 className="text-xl font-bold">Programme membership {status && `· ${status}`}</h2>
    <p className="mt-2 text-sm text-gray-600">Leaving stops programme emails and new submissions. Historical data is retained. Requested account-security emails remain available. Leave the WhatsApp group separately if you wish.</p>
    {(ambassadorId || (status && status !== "LEFT")) && <button disabled={busy} onClick={change} className="mt-4 rounded-xl bg-[#202629] px-5 py-3 text-white disabled:opacity-50">{busy ? "Saving..." : ambassadorId ? "Restore membership" : "Leave ambassador programme"}</button>}
    {status === "LEFT" && !ambassadorId && <p className="mt-3 text-sm">You have left. Contact CiPD if you want to rejoin.</p>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
