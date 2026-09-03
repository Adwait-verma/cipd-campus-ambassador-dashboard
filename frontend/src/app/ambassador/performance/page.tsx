"use client";

import { authFetch } from "@/lib/api";
import { useEffect, useState } from "react";

type StoredUser = {
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
    current_rank: number;
    total_ranked: number;
  } | null;
};

type LeaderboardEntry = {
  ambassador_id: number;
  user_id: number;
  full_name: string;
  college_name: string;
  total_reach: number;
  normalized_score: number;
  percentile_rank: number;
  star_rating: number;
  current_rank: number;
};

type LeaderboardResponse = {
  total_ranked: number;
  leaderboard: LeaderboardEntry[];
};

const scoringSteps = [
  {
    title: "Raw Metrics",
    description: "Reach, likes, comments, shares and saves",
  },
  {
    title: "Engagement Rate",
    description: "Measures engagement relative to audience/reach",
  },
  {
    title: "Platform Percentiles",
    description: "Compares reach and engagement within each platform",
  },
  {
    title: "Weighted Score",
    description: "Uses 30% reach and 70% engagement percentiles",
  },
  {
    title: "Ambassador Average",
    description: "Averages scores when an ambassador has multiple posts",
  },
  {
    title: "Percentile",
    description: "Shows your position among eligible ambassadors",
  },
  {
    title: "Star Rating",
    description: "Final award category generated from the scoring policy",
  },
];

function Stars({ count }: { count: number }) {
  const safeCount = Math.max(0, Math.min(5, count));

  return (
    <span className="tracking-wider text-[#F0C568]">
      {"★".repeat(safeCount)}
      <span className="text-gray-200">
        {"★".repeat(5 - safeCount)}
      </span>
    </span>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatReach(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return value.toLocaleString();
}

function ordinal(value: number) {
  const mod100 = value % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

export default function PerformancePage() {
  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [leaderboard, setLeaderboard] =
    useState<LeaderboardEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPerformance() {
      try {
        const stored = localStorage.getItem("cipd_user");

        if (!stored) {
          window.location.href = "/login";
          return;
        }

        const user: StoredUser = JSON.parse(stored);

        if (user.role !== "AMBASSADOR") {
          window.location.href = "/login";
          return;
        }

        const [dashboardResponse, leaderboardResponse] =
          await Promise.all([
            authFetch(
              `http://127.0.0.1:8000/ambassador/dashboard-data/${user.user_id}`
            ),
            authFetch(
              "http://127.0.0.1:8000/ambassador/leaderboard"
            ),
          ]);

        const dashboardJson =
          await dashboardResponse.json();

        const leaderboardJson: LeaderboardResponse =
          await leaderboardResponse.json();

        if (!dashboardResponse.ok) {
          throw new Error(
            dashboardJson.detail ||
              "Failed to load performance data."
          );
        }

        if (!leaderboardResponse.ok) {
          throw new Error(
            (leaderboardJson as unknown as { detail?: string })
              .detail ||
              "Failed to load leaderboard."
          );
        }

        setDashboard(dashboardJson);

        setLeaderboard(
          leaderboardJson.leaderboard || []
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load performance."
        );
      } finally {
        setLoading(false);
      }
    }

    loadPerformance();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1500px] py-20 text-center text-gray-500">
        Loading performance...
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="mx-auto max-w-[1500px]">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">
          {error || "Performance data could not be loaded."}
        </div>
      </div>
    );
  }

  const rating = dashboard.rating;
  const ranking = dashboard.ranking;

  const scoringEligible =
    dashboard.profile.status === "ACTIVE" &&
    rating !== null;

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Header */}
      <section className="mb-8">
        <p className="mb-2 text-sm font-medium text-[#238C89]">
          PERFORMANCE
        </p>

        <h1 className="text-3xl font-bold tracking-tight text-[#202629]">
          Your performance & ranking
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Understand how your CiPD campaign engagement is normalized and
          converted into your leaderboard position and star rating.
        </p>
      </section>

      {/* Main cards */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="rounded-2xl bg-[#202629] p-7 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#54B9B4]">
            Current Rating
          </p>

          {rating ? (
            <>
              <div className="mt-5 flex items-center gap-4">
                <p className="text-4xl font-bold">
                  {rating.star_rating} STAR
                </p>

                <Stars count={rating.star_rating} />
              </div>

              <p className="mt-5 text-sm leading-6 text-gray-300">
                Based on your latest calculated campaign rating.
              </p>
            </>
          ) : (
            <>
              <p className="mt-5 text-3xl font-bold">
                Not rated yet
              </p>

              <p className="mt-5 text-sm leading-6 text-gray-300">
                Submit a campaign post and wait for verified
                metrics before a rating is calculated.
              </p>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 h-1.5 w-10 rounded-full bg-[#54B9B4]" />

          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Normalized Score
          </p>

          <p className="mt-4 text-3xl font-bold text-[#202629]">
            {rating
              ? rating.normalized_score.toFixed(2)
              : "—"}
          </p>

          <p className="mt-2 text-xs text-gray-400">
            Latest calculated score
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 h-1.5 w-10 rounded-full bg-[#9383D8]" />

          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Percentile
          </p>

          <p className="mt-4 text-3xl font-bold text-[#202629]">
            {rating
              ? `${rating.percentile_rank.toFixed(2)}%`
              : "—"}
          </p>

          <p className="mt-2 text-xs text-gray-400">
            Among eligible ambassadors
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 h-1.5 w-10 rounded-full bg-[#E98AAE]" />

          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Current Rank
          </p>

          <p className="mt-4 text-3xl font-bold text-[#202629]">
            {ranking ? `#${ranking.current_rank}` : "—"}
          </p>

          <p className="mt-2 text-xs text-gray-400">
            {ranking
              ? `of ${ranking.total_ranked} ranked ambassadors`
              : "No calculated ranking yet"}
          </p>
        </div>
      </section>

      {/* Real metrics */}
      <section className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Total Reach
          </p>

          <p className="mt-3 text-2xl font-bold text-[#202629]">
            {dashboard.metrics.total_reach.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Engagement Rate
          </p>

          <p className="mt-3 text-2xl font-bold text-[#202629]">
            {dashboard.metrics.engagement_rate}%
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Engagements
          </p>

          <p className="mt-3 text-2xl font-bold text-[#202629]">
            {dashboard.metrics.total_engagements.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Published Posts
          </p>

          <p className="mt-3 text-2xl font-bold text-[#202629]">
            {dashboard.metrics.published_posts}
          </p>
        </div>
      </section>

      {/* Scoring explanation */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
        <div className="mb-7">
          <h2 className="text-xl font-bold text-[#202629]">
            How is my rating calculated?
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Verified campaign metrics are processed by the backend
            scoring engine before a normalized score, percentile,
            ranking and star rating are stored.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
          {scoringSteps.map((step, index) => (
            <div
              key={step.title}
              className="relative rounded-xl border border-gray-200 bg-[#F8FAFA] p-4"
            >
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[#DDF3F1] text-xs font-bold text-[#238C89]">
                {index + 1}
              </div>

              <h3 className="text-sm font-bold text-[#202629]">
                {step.title}
              </h3>

              <p className="mt-2 text-xs leading-5 text-gray-500">
                {step.description}
              </p>

              {index < scoringSteps.length - 1 && (
                <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-gray-300 xl:block">
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Eligibility */}
      <section
        className={`mt-6 rounded-2xl border p-5 ${
          scoringEligible
            ? "border-[#BDE3E0] bg-[#EDF8F7]"
            : "border-[#F0D69B] bg-[#FFF8E8]"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white ${
              scoringEligible
                ? "bg-[#54B9B4]"
                : "bg-[#E4B64B]"
            }`}
          >
            {scoringEligible ? "✓" : "!"}
          </div>

          <div>
            <p className="font-semibold text-[#202629]">
              {scoringEligible
                ? "You are currently scoring-eligible"
                : "Rating not available yet"}
            </p>

            <p className="mt-1 text-sm leading-6 text-gray-500">
              Only active ambassadors with verified campaign posts
              and stored campaign metrics enter the calculated
              leaderboard.
            </p>
          </div>
        </div>
      </section>

      {/* Real leaderboard */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-7">
          <h2 className="text-xl font-bold text-[#202629]">
            Ambassador Leaderboard
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Current ranking from calculated ambassador ratings
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F8FAFA] text-left">
                <th className="px-7 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Rank
                </th>

                <th className="px-7 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Ambassador
                </th>

                <th className="px-7 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  College
                </th>

                <th className="px-7 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Reach
                </th>

                <th className="px-7 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Score
                </th>

                <th className="px-7 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Percentile
                </th>

                <th className="px-7 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Rating
                </th>
              </tr>
            </thead>

            <tbody>
              {leaderboard.map((ambassador) => {
                const currentUser =
                  ambassador.user_id ===
                  dashboard.profile.user_id;

                return (
                  <tr
                    key={ambassador.ambassador_id}
                    className={`border-b border-gray-100 ${
                      currentUser
                        ? "bg-[#EDF8F7]"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-7 py-5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F8FAFA] text-sm font-bold text-[#202629]">
                        {ambassador.current_rank}
                      </div>
                    </td>

                    <td className="px-7 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#202629] text-xs font-bold text-white">
                          {initials(
                            ambassador.full_name
                          )}
                        </div>

                        <div>
                          <p className="font-semibold text-[#202629]">
                            {ambassador.full_name}
                          </p>

                          {currentUser && (
                            <p className="mt-1 text-xs font-medium text-[#238C89]">
                              You
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-7 py-5 text-sm text-gray-500">
                      {ambassador.college_name}
                    </td>

                    <td className="px-7 py-5 font-semibold text-[#202629]">
                      {formatReach(
                        ambassador.total_reach
                      )}
                    </td>

                    <td className="px-7 py-5 font-bold text-[#202629]">
                      {Number(
                        ambassador.normalized_score
                      ).toFixed(2)}
                    </td>

                    <td className="px-7 py-5 text-sm text-gray-500">
                      {Number(
                        ambassador.percentile_rank
                      ).toFixed(2)}
                      %
                    </td>

                    <td className="px-7 py-5">
                      <Stars
                        count={
                          ambassador.star_rating
                        }
                      />
                    </td>
                  </tr>
                );
              })}

              {leaderboard.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-7 py-10 text-center text-sm text-gray-400"
                  >
                    No calculated ratings are available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Methodology */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Methodology note
        </p>

        <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-500">
          All values on this page now come from stored ambassador,
          campaign, metric-snapshot and calculated-rating data.
          Ratings change when campaign metrics are verified and an
          administrator recalculates campaign ratings.
        </p>
      </section>
    </div>
  );
}
