"use client";

import { authFetch } from "@/lib/api";
import { useEffect, useState } from "react";

export default function AdminSettingsPage() {
  const [inviteUrl, setInviteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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

  if (loading) return <p className="p-8 text-gray-600">Loading settings...</p>;
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
      <h1 className="text-3xl font-bold text-[#202629]">Programme settings</h1>
      <p className="mt-3 text-sm leading-6 text-gray-600">
        Add the official WhatsApp group invite link before opening registration. Every newly registered ambassador receives this link with the onboarding guidelines.
      </p>
      <form onSubmit={saveSettings} className="mt-8 space-y-5">
        <div>
          <label htmlFor="invite-url" className="text-xs font-semibold uppercase text-gray-600">
            WhatsApp group invite link
          </label>
          <input
            id="invite-url"
            type="url"
            required
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
  );
}
