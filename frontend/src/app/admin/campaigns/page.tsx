"use client";

import Link from "next/link";

const campaigns = [
  {
    id: 1,
    title: "AI Awareness Week",
    description: "Promote CiPD's latest AI research reel.",
    status: "ACTIVE",
    participants: 84,
    submissions: 136,
    verified: 121,
    startDate: "20 Aug 2026",
    endDate: "31 Aug 2026",
  },
  {
    id: 2,
    title: "Digital India Research",
    description: "Share CiPD research and increase student awareness.",
    status: "ACTIVE",
    participants: 57,
    submissions: 82,
    verified: 74,
    startDate: "24 Aug 2026",
    endDate: "5 Sep 2026",
  },
  {
    id: 3,
    title: "Campus Research Spotlight",
    description: "Highlight research projects from the CiPD community.",
    status: "COMPLETED",
    participants: 103,
    submissions: 188,
    verified: 176,
    startDate: "1 Aug 2026",
    endDate: "15 Aug 2026",
  },
];

export default function AdminCampaignsPage() {
  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "ACTIVE"
  ).length;

  const totalSubmissions = campaigns.reduce(
    (sum, campaign) => sum + campaign.submissions,
    0
  );

  const totalVerified = campaigns.reduce(
    (sum, campaign) => sum + campaign.verified,
    0
  );

  const verificationRate = Math.round(
    (totalVerified / totalSubmissions) * 100
  );

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#238C89]">
            Campaign Management
          </p>

          <h1 className="mt-2 text-3xl font-bold text-[#202629]">
            Campaigns
          </h1>

          <p className="mt-2 text-gray-500">
            Create and manage CiPD ambassador campaigns.
          </p>
        </div>

        <Link
          href="/admin/campaigns/new"
          className="w-fit rounded-xl bg-[#202629] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black"
        >
          + Create Campaign
        </Link>
      </div>

      {/* Statistics */}
      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Campaigns"
          value={String(campaigns.length)}
          color="#54B9B4"
        />

        <StatCard
          label="Active Campaigns"
          value={String(activeCampaigns)}
          color="#9383D8"
        />

        <StatCard
          label="Total Submissions"
          value={String(totalSubmissions)}
          color="#E98AAE"
        />

        <StatCard
          label="Verification Rate"
          value={`${verificationRate}%`}
          color="#F0C568"
        />
      </div>

      {/* Campaign list */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-6">
          <h2 className="text-xl font-bold text-[#202629]">
            All campaigns
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Monitor campaign participation and submissions.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-[#F8FAFA]">
                {[
                  "Campaign",
                  "Status",
                  "Participants",
                  "Submissions",
                  "Verified",
                  "Duration",
                  "",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {campaigns.map((campaign) => {
                const rate = Math.round(
                  (campaign.verified / campaign.submissions) * 100
                );

                return (
                  <tr
                    key={campaign.id}
                    className="border-t border-gray-100 transition hover:bg-gray-50"
                  >
                    <td className="px-6 py-5">
                      <p className="font-semibold text-[#202629]">
                        {campaign.title}
                      </p>

                      <p className="mt-1 max-w-[300px] text-sm text-gray-400">
                        {campaign.description}
                      </p>
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          campaign.status === "ACTIVE"
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </td>

                    <td className="px-6 py-5 font-semibold text-[#202629]">
                      {campaign.participants}
                    </td>

                    <td className="px-6 py-5 font-semibold text-[#202629]">
                      {campaign.submissions}
                    </td>

                    <td className="px-6 py-5">
                      <p className="font-semibold text-[#202629]">
                        {campaign.verified}
                      </p>

                      <p className="mt-1 text-xs text-[#238C89]">
                        {rate}% verified
                      </p>
                    </td>

                    <td className="px-6 py-5 text-sm text-gray-500">
                      <p>{campaign.startDate}</p>
                      <p className="mt-1">→ {campaign.endDate}</p>
                    </td>

                    <td className="px-6 py-5">
                      <Link
                        href={`/admin/campaigns/${campaign.id}`}
                        className="font-semibold text-[#9383D8]"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div
        className="mb-5 h-1.5 w-10 rounded-full"
        style={{ backgroundColor: color }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold text-[#202629]">
        {value}
      </p>
    </div>
  );
}