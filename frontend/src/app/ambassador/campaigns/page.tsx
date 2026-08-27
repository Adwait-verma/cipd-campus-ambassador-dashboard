"use client";

import Link from "next/link";
import { useState } from "react";

type CampaignStatus = "ACTIVE" | "UPCOMING" | "COMPLETED";

type Campaign = {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  hashtag: string;
  postsDue: number;
  status: CampaignStatus;
};

const campaigns: Campaign[] = [
  {
    id: 1,
    title: "AI Awareness Week",
    description:
      "Promote CiPD's latest AI research reel across your connected social platforms.",
    startDate: "Aug 26",
    endDate: "Sep 05",
    hashtag: "#CiPDResearch",
    postsDue: 2,
    status: "ACTIVE",
  },
  {
    id: 2,
    title: "Product Nation Stories",
    description:
      "Share CiPD content highlighting Indian product innovation and entrepreneurship.",
    startDate: "Sep 02",
    endDate: "Sep 12",
    hashtag: "#ProductNation",
    postsDue: 1,
    status: "UPCOMING",
  },
  {
    id: 3,
    title: "CiPD Research Showcase",
    description:
      "Highlight selected CiPD research projects and student-led innovation.",
    startDate: "Aug 10",
    endDate: "Aug 20",
    hashtag: "#CiPDInnovation",
    postsDue: 0,
    status: "COMPLETED",
  },
  {
    id: 4,
    title: "Founder Stories",
    description:
      "Promote inspiring founder stories connected to CiPD's product ecosystem.",
    startDate: "Jul 20",
    endDate: "Jul 31",
    hashtag: "#FounderStories",
    postsDue: 0,
    status: "COMPLETED",
  },
];

const tabs: CampaignStatus[] = ["ACTIVE", "UPCOMING", "COMPLETED"];

export default function CampaignsPage() {
  const [selectedTab, setSelectedTab] =
    useState<CampaignStatus>("ACTIVE");

  const filteredCampaigns = campaigns.filter(
    (campaign) => campaign.status === selectedTab
  );

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
          View campaign instructions, deadlines and required promotional
          content. Submit your social posts from the campaign details page.
        </p>
      </section>

      {/* Summary cards */}
      <section className="mb-7 grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 h-1.5 w-10 rounded-full bg-[#54B9B4]" />

          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Active Campaigns
          </p>

          <p className="mt-3 text-3xl font-bold text-[#202629]">1</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 h-1.5 w-10 rounded-full bg-[#9383D8]" />

          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Upcoming
          </p>

          <p className="mt-3 text-3xl font-bold text-[#202629]">1</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 h-1.5 w-10 rounded-full bg-[#E98AAE]" />

          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Completed
          </p>

          <p className="mt-3 text-3xl font-bold text-[#202629]">2</p>
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
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {filteredCampaigns.map((campaign) => (
          <div
            key={campaign.id}
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
              {campaign.description}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-[#F8FAFA] p-4">
                <p className="text-xs text-gray-400">Campaign dates</p>

                <p className="mt-1 text-sm font-semibold text-[#202629]">
                  {campaign.startDate} → {campaign.endDate}
                </p>
              </div>

              <div className="rounded-xl bg-[#F8FAFA] p-4">
                <p className="text-xs text-gray-400">Required hashtag</p>

                <p className="mt-1 text-sm font-semibold text-[#238C89]">
                  {campaign.hashtag}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-5">
              <div>
                <p className="text-xs text-gray-400">
                  {campaign.status === "COMPLETED"
                    ? "Campaign status"
                    : "Posts remaining"}
                </p>

                <p className="mt-1 text-sm font-semibold text-[#202629]">
                  {campaign.status === "COMPLETED"
                    ? "Completed"
                    : `${campaign.postsDue} post${
                        campaign.postsDue !== 1 ? "s" : ""
                      }`}
                </p>
              </div>

              <Link
                href={`/ambassador/campaigns/${campaign.id}`}
                className="rounded-xl bg-[#202629] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#343B3E]"
              >
                View Campaign →
              </Link>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}