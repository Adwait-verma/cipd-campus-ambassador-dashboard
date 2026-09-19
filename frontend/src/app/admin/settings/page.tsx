"use client";

import { authFetch } from "@/lib/api";
import { useEffect, useState } from "react";

type EmailStatus = {
  delivery_enabled: boolean;
  smtp_configured: boolean;
  delivery_ready: boolean;
  missing_settings: string[];
  older_queued: number;
  counts: { kind: string; status: string; count: number }[];
};

type AmbassadorRecipient = {
  user_id: number;
  full_name: string;
  email: string;
};

export default function AdminSettingsPage() {
  const [inviteUrl, setInviteUrl] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactLoading, setContactLoading] = useState(true);
  const [savingContact, setSavingContact] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [recipients, setRecipients] = useState<AmbassadorRecipient[]>([]);
  const [recipientUserId, setRecipientUserId] = useState("all");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [emailStatusMessage, setEmailStatusMessage] = useState("");
  const [sendingPending, setSendingPending] = useState(false);

  async function refreshEmailStatus() {
    const response = await authFetch("http://127.0.0.1:8000/admin/notifications/status");
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Could not load email status.");
    setEmailStatus(data);
  }

  useEffect(() => {
    authFetch("http://127.0.0.1:8000/admin/settings")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Could not load settings.");
        setInviteUrl(data.whatsapp_group_invite_url || "");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load settings."))
      .finally(() => setLoading(false));
    authFetch("http://127.0.0.1:8000/admin/contact")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Could not load programme contact details.");
        setLoginEmail(data.email || "");
        setContactEmail(data.contact_email || "");
        setContactPhone(data.phone_number || "");
      })
      .catch((error) =>
        setContactMessage(error instanceof Error ? error.message : "Could not load programme contact details.")
      )
      .finally(() => setContactLoading(false));
    authFetch("http://127.0.0.1:8000/admin/notifications/status")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Could not load email status.");
        setEmailStatus(data);
      })
      .catch((error) =>
        setEmailStatusMessage(error instanceof Error ? error.message : "Could not load email status.")
      );
    authFetch("http://127.0.0.1:8000/admin/notifications/recipients")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Could not load ambassadors.");
        setRecipients(data.ambassadors || []);
      })
      .catch((error) =>
        setBroadcastMessage(error instanceof Error ? error.message : "Could not load ambassadors.")
      );
  }, []);

  async function sendPending() {
    if (!window.confirm("Send all queued emails now, including older welcome and monthly-report messages?")) return;
    setSendingPending(true);
    setEmailStatusMessage("");
    try {
      const response = await authFetch("http://127.0.0.1:8000/admin/notifications/send-pending", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not send pending email.");
      setEmailStatusMessage(`${data.sent} sent; ${data.failed} failed. Check the counts below.`);
      await refreshEmailStatus();
    } catch (error) {
      setEmailStatusMessage(error instanceof Error ? error.message : "Could not send pending email.");
    } finally {
      setSendingPending(false);
    }
  }

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

  async function saveContact(event: React.FormEvent) {
    event.preventDefault();
    setSavingContact(true);
    setContactMessage("");
    try {
      const response = await authFetch("http://127.0.0.1:8000/admin/contact", {
        method: "PUT",
        body: JSON.stringify({
          contact_email: contactEmail.trim() || null,
          phone_number: contactPhone.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not save programme contact details.");
      setContactEmail(data.contact_email || "");
      setContactPhone(data.phone_number || "");
      setContactMessage("Programme help contact saved and visible to ambassadors.");
    } catch (error) {
      setContactMessage(error instanceof Error ? error.message : "Could not save programme contact details.");
    } finally {
      setSavingContact(false);
    }
  }

  async function sendAnnouncement(event: React.FormEvent) {
    event.preventDefault();
    const selected = recipients.find((recipient) => String(recipient.user_id) === recipientUserId);
    const destination = recipientUserId === "all"
      ? "every registered ambassador"
      : selected?.full_name || "the selected ambassador";
    if (!window.confirm(`Queue this email for ${destination}?`)) return;
    setBroadcasting(true);
    setBroadcastMessage("");
    try {
      const response = await authFetch("http://127.0.0.1:8000/admin/notifications/broadcast", {
        method: "POST",
        body: JSON.stringify({
          subject,
          message: announcement,
          recipient_user_id: recipientUserId === "all" ? null : Number(recipientUserId),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not queue the email.");
      setBroadcastMessage(
        `${data.queued} email(s) queued.${data.delivery_configured ? " Delivery is enabled." : " Configure SMTP to deliver them."}`
      );
      setSubject("");
      setAnnouncement("");
      setRecipientUserId("all");
      await refreshEmailStatus();
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
        Add the official WhatsApp group invite link when available. Registration remains open without it. Ambassadors can see the link in the portal, and new ambassadors receive it with their welcome email when it is set at registration.
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
      <h2 className="text-2xl font-bold text-[#202629]">Ambassador help contact</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        Set the official programme contact shown to every ambassador in their Help section. These details do not change your login email or the automated email sender.
      </p>
      <p className="mt-4 text-sm text-gray-600">
        Login email: <span className="font-medium text-[#202629]">{contactLoading ? "Loading..." : loginEmail}</span>
      </p>
      <form onSubmit={saveContact} className="mt-5 space-y-4">
        <label className="block text-sm font-semibold text-[#202629]">
          Contact email
          <input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} maxLength={150} placeholder="name@example.com" disabled={contactLoading} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3" />
        </label>
        <label className="block text-sm font-semibold text-[#202629]">
          Contact phone number
          <input type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} maxLength={20} placeholder="+91 98765 43210" disabled={contactLoading} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3" />
        </label>
        <button disabled={contactLoading || savingContact} className="rounded-xl bg-[#202629] px-5 py-3 font-semibold text-white disabled:opacity-50">
          {savingContact ? "Saving..." : "Save contact details"}
        </button>
      </form>
      {contactMessage && <p role="status" className="mt-4 text-sm text-gray-700">{contactMessage}</p>}
    </section>
    <section className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
      <h2 className="text-2xl font-bold text-[#202629]">Email delivery</h2>
      {emailStatus && (
        <>
          <p className="mt-2 text-sm leading-6 text-gray-700">
            {emailStatus.delivery_ready
              ? "SMTP settings are present. New emails will be attempted automatically; confirm delivery using the sent and failed counts below."
              : "Emails are queued, but cannot reach inboxes until SMTP delivery is enabled and configured on the backend."}
          </p>
          {!emailStatus.delivery_enabled && <p className="mt-2 text-sm text-amber-800">Set EMAIL_DELIVERY_ENABLED=true in backend/.env.</p>}
          {emailStatus.missing_settings.length > 0 && (
            <p className="mt-2 text-sm text-amber-800">Missing settings: {emailStatus.missing_settings.join(", ")}.</p>
          )}
          {emailStatus.older_queued > 0 && (
            <p className="mt-2 text-sm text-amber-800">
              {emailStatus.older_queued} older queued email(s) are held from automatic delivery.
              The button below includes them, so review before sending.
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {["PENDING", "SENDING", "SENT", "FAILED"].map((state) => (
              <div key={state} className="rounded-xl border border-gray-200 p-3">
                <span className="block font-semibold text-gray-600">{state.toLowerCase()}</span>
                <span className="text-2xl font-bold text-[#202629]">
                  {emailStatus.counts.filter((entry) => entry.status === state).reduce((sum, entry) => sum + entry.count, 0)}
                </span>
              </div>
            ))}
          </div>
          <button type="button" onClick={sendPending} disabled={!emailStatus.delivery_ready || sendingPending} className="mt-5 rounded-xl bg-[#202629] px-5 py-3 font-semibold text-white disabled:opacity-50">
            {sendingPending ? "Sending..." : "Send all pending now"}
          </button>
        </>
      )}
      {emailStatusMessage && <p role="status" className="mt-4 text-sm text-gray-700">{emailStatusMessage}</p>}
    </section>
    <section className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
      <h2 className="text-2xl font-bold text-[#202629]">Email ambassadors</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        Send a one-time announcement to everyone or choose one ambassador by name. The current group invite link is included automatically when configured. Each new campaign already sends its own separate email.
      </p>
      <form onSubmit={sendAnnouncement} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-[#202629]">
          Recipients
          <select value={recipientUserId} onChange={(event) => setRecipientUserId(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3">
            <option value="all">All registered ambassadors ({recipients.length})</option>
            {recipients.map((recipient) => (
              <option key={recipient.user_id} value={recipient.user_id}>
                {recipient.full_name} — {recipient.email}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-[#202629]">
          Subject
          <input value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={200} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3" />
        </label>
        <label className="block text-sm font-semibold text-[#202629]">
          Message
          <textarea value={announcement} onChange={(event) => setAnnouncement(event.target.value)} required maxLength={5000} rows={6} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3" />
        </label>
        <button disabled={broadcasting} className="rounded-xl bg-[#202629] px-5 py-3 font-semibold text-white disabled:opacity-50">
          {broadcasting ? "Queuing..." : recipientUserId === "all" ? "Email all ambassadors" : "Email selected ambassador"}
        </button>
      </form>
      {broadcastMessage && <p role="status" className="mt-5 text-sm text-[#238C89]">{broadcastMessage}</p>}
    </section>
    </div>
  );
}
