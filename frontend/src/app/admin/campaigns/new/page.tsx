"use client";

import Link from "next/link";
import { useState } from "react";

export default function CreateCampaignPage() {
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    hashtag: "",
    officialUrl: "",
    requiredPosts: "1",
    status: "DRAFT",
  });

  function updateField(field: keyof typeof form, value: string) {
    setSaved(false);

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleCreate() {
    if (!form.title.trim()) return;

    setSaved(true);
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
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Campaign title
            </label>

            <input
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="e.g. AI Awareness Week"
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Description
            </label>

            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Explain what ambassadors need to promote..."
              rows={5}
              className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Start date
            </label>

            <input
              type="date"
              value={form.startDate}
              onChange={(e) => updateField("startDate", e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              End date
            </label>

            <input
              type="date"
              value={form.endDate}
              onChange={(e) => updateField("endDate", e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Required hashtag
            </label>

            <input
              value={form.hashtag}
              onChange={(e) => updateField("hashtag", e.target.value)}
              placeholder="#CiPDResearch"
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Required posts
            </label>

            <input
              type="number"
              min="1"
              value={form.requiredPosts}
              onChange={(e) => updateField("requiredPosts", e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Official CiPD content URL
            </label>

            <input
              value={form.officialUrl}
              onChange={(e) => updateField("officialUrl", e.target.value)}
              placeholder="https://..."
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Campaign status
            </label>

            <select
              value={form.status}
              onChange={(e) => updateField("status", e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="UPCOMING">Upcoming</option>
            </select>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            onClick={handleCreate}
            className="rounded-xl bg-[#202629] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#343B3E]"
          >
            Create campaign
          </button>

          <Link
            href="/admin/campaigns"
            className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-50"
          >
            Cancel
          </Link>

          {saved && (
            <span className="text-sm font-semibold text-green-700">
              Campaign saved in prototype
            </span>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#E5DFF6] bg-[#F6F3FC] p-5">
        <p className="font-semibold text-[#202629]">
          Prototype behaviour
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          This form currently stores data only in the frontend state. Later,
          clicking Create Campaign will send a POST request to FastAPI and
          create the campaign in PostgreSQL.
        </p>
      </section>
    </div>
  );
}