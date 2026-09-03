"use client";
import { authFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CampaignStatus =
  | "ACTIVE"
  | "UPCOMING"
  | "COMPLETED";

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
  participants: number;
  submissions: number;
  verified: number;
};

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCampaigns() {
      const storedUser = localStorage.getItem("cipd_user");

      if (!storedUser) {
        window.location.href = "/login";
        return;
      }

      try {
        const user = JSON.parse(storedUser);

        if (user.role !== "ADMIN") {
          window.location.href = "/login";
          return;
        }

        const response = await authFetch(
  "http://127.0.0.1:8000/admin/campaigns"
);

        const data = await response.json();

        if (!response.ok) {
          setError(
            data.detail || "Failed to load campaigns."
          );
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

  const statistics = useMemo(() => {
    const activeCampaigns = campaigns.filter(
      (campaign) => campaign.status === "ACTIVE"
    ).length;

    const totalSubmissions = campaigns.reduce(
      (sum, campaign) =>
        sum + Number(campaign.submissions || 0),
      0
    );

    const totalVerified = campaigns.reduce(
      (sum, campaign) =>
        sum + Number(campaign.verified || 0),
      0
    );

    const verificationRate =
      totalSubmissions > 0
        ? Math.round(
            (totalVerified / totalSubmissions) * 100
          )
        : 0;

    return {
      activeCampaigns,
      totalSubmissions,
      totalVerified,
      verificationRate,
    };
  }, [campaigns]);

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">
          Loading campaigns...
        </p>
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

          <p className="mt-2 text-sm text-red-600">
            {error}
          </p>
        </div>
      </div>
    );
  }

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
            Create, manage and score CiPD ambassador campaigns.
          </p>
        </div>

        <Link
          href="/admin/campaigns/new"
          className="w-fit rounded-xl bg-[#202629] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black"
        >
          + Create Campaign
        </Link>
      </div>

      {/* Real statistics */}
      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Campaigns"
          value={String(campaigns.length)}
          color="#54B9B4"
        />

        <StatCard
          label="Active Campaigns"
          value={String(statistics.activeCampaigns)}
          color="#9383D8"
        />

        <StatCard
          label="Total Submissions"
          value={String(statistics.totalSubmissions)}
          color="#E98AAE"
        />

        <StatCard
          label="Verification Rate"
          value={`${statistics.verificationRate}%`}
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
            Real campaign participation and submission data.
          </p>
        </div>

        {campaigns.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-semibold text-[#202629]">
              No campaigns yet
            </p>

            <p className="mt-2 text-sm text-gray-400">
              Create your first campaign to begin.
            </p>
          </div>
        ) : (
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
                  const submissions =
                    Number(campaign.submissions || 0);

                  const verified =
                    Number(campaign.verified || 0);

                  const verificationRate =
                    submissions > 0
                      ? Math.round(
                          (verified / submissions) * 100
                        )
                      : 0;

                  return (
                    <tr
                      key={campaign.campaign_id}
                      className="border-t border-gray-100 transition hover:bg-gray-50"
                    >
                      <td className="px-6 py-5">
                        <p className="font-semibold text-[#202629]">
                          {campaign.title}
                        </p>

                        <p className="mt-1 max-w-[300px] text-sm text-gray-400">
                          {campaign.description ||
                            "No description provided."}
                        </p>

                        {campaign.mandatory_hashtag && (
                          <p className="mt-2 text-xs font-semibold text-[#9383D8]">
                            {campaign.mandatory_hashtag}
                          </p>
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            campaign.status === "ACTIVE"
                              ? "bg-green-50 text-green-700"
                              : campaign.status ===
                                  "UPCOMING"
                                ? "bg-blue-50 text-blue-700"
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
                          {verificationRate}% verified
                        </p>
                      </td>

                      <td className="px-6 py-5 text-sm text-gray-500">
                        <p>
                          {formatDate(campaign.start_date)}
                        </p>

                        <p className="mt-1">
                          → {formatDate(campaign.end_date)}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <Link
                          href={`/admin/campaigns/${campaign.campaign_id}`}
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
        )}
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