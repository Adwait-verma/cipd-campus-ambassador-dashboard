"use client";

import { authFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type CampaignStatus = "ACTIVE" | "UPCOMING" | "COMPLETED";

type Campaign = {
  campaign_id: number;
  title: string;
  description: string | null;
  mandatory_hashtag: string | null;
  target_url: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  status: CampaignStatus;
};

const tabs: CampaignStatus[] = ["ACTIVE", "UPCOMING", "COMPLETED"];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedTab, setSelectedTab] =
    useState<CampaignStatus>("ACTIVE");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCampaigns() {
      try {
        const response = await authFetch(
          "http://127.0.0.1:8000/ambassador/campaigns"
        );

        const data = await response.json();

        if (!response.ok) {
          setError(data.detail || "Failed to load campaigns.");
          return;
        }

        setCampaigns(data.campaigns);
      } catch {
        setError(
          "Could not connect to the backend. Make sure FastAPI is running."
        );
      } finally {
        setLoading(false);
      }
    }

    loadCampaigns();
  }, []);

  const filteredCampaigns = campaigns.filter(
    (campaign) => campaign.status === selectedTab
  );

  const activeCount = campaigns.filter(
    (campaign) => campaign.status === "ACTIVE"
  ).length;

  const upcomingCount = campaigns.filter(
    (campaign) => campaign.status === "UPCOMING"
  ).length;

  const completedCount = campaigns.filter(
    (campaign) => campaign.status === "COMPLETED"
  ).length;

  function formatDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Loading campaigns...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-semibold text-red-700">
            Could not load campaigns
          </p>

          <p className="mt-2 text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Header */}
      <section className="mb-8">
        <p className="mb-2 text-sm font-medium text-[#238C89]">
          CAMPAIGNS
        </p>

        <h1 className="text-3xl font-bold tracking-tight text-[#202629]">
          Your CiPD campaigns
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          View current, upcoming and completed CiPD campaigns directly from
          the campaign database.
        </p>
      </section>

      {/* Summary cards */}
      <section className="mb-7 grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 h-1.5 w-10 rounded-full bg-[#54B9B4]" />

          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Active Campaigns
          </p>

          <p className="mt-3 text-3xl font-bold text-[#202629]">
            {activeCount}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 h-1.5 w-10 rounded-full bg-[#9383D8]" />

          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Upcoming
          </p>

          <p className="mt-3 text-3xl font-bold text-[#202629]">
            {upcomingCount}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 h-1.5 w-10 rounded-full bg-[#E98AAE]" />

          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Completed
          </p>

          <p className="mt-3 text-3xl font-bold text-[#202629]">
            {completedCount}
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section className="mb-6">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
                selectedTab === tab
                  ? "bg-[#202629] text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {tab === "ACTIVE"
                ? "Active"
                : tab === "UPCOMING"
                  ? "Upcoming"
                  : "Completed"}
            </button>
          ))}
        </div>
      </section>

      {/* Campaign cards */}
      {filteredCampaigns.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-[#202629]">
            No {selectedTab.toLowerCase()} campaigns
          </p>

          <p className="mt-2 text-sm text-gray-500">
            There are currently no campaigns in this category.
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredCampaigns.map((campaign) => (
            <div
              key={campaign.campaign_id}
              className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      campaign.status === "ACTIVE"
                        ? "text-[#238C89]"
                        : campaign.status === "UPCOMING"
                          ? "text-[#9383D8]"
                          : "text-gray-400"
                    }`}
                  >
                    {campaign.status}
                  </p>

                  <h2 className="mt-3 text-xl font-bold text-[#202629]">
                    {campaign.title}
                  </h2>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    campaign.status === "ACTIVE"
                      ? "bg-[#DDF3F1] text-[#238C89]"
                      : campaign.status === "UPCOMING"
                        ? "bg-[#EEEAFB] text-[#6E5DB7]"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {campaign.status}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-gray-500">
                {campaign.description || "No campaign description provided."}
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-[#F8FAFA] p-4">
                  <p className="text-xs text-gray-400">Campaign dates</p>

                  <p className="mt-1 text-sm font-semibold text-[#202629]">
                    {formatDate(campaign.start_date)} →{" "}
                    {formatDate(campaign.end_date)}
                  </p>
                </div>

                <div className="rounded-xl bg-[#F8FAFA] p-4">
                  <p className="text-xs text-gray-400">Required hashtag</p>

                  <p className="mt-1 text-sm font-semibold text-[#238C89]">
                    {campaign.mandatory_hashtag || "None"}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-5">
                <div>
                  <p className="text-xs text-gray-400">Campaign status</p>

                  <p className="mt-1 text-sm font-semibold text-[#202629]">
                    {campaign.status === "ACTIVE"
                      ? "Open for submissions"
                      : campaign.status === "UPCOMING"
                        ? "Not started yet"
                        : "Campaign completed"}
                  </p>
                </div>

                <Link
                  href={`/ambassador/campaigns/${campaign.campaign_id}`}
                  className="rounded-xl bg-[#202629] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#343B3E]"
                >
                  View Campaign →
                </Link>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
