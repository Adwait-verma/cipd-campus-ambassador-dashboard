"use client";
import { authFetch } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type AmbassadorStatus = "ACTIVE" | "PENDING" | "SUSPENDED";

type Ambassador = {
  ambassador_id: number;
  user_id: number;
  full_name: string;
  email: string;
  phone_number: string | null;
  college_name: string;
  graduation_year: number;
  status: AmbassadorStatus;
};

type SocialAccount = {
  account_id: number;
  platform: string;
  profile_handle: string;
  follower_count: number;
  verified: boolean;
  updated_at: string;
};

type Rating = {
  normalized_score: number;
  percentile_rank: number;
  star_rating: number;
  campaign_id: number;
  calculated_at: string;
} | null;

type Ranking = {
  current_rank: number | null;
  total_ranked: number;
};

type Submission = {
  post_id: number;
  campaign_id: number;
  campaign_title: string;
  platform: string;
  post_url: string;
  platform_post_id: string;
  published_at: string | null;
  is_verified: boolean;
  snapshot_id: number | null;
  fetched_at: string | null;
  reach_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  views_impressions: number;
};

type AmbassadorDetailResponse = {
  ambassador: Ambassador;
  social_accounts: SocialAccount[];
  metrics: {
    total_reach: number;
    total_engagements: number;
    engagement_rate: number;
  };
  rating: Rating;
  ranking: Ranking;
  submissions: Submission[];
};

type MetricForm = {
  reach_count: string;
  likes_count: string;
  comments_count: string;
  shares_count: string;
  saves_count: string;
  views_impressions: string;
};

function Stars({ count }: { count: number | null }) {
  if (!count) {
    return <span className="text-sm text-gray-600">Not rated</span>;
  }

  return (
    <span className="text-xl tracking-wider text-[#F0C568]">
      {"★".repeat(count)}
      <span className="text-gray-200">
        {"★".repeat(5 - count)}
      </span>
    </span>
  );
}

export default function AmbassadorDetailPage() {
  const params = useParams();
  const ambassadorId = Number(params.id);

  const [data, setData] =
    useState<AmbassadorDetailResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedPostId, setSelectedPostId] =
    useState<number | null>(null);

  const [metricForm, setMetricForm] = useState<MetricForm>({
    reach_count: "0",
    likes_count: "0",
    comments_count: "0",
    shares_count: "0",
    saves_count: "0",
    views_impressions: "0",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadAmbassador = useCallback(async () => {
    try {
      setLoading(true);

     const response = await authFetch(
  `http://127.0.0.1:8000/admin/ambassadors/${ambassadorId}`
);
      const result = await response.json();

      if (!response.ok) {
        setError(result.detail || "Failed to load ambassador.");
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
  }, [ambassadorId]);

  useEffect(() => {
    const storedUser = sessionStorage.getItem("cipd_user");

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

      queueMicrotask(() => loadAmbassador());
    } catch {
      sessionStorage.removeItem("cipd_user");
      window.location.replace("/login");
    }
  }, [loadAmbassador]);

  function openMetricForm(post: Submission) {
    setSelectedPostId(post.post_id);

    setMetricForm({
      reach_count: String(post.reach_count ?? 0),
      likes_count: String(post.likes_count ?? 0),
      comments_count: String(post.comments_count ?? 0),
      shares_count: String(post.shares_count ?? 0),
      saves_count: String(post.saves_count ?? 0),
      views_impressions: String(post.views_impressions ?? 0),
    });

    setMessage("");
  }

  async function verifyAndSaveMetrics(postId: number) {
    try {
      setSaving(true);
      setMessage("");
const response = await authFetch(
  `http://127.0.0.1:8000/admin/campaign-posts/${postId}/verify`,
  {
    method: "POST",
    body: JSON.stringify({
      reach_count: Number(metricForm.reach_count),
      likes_count: Number(metricForm.likes_count),
      comments_count: Number(metricForm.comments_count),
      shares_count: Number(metricForm.shares_count),
      saves_count: Number(metricForm.saves_count),
      views_impressions: Number(metricForm.views_impressions),
    }),
  }
);

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.detail || "Failed to save metrics.");
        return;
      }

      setMessage("Post verified and metrics saved. Open this campaign under Campaigns and click Recalculate Ratings to update performance and the leaderboard.");
      setSelectedPostId(null);

      await loadAmbassador();
    } catch {
      setMessage("Could not connect to the backend.");
    } finally {
      setSaving(false);
    }
  }

  function formatNumber(value: number) {
    return Number(value || 0).toLocaleString();
  }

  function formatDate(value: string | null) {
    if (!value) {
      return "—";
    }

    return new Date(value).toLocaleString();
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">
          Loading ambassador...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-semibold text-red-700">
            Could not load ambassador
          </p>

          <p className="mt-2 text-sm text-red-600">
            {error || "Ambassador not found."}
          </p>
        </div>
      </div>
    );
  }

  const {
    ambassador,
    social_accounts,
    metrics,
    rating,
    ranking,
    submissions,
  } = data;

  const initials = ambassador.full_name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isActive = ambassador.status === "ACTIVE";

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Back */}
      <div className="mb-6">
        <Link
          href="/admin/ambassadors"
          className="text-sm font-semibold text-[#9383D8]"
        >
          ← Back to ambassadors
        </Link>
      </div>

      {/* Header */}
      <section className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#202629] text-xl font-bold text-white">
            {initials}
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#9383D8]">
              Ambassador Profile
            </p>

            <h1 className="text-3xl font-bold text-[#202629]">
              {ambassador.full_name}
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              {ambassador.college_name} • Graduation{" "}
              {ambassador.graduation_year}
            </p>

            <p className="mt-1 text-sm text-gray-600">
              {ambassador.email}
            </p>
            {ambassador.phone_number && (
              <a
                href={`https://wa.me/${ambassador.phone_number.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm font-semibold text-[#238C89] underline"
              >
                {ambassador.phone_number} · Open WhatsApp
              </a>
            )}
          </div>
        </div>

        <span
          className={`w-fit rounded-full px-4 py-2 text-xs font-bold ${
            ambassador.status === "ACTIVE"
              ? "bg-green-50 text-green-700"
              : ambassador.status === "PENDING"
                ? "bg-yellow-50 text-yellow-700"
                : "bg-red-50 text-red-700"
          }`}
        >
          {ambassador.status}
        </span>
      </section>

      {/* Eligibility */}
      <section
        className={`mb-6 rounded-2xl border p-5 ${
          isActive
            ? "border-[#BDE3E0] bg-[#EDF8F7]"
            : "border-[#F1D9A7] bg-[#FFF9EC]"
        }`}
      >
        <p className="font-semibold text-[#202629]">
          {isActive
            ? "Active Campus Ambassador"
            : "Not currently an active Campus Ambassador"}
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          {isActive
            ? "This ambassador has at least one verified social account and is eligible for campaign scoring."
            : "This ambassador does not currently have a verified social account and is excluded from scoring and rankings."}
        </p>
      </section>

      {/* Real performance */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [
            "Total Reach",
            formatNumber(metrics.total_reach),
            "#54B9B4",
          ],
          [
            "Engagement",
            `${metrics.engagement_rate}%`,
            "#9383D8",
          ],
          [
            "Normalized Score",
            rating
              ? Number(rating.normalized_score).toFixed(2)
              : "—",
            "#E98AAE",
          ],
          [
            "Percentile",
            rating
              ? `${Number(rating.percentile_rank).toFixed(2)}%`
              : "—",
            "#F0C568",
          ],
          [
            "Rank",
            ranking.current_rank !== null
              ? `#${ranking.current_rank}`
              : "—",
            "#54B9B4",
          ],
        ].map(([label, value, color]) => (
          <div
            key={label}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div
              className="mb-5 h-1.5 w-10 rounded-full"
              style={{ backgroundColor: color }}
            />

            <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              {label}
            </p>

            <p className="mt-3 text-2xl font-bold text-[#202629]">
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Profile */}
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold text-[#202629]">
            Profile information
          </h2>

          <div className="mt-6 space-y-5">
            {[
              ["Full name", ambassador.full_name],
              ["Email", ambassador.email],
              ["Mobile", ambassador.phone_number || "Not provided"],
              ["College", ambassador.college_name],
              [
                "Graduation year",
                String(ambassador.graduation_year),
              ],
              ["Status", ambassador.status],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-gray-100 pb-4"
              >
                <span className="text-sm text-gray-600">
                  {label}
                </span>

                <span className="text-sm font-semibold text-[#202629]">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Social */}
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold text-[#202629]">
            Connected social accounts
          </h2>

          {social_accounts.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-[#F8FAFA] p-6">
              <p className="font-semibold text-[#202629]">
                No connected accounts
              </p>

              <p className="mt-2 text-sm text-gray-500">
                This ambassador has not connected a social account.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {social_accounts.map((account) => (
                <div
                  key={account.account_id}
                  className="rounded-xl bg-[#F8FAFA] p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-[#202629]">
                        {account.platform}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {account.profile_handle}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        account.verified
                          ? "bg-green-50 text-green-700"
                          : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      {account.verified
                        ? "VERIFIED"
                        : "PENDING"}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">
                        Followers
                      </p>

                      <p className="mt-1 font-semibold text-[#202629]">
                        {formatNumber(account.follower_count)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600">
                        Last updated
                      </p>

                      <p className="mt-1 text-sm font-semibold text-[#202629]">
                        {formatDate(account.updated_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Rating */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">
          Current Award
        </p>

        <div className="mt-3">
          <Stars count={rating?.star_rating ?? null} />
        </div>

        {!rating && (
          <p className="mt-2 text-sm text-gray-600">
            No rating has been calculated yet.
          </p>
        )}
      </section>

      {/* Real submissions */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-7">
          <h2 className="text-xl font-bold text-[#202629]">
            Campaign submissions
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Review submitted social posts and record verified metrics.
          </p>
        </div>

        {submissions.length === 0 ? (
          <div className="p-8">
            <p className="text-sm text-gray-500">
              This ambassador has not submitted any campaign posts.
            </p>
          </div>
        ) : (
          <div className="space-y-5 p-6">
            {submissions.map((post) => (
              <div
                key={post.post_id}
                className="rounded-2xl border border-gray-200 p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#9383D8]">
                      {post.campaign_title}
                    </p>

                    <h3 className="mt-2 font-bold text-[#202629]">
                      {post.platform}
                    </h3>

                    <a
                      href={post.post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block break-all text-sm font-medium text-[#238C89]"
                    >
                      {post.post_url}
                    </a>

                    <p className="mt-2 text-xs text-gray-600">
                      Submitted: {formatDate(post.published_at)}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                      post.is_verified
                        ? "bg-green-50 text-green-700"
                        : "bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    {post.is_verified
                      ? "VERIFIED"
                      : "PENDING"}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    ["Reach", post.reach_count],
                    ["Likes", post.likes_count],
                    ["Comments", post.comments_count],
                    ["Shares", post.shares_count],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl bg-[#F8FAFA] p-4"
                    >
                      <p className="text-xs text-gray-600">
                        {label}
                      </p>

                      <p className="mt-1 font-bold text-[#202629]">
                        {formatNumber(Number(value))}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => openMetricForm(post)}
                  className="mt-5 rounded-xl bg-[#202629] px-5 py-3 text-sm font-semibold text-white"
                >
                  {post.is_verified
                    ? "Update Metrics"
                    : "Verify & Add Metrics"}
                </button>

                {selectedPostId === post.post_id && (
                  <div className="mt-5 rounded-xl border border-[#E5DFF6] bg-[#F8F6FC] p-5">
                    <h4 className="font-bold text-[#202629]">
                      Metric verification
                    </h4>

                    <p className="mt-1 text-sm text-gray-500">
                      Enter the latest verified cumulative metrics for this post.
                    </p>

                    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        ["Reach", "reach_count"],
                        ["Likes", "likes_count"],
                        ["Comments", "comments_count"],
                        ["Shares", "shares_count"],
                        ["Saves", "saves_count"],
                        ["Views / Impressions", "views_impressions"],
                      ].map(([label, key]) => (
                        <div key={key}>
                          <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                            {label}
                          </label>

                          <input
                            type="number"
                            min="0"
                            value={
                              metricForm[
                                key as keyof MetricForm
                              ]
                            }
                            onChange={(e) =>
                              setMetricForm((current) => ({
                                ...current,
                                [key]: e.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#9383D8]"
                          />
                        </div>
                      ))}
                    </div>

                    {message && (
                      <p className="mt-4 text-sm font-medium text-[#238C89]">
                        {message}
                      </p>
                    )}

                    <div className="mt-5 flex gap-3">
                      <button
                        onClick={() =>
                          verifyAndSaveMetrics(post.post_id)
                        }
                        disabled={saving}
                        className="rounded-xl bg-[#9383D8] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {saving
                          ? "Saving..."
                          : "Verify & Save Metrics"}
                      </button>

                      <button
                        onClick={() =>
                          setSelectedPostId(null)
                        }
                        className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-[#E5DFF6] bg-[#F6F3FC] p-6">
        <p className="font-semibold text-[#202629]">
          Metric history
        </p>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-500">
          Each verification saves a new metric snapshot. Dashboard calculations
          use the latest snapshot for each post, so previous snapshots remain in
          PostgreSQL without being double-counted.
        </p>
      </section>
    </div>
  );
}
