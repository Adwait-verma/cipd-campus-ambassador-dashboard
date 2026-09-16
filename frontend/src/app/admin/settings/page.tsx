"use client";

import { authFetch } from "@/lib/api";
import { useEffect, useState } from "react";

export default function AdminSettingsPage() {
  const [inviteUrl, setInviteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");

  useEffect(() => {
    authFetch("http://127.0.0.1:8000/admin/settings")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Could not load settings.");
        setInviteUrl(data.whatsapp_group_invite_url || "");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load settings."))
      .finally(() => setLoading(false));
  }, []);

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await authFetch("http://127.0.0.1:8000/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ whatsapp_group_invite_url: inviteUrl.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not save settings.");
      setInviteUrl(data.whatsapp_group_invite_url);
      setMessage("WhatsApp group invite link saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function sendToAll(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm("Queue this email for every registered ambassador?")) return;
    setBroadcasting(true);
    setBroadcastMessage("");
    try {
      const response = await authFetch("http://127.0.0.1:8000/admin/notifications/broadcast", {
        method: "POST",
        body: JSON.stringify({ subject, message: announcement }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not queue the email.");
      setBroadcastMessage(
        `${data.queued} email(s) queued.${data.delivery_configured ? " Delivery is enabled." : " Configure SMTP to deliver them."}`
      );
      setSubject("");
      setAnnouncement("");
    } catch (error) {
      setBroadcastMessage(error instanceof Error ? error.message : "Could not queue the email.");
    } finally {
      setBroadcasting(false);
    }
  }

  if (loading) return <p className="p-8 text-gray-600">Loading settings...</p>;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
    <section className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
      <h1 className="text-3xl font-bold text-[#202629]">Programme settings</h1>
      <p className="mt-3 text-sm leading-6 text-gray-600">
        Add the official WhatsApp group invite link when available. Registration remains open without it. Ambassadors can see the link here in the portal, and new ambassadors receive it with their welcome email when it is set before their first login.
      </p>
      <form onSubmit={saveSettings} className="mt-8 space-y-5">
        <div>
          <label htmlFor="invite-url" className="text-xs font-semibold uppercase text-gray-600">
            WhatsApp group invite link
          </label>
          <input
            id="invite-url"
            type="url"
            value={inviteUrl}
            onChange={(event) => setInviteUrl(event.target.value)}
            placeholder="https://chat.whatsapp.com/..."
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-[#202629]"
          />
        </div>
        <button disabled={saving} className="rounded-xl bg-[#202629] px-5 py-3 font-semibold text-white disabled:opacity-50">
          {saving ? "Saving..." : "Save invite link"}
        </button>
      </form>
      {message && <p role="status" className="mt-5 text-sm text-[#238C89]">{message}</p>}
    </section>
    <section className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
      <h2 className="text-2xl font-bold text-[#202629]">Email all ambassadors</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        Send a one-time announcement to every registered ambassador. The current group invite link is included automatically when configured. Each new campaign already sends its own separate email.
      </p>
      <form onSubmit={sendToAll} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-[#202629]">
          Subject
          <input value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={200} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3" />
        </label>
        <label className="block text-sm font-semibold text-[#202629]">
          Message
          <textarea value={announcement} onChange={(event) => setAnnouncement(event.target.value)} required maxLength={5000} rows={6} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3" />
        </label>
        <button disabled={broadcasting} className="rounded-xl bg-[#202629] px-5 py-3 font-semibold text-white disabled:opacity-50">
          {broadcasting ? "Queuing..." : "Email all ambassadors"}
        </button>
      </form>
      {broadcastMessage && <p role="status" className="mt-5 text-sm text-[#238C89]">{broadcastMessage}</p>}
    </section>
    </div>
  );
}
