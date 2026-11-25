"use client";

import { authFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type LoggedInUser = {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
};

type DashboardData = {
  profile: {
    user_id: number;
    ambassador_id: number;
    full_name: string;
    email: string;
    college_name: string;
    graduation_year: number;
    status: string;
  };

  metrics: {
    total_reach: number;
    engagement_rate: number;
    published_posts: number;
    total_engagements: number;
  };

  rating: {
    rating_id: number;
    campaign_id: number;
    normalized_score: number;
    percentile_rank: number;
    star_rating: number;
    calculated_at: string;
  } | null;

  ranking: {
    current_rank: number | null;
    total_ranked: number;
  };

  active_campaign: {
    campaign_id: number;
    title: string;
    description: string | null;
    mandatory_hashtag: string | null;
    target_url: string | null;
    start_date: string;
    end_date: string;
    is_active: boolean;
  } | null;

  latest_submission: {
    post_id: number;
    platform: string;
    post_url: string;
    platform_post_id: string;
    published_at: string | null;
    is_verified: boolean;
    campaign_id: number;
    campaign_title: string;
    reach_count: number;
    likes_count: number;
    comments_count: number;
    shares_count: number;
    saves_count: number;
    fetched_at: string | null;
  } | null;
};

export default function AmbassadorDashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      const storedUser = sessionStorage.getItem("cipd_user");

      if (!storedUser) {
        window.location.replace("/login");
        return;
      }

      try {
        const user: LoggedInUser = JSON.parse(storedUser);

        if (user.role !== "AMBASSADOR") {
          window.location.replace("/login");
          return;
        }

        const response = await authFetch(
          `http://127.0.0.1:8000/ambassador/dashboard-data/${user.user_id}`
        );

        const data = await response.json();

        if (!response.ok) {
          setError(data.detail || "Failed to load dashboard.");
          return;
        }

        setDashboard(data);
      } catch {
        setError(
          "Could not connect to the backend. Make sure FastAPI is running."
        );
      }
    }

    loadDashboard();
  }, []);

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-semibold text-red-700">
            Could not load dashboard
          </p>

          <p className="mt-2 text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  const {
    profile,
    metrics,
    rating,
    ranking,
    active_campaign,
    latest_submission,
  } = dashboard;

  const firstName = profile.full_name.split(" ")[0];
  const isActive = profile.status === "ACTIVE";

  const metricCards = [
    {
      label: "Total Reach",
      value: metrics.total_reach.toLocaleString(),
      change: "Real reach",
      accent: "bg-[#54B9B4]",
    },
    {
      label: "Engagement Rate",
      value: `${metrics.engagement_rate}%`,
      change: `${metrics.total_engagements.toLocaleString()} engagements`,
      accent: "bg-[#9383D8]",
    },
    {
      label: "Published Posts",
      value: metrics.published_posts.toString(),
      change: "Submitted posts",
      accent: "bg-[#E98AAE]",
    },
    {
      label: "Current Rank",
      value:
        ranking.current_rank !== null
          ? `#${ranking.current_rank}`
          : "—",
      change:
        ranking.total_ranked > 0
          ? `of ${ranking.total_ranked}`
          : "Not ranked yet",
      accent: "bg-[#F0C568]",
    },
  ];

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Header */}
      <section className="mb-8 flex items-start justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-[#238C89]">
            AMBASSADOR DASHBOARD
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#202629]">
            Good afternoon, {firstName}.
          </h1>

          <p className="mt-2 text-sm text-gray-500">{profile.email}</p>

          <p className="mt-1 text-sm text-gray-500">
            {profile.college_name} · Graduation {profile.graduation_year}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Here&apos;s how your CiPD campaign performance is looking.
          </p>
        </div>

        {/* Real rating */}
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Overall rating
          </p>

          {rating ? (
            <div className="mt-2 flex items-center gap-3">
              <div className="text-xl tracking-wider text-[#F0C568]">
                {"★".repeat(rating.star_rating)}
                <span className="text-gray-200">
                  {"★".repeat(5 - rating.star_rating)}
                </span>
              </div>

              <span className="rounded-full bg-[#DDF3F1] px-3 py-1 text-xs font-bold text-[#238C89]">
                {rating.star_rating} STAR
              </span>
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-sm font-semibold text-gray-400">
                Not rated yet
              </p>

              <p className="mt-1 text-xs text-gray-400">
                A rating will appear after campaign scoring.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Real metric cards */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => (
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

            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="text-3xl font-bold text-[#202629]">
                {metric.value}
              </p>

              <span className="text-right text-xs font-semibold text-[#238C89]">
                {metric.change}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Main content */}
      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        {/* Performance information */}
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-[#202629]">
              Performance Overview
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Current values calculated from your latest campaign metric
              snapshots.
            </p>
          </div>

          {metrics.published_posts > 0 ? (
            <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-[#F8FAFA] p-5">
                <p className="text-xs uppercase tracking-wider text-gray-400">
                  Reach
                </p>

                <p className="mt-2 text-2xl font-bold text-[#202629]">
                  {metrics.total_reach.toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl bg-[#F8FAFA] p-5">
                <p className="text-xs uppercase tracking-wider text-gray-400">
                  Engagements
                </p>

                <p className="mt-2 text-2xl font-bold text-[#202629]">
                  {metrics.total_engagements.toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl bg-[#F8FAFA] p-5">
                <p className="text-xs uppercase tracking-wider text-gray-400">
                  Engagement Rate
                </p>

                <p className="mt-2 text-2xl font-bold text-[#202629]">
                  {metrics.engagement_rate}%
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-7 rounded-xl border border-dashed border-gray-300 bg-[#F8FAFA] p-8 text-center">
              <p className="font-semibold text-[#202629]">
                No campaign performance yet
              </p>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500">
                Once you submit campaign posts and CiPD retrieves their social
                engagement metrics, your reach and engagement statistics will
                appear here.
              </p>
            </div>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {/* Real active campaign */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#238C89]">
              Active Campaign
            </p>

            {active_campaign ? (
              <>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-bold text-[#202629]">
                    {active_campaign.title}
                  </h3>

                  <span className="rounded-full bg-[#DDF3F1] px-3 py-1 text-xs font-semibold text-[#238C89]">
                    ACTIVE
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-gray-500">
                  {active_campaign.description ||
                    "No campaign description provided."}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                  <div>
                    <p className="text-xs text-gray-400">Starts</p>

                    <p className="mt-1 text-sm font-semibold text-[#202629]">
                      {new Date(
                        `${active_campaign.start_date}T00:00:00`
                      ).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400">Deadline</p>

                    <p className="mt-1 text-sm font-semibold text-[#202629]">
                      {new Date(
                        `${active_campaign.end_date}T00:00:00`
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {active_campaign.mandatory_hashtag && (
                  <div className="mt-4 rounded-xl bg-[#F8FAFA] p-3">
                    <p className="text-xs text-gray-400">
                      Mandatory hashtag
                    </p>

                    <p className="mt-1 font-semibold text-[#238C89]">
                      {active_campaign.mandatory_hashtag}
                    </p>
                  </div>
                )}

                <Link
                  href={`/ambassador/campaigns/${active_campaign.campaign_id}`}
                  className="mt-5 block w-full rounded-xl bg-[#202629] py-3 text-center text-sm font-semibold text-white transition hover:bg-[#343B3E]"
                >
                  View Campaign →
                </Link>
              </>
            ) : (
              <div className="mt-5 rounded-xl bg-[#F8FAFA] p-5">
                <p className="font-semibold text-[#202629]">
                  No active campaign
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  There is currently no active CiPD campaign within its
                  scheduled date range.
                </p>
              </div>
            )}
          </div>

          {/* Real latest submission */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9383D8]">
              Latest Submission
            </p>

            {latest_submission ? (
              <>
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-[#202629]">
                      {latest_submission.platform}
                    </h3>

                    <p className="mt-1 text-xs text-gray-400">
                      {latest_submission.campaign_title}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      latest_submission.is_verified
                        ? "bg-green-50 text-green-700"
                        : "bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    {latest_submission.is_verified
                      ? "VERIFIED"
                      : "PENDING"}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#F8FAFA] p-3">
                    <p className="text-xs text-gray-400">Reach</p>

                    <p className="mt-1 font-bold text-[#202629]">
                      {latest_submission.reach_count.toLocaleString()}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#F8FAFA] p-3">
                    <p className="text-xs text-gray-400">Engagement</p>

                    <p className="mt-1 font-bold text-[#202629]">
                      {(
                        latest_submission.likes_count +
                        latest_submission.comments_count +
                        latest_submission.shares_count +
                        latest_submission.saves_count
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-xl bg-[#F8FAFA] p-5">
                <p className="font-semibold text-[#202629]">
                  No submissions yet
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Your most recent campaign submission will appear here after
                  you submit a post.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Real ambassador eligibility */}
      <section
        className={`mt-6 rounded-2xl border p-5 ${
          isActive
            ? "border-[#BDE3E0] bg-[#EDF8F7]"
            : "border-[#F3D9A5] bg-[#FFF8E8]"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-white ${
              isActive ? "bg-[#54B9B4]" : "bg-[#E9B949]"
            }`}
          >
            {isActive ? "✓" : "!"}
          </div>

          <div>
            <div className="flex items-center gap-3">
              <p className="font-semibold text-[#202629]">
                {isActive
                  ? "Active Campus Ambassador"
                  : "Ambassador verification pending"}
              </p>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  isActive
                    ? "bg-[#DDF3F1] text-[#238C89]"
                    : "bg-[#FCECC8] text-[#9A6A00]"
                }`}
              >
                {profile.status}
              </span>
            </div>

            <p className="mt-1 text-sm text-gray-500">
              {isActive
                ? "You have a verified Instagram account and are eligible for campaign scoring, rankings, and ambassador awards."
                : "Connect and verify your Instagram Business or Creator account to become eligible for campaign scoring, rankings, and ambassador awards."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
