"use client";
import { useState } from "react";
import { authFetch } from "@/lib/api";
export default function GroupNotice({ inviteUrl }: { inviteUrl: string }) {
  const [preview, setPreview] = useState<{subject: string; body: string; recipient_count: number; request_id: string} | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(send: boolean) {
    setBusy(true);
    try {
      const r = await authFetch(`http://127.0.0.1:8000/admin/settings/whatsapp-notice/${send ? "send" : "preview"}`, { method: "POST", body: JSON.stringify({ invite_url: inviteUrl, request_id: send ? preview?.request_id : undefined }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.detail);
      if (send) { setPreview(null); setMessage(d.message); } else setPreview(d);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Request failed."); } finally { setBusy(false); }
  }
  return <div className="mt-5 text-sm text-[#202629]">
    <button type="button" disabled={busy || !inviteUrl} onClick={() => act(false)} className="rounded-xl border border-[#9383D8] px-4 py-3 font-semibold">Preview invitation for existing members</button>
    {preview && <div role="dialog" aria-label="Group invitation email preview" className="mt-4 rounded-xl border bg-[#F8F6FC] p-5"><h3 className="font-bold">{preview.subject}</h3><p className="mt-2">{preview.recipient_count} current members (ACTIVE or PENDING). Departed members are excluded.</p><pre className="my-4 whitespace-pre-wrap font-sans">{preview.body}</pre><button type="button" disabled={busy} onClick={() => act(true)} className="rounded-lg bg-[#202629] px-4 py-2 text-white">Confirm and notify current members</button><button type="button" onClick={() => setPreview(null)} className="ml-4">Cancel</button></div>}
    {message && <p role="status" className="mt-3">{message}</p>}
  </div>;
}
