"use client";
import { authFetch } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateCampaignPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  async function handleCreate() {
    setError("");

    if (!form.title.trim()) {
      setError("Campaign title is required.");
      return;
    }

    if (!form.startDate || !form.endDate) {
      setError("Start date and end date are required.");
      return;
    }

    if (form.endDate < form.startDate) {
      setError("End date cannot be before start date.");
      return;
    }

    try {
      setLoading(true);
const response = await authFetch(
  "http://127.0.0.1:8000/admin/campaigns",
  {
    method: "POST",
    body: JSON.stringify({
      title: form.title.trim(),
      description: form.description.trim() || null,
      mandatory_hashtag: form.hashtag.trim() || null,
      target_url: form.officialUrl.trim() || null,
      start_date: form.startDate,
      end_date: form.endDate,
      is_active: form.status === "ACTIVE",
    }),
  }
);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to create campaign."
        );
      }

      const campaignId = data.campaign?.campaign_id;

      if (!campaignId) {
        throw new Error(
          "Campaign was created, but no campaign ID was returned."
        );
      }

      router.push(`/admin/campaigns/${campaignId}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create campaign."
      );
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
            onClick={handleCreate}
            disabled={loading}
            className="rounded-xl bg-[#202629] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#343B3E] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create campaign"}
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
          Creating a campaign now saves it to PostgreSQL through the FastAPI
          backend. Active campaigns are available to eligible Campus
          Ambassadors during their configured campaign dates.
        </p>
      </section>
    </div>
  );
}
