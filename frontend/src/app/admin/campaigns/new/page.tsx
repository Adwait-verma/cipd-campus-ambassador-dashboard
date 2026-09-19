"use client";
import { authFetch } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateCampaignPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    subject: string;
    body: string;
    recipient_count: number;
  } | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    hashtag: "",
    officialUrl: "",
    status: "ACTIVE",
  });

  function updateField(field: keyof typeof form, value: string) {
    setError("");

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function campaignPayload() {
    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      mandatory_hashtag: form.hashtag.trim() || null,
      target_url: form.officialUrl.trim() || null,
      start_date: form.startDate,
      end_date: form.endDate,
      is_active: form.status === "ACTIVE",
    };
  }

  function validateForm() {
    setError("");
    if (!form.title.trim()) {
      setError("Campaign title is required.");
      return false;
    }
    if (!form.startDate || !form.endDate) {
      setError("Start date and end date are required.");
      return false;
    }
    if (form.endDate < form.startDate) {
      setError("End date cannot be before start date.");
      return false;
    }
    return true;
  }

  async function handlePreview() {
    if (!validateForm()) return;
    try {
      setPreviewLoading(true);
      const response = await authFetch(
        "http://127.0.0.1:8000/admin/campaigns/preview",
        {
          method: "POST",
          body: JSON.stringify(campaignPayload()),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Could not create the email preview.");
      }
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the email preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handlePublish() {
    if (!preview || !validateForm()) return;
    try {
      setLoading(true);
      const response = await authFetch(
        "http://127.0.0.1:8000/admin/campaigns",
        {
          method: "POST",
          body: JSON.stringify(campaignPayload()),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to publish campaign.");
      }
      const campaignId = data.campaign?.campaign_id;
      if (!campaignId) {
        throw new Error("Campaign was published, but no campaign ID was returned.");
      }
      router.push(`/admin/campaigns/${campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish campaign.");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-6">
        <Link
          href="/admin/campaigns"
          className="text-sm font-semibold text-[#9383D8]"
        >
          ← Back to campaigns
        </Link>
      </div>

      <section className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#9383D8]">
          Campaign Management
        </p>

        <h1 className="text-3xl font-bold text-[#202629]">
          Create new campaign
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
          Define the campaign brief, promotion requirements and timeline that
          will be shown to Campus Ambassadors.
        </p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Campaign title
            </label>

            <input
              value={form.title}
              onChange={(e) =>
                updateField("title", e.target.value)
              }
              placeholder="e.g. AI Awareness Week"
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Description
            </label>

            <textarea
              value={form.description}
              onChange={(e) =>
                updateField("description", e.target.value)
              }
              placeholder="Describe the programme or event, intended audience, key message, approved caption and any resource links. Explain what ambassadors should publish."
              rows={5}
              className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            />
            <p className="mt-2 text-xs leading-5 text-gray-600">
              Include the audience, approved wording and links to any posters or
              resources here. Use the fields below for dates, the required hashtag
              and the official page ambassadors should promote.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Start date
            </label>

            <input
              type="date"
              value={form.startDate}
              onChange={(e) =>
                updateField("startDate", e.target.value)
              }
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              End date
            </label>

            <input
              type="date"
              value={form.endDate}
              onChange={(e) =>
                updateField("endDate", e.target.value)
              }
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Required hashtag
            </label>

            <input
              value={form.hashtag}
              onChange={(e) =>
                updateField("hashtag", e.target.value)
              }
              placeholder="#CiPDResearch"
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Campaign status
            </label>

            <select
              value={form.status}
              onChange={(e) =>
                updateField("status", e.target.value)
              }
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Official CiPD content URL
            </label>

            <input
              value={form.officialUrl}
              onChange={(e) =>
                updateField("officialUrl", e.target.value)
              }
              placeholder="https://cipd.iiitd.ac.in/"
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            />
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading}
            className="rounded-xl bg-[#202629] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#343B3E] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {previewLoading ? "Preparing preview..." : "Preview campaign email"}
          </button>

          <Link
            href="/admin/campaigns"
            className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#D5EBE9] bg-[#F1FAF9] p-5">
        <p className="font-semibold text-[#202629]">
          Campaign persistence
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Nothing is saved or emailed when you open the preview. The campaign is
          listed in PostgreSQL and one notification is queued for every
          registered ambassador only after you confirm publication.
        </p>
      </section>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="campaign-preview-title">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-7 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#9383D8]">
              Final confirmation
            </p>
            <h2 id="campaign-preview-title" className="mt-2 text-2xl font-bold text-[#202629]">
              Preview campaign and ambassador email
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Publishing will list this campaign and queue this email for {preview.recipient_count} registered ambassador{preview.recipient_count === 1 ? "" : "s"}. The greeting will use each ambassador&apos;s name, and the final campaign link will contain the new campaign ID.
            </p>
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">Subject</p>
              <p className="mt-2 font-semibold text-[#202629]">{preview.subject}</p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-gray-600">Message</p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-gray-700">{preview.body}</pre>
            </div>
            {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={handlePublish} disabled={loading} className="rounded-xl bg-[#202629] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {loading ? "Publishing..." : "Publish campaign & send email"}
              </button>
              <button type="button" onClick={() => { setPreview(null); setError(""); }} disabled={loading} className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700">
                Edit campaign details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
