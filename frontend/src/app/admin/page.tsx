"use client";
import { authFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type OverviewData = {
  metrics: {
    registered_users: number;
    active_ambassadors: number;
    pending_ambassadors: number;
    active_campaigns: number;
    verified_posts: number;
    unverified_posts: number;
    total_reach: number;
    total_engagements: number;
    engagement_rate: number;
    campaigns_ending_soon: number;
  };

  reach_trend: {
    date: string;
    reach: number;
  }[];

  recent_activity: {
    name: string;
    action: string;
    timestamp: string;
    type: string;
  }[];
};

export default function AdminOverviewPage() {
  const [data, setData] =
    useState<OverviewData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOverview() {
      const storedUser =
        sessionStorage.getItem("cipd_user");

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
  "http://127.0.0.1:8000/admin/overview"
);

        const result = await response.json();

        if (!response.ok) {
          setError(
            result.detail ||
              "Failed to load admin overview."
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

    loadOverview();
  }, []);

  const chartData = useMemo(() => {
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

  function formatShortDate(value: string) {
    return new Date(
      `${value}T00:00:00`
    ).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  function relativeTime(value: string) {
    const date = new Date(value);
    const now = new Date();

    const difference =
      now.getTime() - date.getTime();

    const minutes = Math.floor(
      difference / 60000
    );

    if (minutes < 1) {
      return "Just now";
    }

    if (minutes < 60) {
      return `${minutes} min ago`;
    }

    const hours = Math.floor(
      minutes / 60
    );

    if (hours < 24) {
      return `${hours} hr${hours === 1 ? "" : "s"} ago`;
    }

    const days = Math.floor(
      hours / 24
    );

    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">
          Loading admin overview...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-semibold text-red-700">
            Could not load overview
          </p>

          <p className="mt-2 text-sm text-red-600">
            {error || "Overview data is unavailable."}
          </p>
        </div>
      </div>
    );
  }

  const { metrics, recent_activity } = data;

  const cards = [
    {
      label: "Registered Ambassadors",
      value: formatNumber(
        metrics.registered_users
      ),
      change: "Registered ambassador accounts",
      accent: "bg-[#54B9B4]",
    },

    {
      label: "Active Ambassadors",
      value: formatNumber(
        metrics.active_ambassadors
      ),
      change: "At least one verified social",
      accent: "bg-[#9383D8]",
    },

    {
      label: "Pending Connection",
      value: formatNumber(
        metrics.pending_ambassadors
      ),
      change: "Excluded from scoring",
      accent: "bg-[#E98AAE]",
    },

    {
      label: "Active Campaigns",
      value: formatNumber(
        metrics.active_campaigns
      ),
      change:
        metrics.campaigns_ending_soon > 0
          ? `${metrics.campaigns_ending_soon} ending within 7 days`
          : "None ending within 7 days",
      accent: "bg-[#F0C568]",
    },
  ];

  const attentionItems = [
    {
      value: metrics.unverified_posts,
      label: "Unverified campaign posts",
    },

    {
      value: metrics.pending_ambassadors,
      label:
        "Ambassadors awaiting verified social connection",
    },

    {
      value: metrics.campaigns_ending_soon,
      label: "Campaigns closing within 7 days",
    },
  ];

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Header */}
      <section className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-[#9383D8]">
            ADMIN OVERVIEW
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#202629]">
            Campus Ambassador programme
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Monitor registrations, verified ambassadors,
            campaign activity, engagement and award
            readiness.
          </p>
        </div>

        <Link
          href="/admin/campaigns/new"
          className="w-fit rounded-xl bg-[#202629] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#343B3E]"
        >
          + Create Campaign
        </Link>
      </section>

      {/* Rule */}
      <section className="mb-6 rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-5">
        <p className="font-semibold text-[#202629]">
          Active Ambassador definition
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Registered users are counted as active Campus
          Ambassadors only after at least one supported
          social account is connected and verified. Pending
          users are excluded from normalization, rankings and
          star allocation.
        </p>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div
              className={`mb-5 h-1.5 w-10 rounded-full ${metric.accent}`}
            />

            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {metric.label}
            </p>

            <p className="mt-3 text-3xl font-bold text-[#202629]">
              {metric.value}
            </p>

            <p className="mt-2 text-xs font-medium text-gray-400">
              {metric.change}
            </p>
          </div>
        ))}
      </section>

      {/* Analytics */}
      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        {/* Reach activity */}
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#202629]">
              Recent verified reach
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Latest stored verified reach snapshots
            </p>
          </div>

          {chartData.length === 0 ? (
            <div className="flex h-72 items-center justify-center rounded-xl bg-[#F8FAFA]">
              <div className="text-center">
                <p className="font-semibold text-[#202629]">
                  No metric snapshots yet
                </p>

                <p className="mt-2 text-sm text-gray-400">
                  Verified campaign metrics will appear here.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="relative h-72 overflow-hidden rounded-xl bg-[#F8FAFA]">
                <div className="absolute inset-0 flex flex-col justify-around px-6 py-6">
                  {[1, 2, 3, 4, 5].map((line) => (
                    <div
                      key={line}
                      className="border-t border-dashed border-gray-200"
                    />
                  ))}
                </div>

                <div className="absolute bottom-7 left-8 right-8 flex h-[76%] items-end justify-between gap-5">
                  {chartData.map((item) => (
                    <div
                      key={item.date}
                      className="flex h-full flex-1 items-end"
                      title={`${formatNumber(
                        item.reach
                      )} reach`}
                    >
                      <div
                        className="w-full rounded-t-lg bg-[#9383D8] transition hover:bg-[#7564BC]"
                        style={{
                          height: `${item.height}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex justify-between gap-2 px-3 text-xs text-gray-400">
                {chartData.map((item) => (
                  <span key={item.date}>
                    {formatShortDate(item.date)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="space-y-6">
          {/* Needs attention */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#202629]">
              Needs attention
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Items requiring admin review
            </p>

            <div className="mt-6 space-y-4">
              {attentionItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-4 rounded-xl bg-[#F8FAFA] p-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F6EAF0] font-bold text-[#C95E85]">
                    {item.value}
                  </div>

                  <p className="text-sm leading-5 text-gray-500">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Reach */}
          <div className="rounded-2xl bg-[#202629] p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#54B9B4]">
              Total programme reach
            </p>

            <p className="mt-4 text-4xl font-bold">
              {formatCompact(
                metrics.total_reach
              )}
            </p>

            <p className="mt-2 text-sm text-gray-300">
              From latest verified campaign snapshots
            </p>

            <div className="mt-5 grid grid-cols-2 gap-5 border-t border-white/10 pt-5">
              <div>
                <p className="text-xs text-gray-400">
                  Verified posts
                </p>

                <p className="mt-1 text-xl font-bold">
                  {metrics.verified_posts}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400">
                  Engagement
                </p>

                <p className="mt-1 text-xl font-bold">
                  {metrics.engagement_rate}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Activity */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-7">
          <h2 className="text-xl font-bold text-[#202629]">
            Recent programme activity
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Recent registrations and campaign submissions
          </p>
        </div>

        {recent_activity.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">
              No recent programme activity.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recent_activity.map(
              (item, index) => (
                <div
                  key={`${item.type}-${item.timestamp}-${index}`}
                  className="flex items-center justify-between gap-5 px-7 py-5"
                >
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold text-[#202629]">
                      {item.name}
                    </span>{" "}
                    {item.action}
                  </p>

                  <span className="shrink-0 text-xs text-gray-400">
                    {relativeTime(item.timestamp)}
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* Real data note */}
      <section className="mt-6 rounded-2xl border border-[#E5DFF6] bg-[#F6F3FC] p-6">
        <p className="font-semibold text-[#202629]">
          Live PostgreSQL overview
        </p>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-500">
          Registration counts, ambassador eligibility,
          campaign activity, verified posts and programme
          reach on this page now come directly from the
          backend rather than frontend mock values.
        </p>
      </section>
    </div>
  );
}
