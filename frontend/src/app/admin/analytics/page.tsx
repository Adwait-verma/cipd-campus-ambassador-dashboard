"use client";
import { authFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AnalyticsData = {
  summary: {
    verified_posts: number;
    total_reach: number;
    total_engagements: number;
    engagement_rate: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };

  platform_performance: {
    platform: string;
    posts: number;
    reach: number;
    engagements: number;
    engagement_rate: number;
  }[];

  campaign_performance: {
    campaign_id: number;
    campaign_title: string;
    submissions: number;
    verified_posts: number;
    reach: number;
    engagements: number;
    engagement_rate: number;
  }[];

  top_ambassadors: {
    ambassador_id: number;
    full_name: string;
    posts: number;
    reach: number;
    engagements: number;
    engagement_rate: number;
  }[];

  reach_trend: {
    date: string;
    reach: number;
  }[];
};

export default function AdminAnalyticsPage() {
  const [data, setData] =
    useState<AnalyticsData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAnalytics() {
      const storedUser =
        sessionStorage.getItem("cipd_user");

      if (!storedUser) {
        window.location.replace("/login");
        return;
      }

      try {
        const user = JSON.parse(storedUser);

        if (user.role !== "ADMIN") {
          window.location.replace("/login");
          return;
        }

       const response = await authFetch(
  "http://127.0.0.1:8000/admin/analytics"
);

        const result = await response.json();

        if (!response.ok) {
          setError(
            result.detail ||
              "Failed to load analytics."
          );
          return;
        }

        setData(result);
      } catch {
        setError(
          "Could not connect to the backend. Make sure FastAPI is running."
        );
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  const trendData = useMemo(() => {
    if (!data) {
      return [];
    }

    const maximum = Math.max(
      ...data.reach_trend.map(
        (item) => Number(item.reach)
      ),
      1
    );

    return data.reach_trend.map((item) => ({
      ...item,
      height:
        Number(item.reach) === 0
          ? 4
          : Math.max(
              8,
              (Number(item.reach) / maximum) * 100
            ),
    }));
  }, [data]);

  function formatNumber(value: number) {
    return Number(value || 0).toLocaleString();
  }

  function formatCompact(value: number) {
    const number = Number(value || 0);

    if (number >= 1_000_000) {
      return `${(number / 1_000_000).toFixed(2)}M`;
    }

    if (number >= 1_000) {
      return `${(number / 1_000).toFixed(1)}K`;
    }

    return number.toLocaleString();
  }

  function formatDate(value: string) {
    return new Date(
      `${value}T00:00:00`
    ).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">
          Loading analytics...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-semibold text-red-700">
            Could not load analytics
          </p>

          <p className="mt-2 text-sm text-red-600">
            {error || "Analytics unavailable."}
          </p>
        </div>
      </div>
    );
  }

  const {
    summary,
    platform_performance,
    campaign_performance,
    top_ambassadors,
  } = data;

  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#9383D8]">
          Analytics
        </p>

        <h1 className="text-3xl font-bold text-[#202629]">
          Programme analytics
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
          Real performance analytics from the latest
          verified metric snapshot for every campaign post.
        </p>
      </section>

      {/* Main KPIs */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Reach"
          value={formatCompact(summary.total_reach)}
          description="Verified posts only"
          color="#54B9B4"
        />

        <StatCard
          label="Total Engagements"
          value={formatNumber(
            summary.total_engagements
          )}
          description="Likes + comments + shares + saves"
          color="#9383D8"
        />

        <StatCard
          label="Engagement Rate"
          value={`${summary.engagement_rate}%`}
          description="Engagements divided by reach"
          color="#E98AAE"
        />

        <StatCard
          label="Verified Posts"
          value={formatNumber(
            summary.verified_posts
          )}
          description="Posts with stored metrics"
          color="#F0C568"
        />
      </section>

      {/* Interaction breakdown */}
      <section className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4">
        {[
          ["Likes", summary.likes],
          ["Comments", summary.comments],
          ["Shares", summary.shares],
          ["Saves", summary.saves],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {label}
            </p>

            <p className="mt-3 text-2xl font-bold text-[#202629]">
              {formatNumber(Number(value))}
            </p>
          </div>
        ))}
      </section>

      {/* Reach trend */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#202629]">
            Verified reach trend
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Reach from the latest snapshot for each
            verified post
          </p>
        </div>

        {trendData.length === 0 ? (
          <div className="mt-6 flex h-72 items-center justify-center rounded-xl bg-[#F8FAFA]">
            <p className="text-sm text-gray-400">
              No verified metric snapshots yet.
            </p>
          </div>
        ) : (
          <>
            <div className="relative mt-6 h-72 overflow-hidden rounded-xl bg-[#F8FAFA]">
              <div className="absolute inset-0 flex flex-col justify-around px-6 py-6">
                {[1, 2, 3, 4, 5].map((line) => (
                  <div
                    key={line}
                    className="border-t border-dashed border-gray-200"
                  />
                ))}
              </div>

              <div className="absolute bottom-7 left-8 right-8 flex h-[76%] items-end justify-between gap-5">
                {trendData.map((item) => (
                  <div
                    key={item.date}
                    className="flex h-full flex-1 items-end"
                    title={`${formatNumber(
                      item.reach
                    )} reach`}
                  >
                    <div
                      className="w-full rounded-t-lg bg-[#9383D8]"
                      style={{
                        height: `${item.height}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-between gap-2 px-3 text-xs text-gray-400">
              {trendData.map((item) => (
                <span key={item.date}>
                  {formatDate(item.date)}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Platform + Campaign */}
      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold text-[#202629]">
            Platform performance
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Verified performance grouped by platform
          </p>

          {platform_performance.length === 0 ? (
            <p className="mt-6 text-sm text-gray-400">
              No platform analytics yet.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {platform_performance.map(
                (platform) => (
                  <div
                    key={platform.platform}
                    className="rounded-xl bg-[#F8FAFA] p-5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-[#202629]">
                        {platform.platform}
                      </p>

                      <span className="rounded-full bg-[#DDF3F1] px-3 py-1 text-xs font-semibold text-[#238C89]">
                        {platform.posts} post
                        {platform.posts === 1
                          ? ""
                          : "s"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <MiniMetric
                        label="Reach"
                        value={formatCompact(
                          platform.reach
                        )}
                      />

                      <MiniMetric
                        label="Engagements"
                        value={formatNumber(
                          platform.engagements
                        )}
                      />

                      <MiniMetric
                        label="Rate"
                        value={`${platform.engagement_rate}%`}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold text-[#202629]">
            Campaign performance
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Reach and engagement by campaign
          </p>

          {campaign_performance.length === 0 ? (
            <p className="mt-6 text-sm text-gray-400">
              No campaign analytics yet.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {campaign_performance.map(
                (campaign) => (
                  <Link
                    key={campaign.campaign_id}
                    href={`/admin/campaigns/${campaign.campaign_id}`}
                    className="block rounded-xl border border-gray-100 bg-[#F8FAFA] p-5 transition hover:border-[#9383D8]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold text-[#202629]">
                        {campaign.campaign_title}
                      </p>

                      <span className="text-xs font-semibold text-[#9383D8]">
                        Manage →
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <MiniMetric
                        label="Submissions"
                        value={String(
                          campaign.submissions
                        )}
                      />

                      <MiniMetric
                        label="Verified"
                        value={String(
                          campaign.verified_posts
                        )}
                      />

                      <MiniMetric
                        label="Reach"
                        value={formatCompact(
                          campaign.reach
                        )}
                      />

                      <MiniMetric
                        label="Rate"
                        value={`${campaign.engagement_rate}%`}
                      />
                    </div>
                  </Link>
                )
              )}
            </div>
          )}
        </div>
      </section>

      {/* Top ambassadors */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-7">
          <h2 className="text-xl font-bold text-[#202629]">
            Ambassador performance
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Ranked here by verified programme reach
          </p>
        </div>

        {top_ambassadors.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No verified ambassador metrics yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="bg-[#F8FAFA] text-left">
                  {[
                    "Ambassador",
                    "Verified Posts",
                    "Reach",
                    "Engagements",
                    "Engagement Rate",
                    "",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {top_ambassadors.map(
                  (ambassador) => (
                    <tr
                      key={ambassador.ambassador_id}
                      className="border-t border-gray-100"
                    >
                      <td className="px-6 py-5 font-semibold text-[#202629]">
                        {ambassador.full_name}
                      </td>

                      <td className="px-6 py-5">
                        {ambassador.posts}
                      </td>

                      <td className="px-6 py-5 font-bold text-[#202629]">
                        {formatNumber(
                          ambassador.reach
                        )}
                      </td>

                      <td className="px-6 py-5">
                        {formatNumber(
                          ambassador.engagements
                        )}
                      </td>

                      <td className="px-6 py-5 font-semibold text-[#238C89]">
                        {ambassador.engagement_rate}%
                      </td>

                      <td className="px-6 py-5 text-right">
                        <Link
                          href={`/admin/ambassadors/${ambassador.ambassador_id}`}
                          className="text-sm font-semibold text-[#9383D8]"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-6">
        <p className="font-semibold text-[#202629]">
          Analytics methodology
        </p>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-500">
          Analytics use only the latest stored metric
          snapshot for each campaign post. This prevents
          cumulative social metrics from being counted
          multiple times when a post has several snapshots.
        </p>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  color,
}: {
  label: string;
  value: string;
  description: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div
        className="mb-5 h-1.5 w-10 rounded-full"
        style={{
          backgroundColor: color,
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold text-[#202629]">
        {value}
      </p>

      <p className="mt-2 text-xs text-gray-400">
        {description}
      </p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-400">
        {label}
      </p>

      <p className="mt-1 font-bold text-[#202629]">
        {value}
      </p>
    </div>
  );
}
