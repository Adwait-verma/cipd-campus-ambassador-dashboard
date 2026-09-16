"use client";
import { authFetch } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Campaign = {
  campaign_id: number;
  title: string;
  description: string | null;
  mandatory_hashtag: string | null;
  target_url: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  status: "ACTIVE" | "UPCOMING" | "COMPLETED";
};

type RatingResult = {
  ambassador_id: number;
  normalized_score: number;
  percentile_rank: number;
  star_rating: number;
  rank: number;
};

type RatingResponse = {
  message: string;
  campaign_id: number;
  rated_ambassadors: number;
  ratings: RatingResult[];
};

export default function AdminCampaignDetailPage() {
  const params = useParams();
  const campaignId = Number(params.id);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [ratingResult, setRatingResult] =
    useState<RatingResponse | null>(null);

  async function loadCampaign() {
    try {
      setLoading(true);

      const response = await authFetch(
        `http://127.0.0.1:8000/admin/campaigns/${campaignId}`
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Failed to load campaign.");
        return;
      }

      setCampaign(data.campaign ?? data);
    } catch {
      setError(
        "Could not connect to the backend. Make sure FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const storedUser = sessionStorage.getItem("cipd_user");

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

      queueMicrotask(() => loadCampaign());
    } catch {
      sessionStorage.removeItem("cipd_user");
      window.location.href = "/login";
    }
  }, [campaignId]);

  async function calculateRatings() {
    try {
      setCalculating(true);
      setMessage("");
      setRatingResult(null);

      const response = await authFetch(
  `http://127.0.0.1:8000/admin/campaigns/${campaignId}/calculate-ratings`,
  {
    method: "POST",
  }
);
      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail || "Failed to calculate campaign ratings."
        );
        return;
      }

      setRatingResult(data);
      setMessage("Campaign ratings recalculated successfully.");
    } catch {
      setMessage("Could not connect to the backend.");
    } finally {
      setCalculating(false);
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString();
  }

  function Stars({ count }: { count: number }) {
    return (
      <span className="tracking-wider text-[#F0C568]">
        {"★".repeat(count)}
        <span className="text-gray-200">
          {"★".repeat(5 - count)}
        </span>
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">
          Loading campaign...
        </p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-semibold text-red-700">
            Could not load campaign
          </p>

          <p className="mt-2 text-sm text-red-600">
            {error || "Campaign not found."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6">
        <Link
          href="/admin/campaigns"
          className="text-sm font-semibold text-[#9383D8]"
        >
          ← Back to campaigns
        </Link>
      </div>

      <section className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#9383D8]">
            Campaign Management
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#202629]">
            {campaign.title}
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-500">
            {campaign.description || "No description provided."}
          </p>
        </div>

        <span
          className={`w-fit rounded-full px-4 py-2 text-xs font-bold ${
            campaign.status === "ACTIVE"
              ? "bg-green-50 text-green-700"
              : campaign.status === "UPCOMING"
                ? "bg-blue-50 text-blue-700"
                : "bg-gray-100 text-gray-600"
          }`}
        >
          {campaign.status}
        </span>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Start Date
          </p>

          <p className="mt-3 text-lg font-bold text-[#202629]">
            {formatDate(campaign.start_date)}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            End Date
          </p>

          <p className="mt-3 text-lg font-bold text-[#202629]">
            {formatDate(campaign.end_date)}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Hashtag
          </p>

          <p className="mt-3 text-lg font-bold text-[#202629]">
            {campaign.mandatory_hashtag || "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Campaign ID
          </p>

          <p className="mt-3 text-lg font-bold text-[#202629]">
            #{campaign.campaign_id}
          </p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold text-[#202629]">
            Campaign details
          </h2>

          <div className="mt-6 space-y-5">
            <div className="border-b border-gray-100 pb-4">
              <p className="text-xs uppercase tracking-wider text-gray-400">
                Description
              </p>

              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                {campaign.description || "No description provided."}
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <p className="text-xs uppercase tracking-wider text-gray-400">
                Mandatory hashtag
              </p>

              <p className="mt-2 font-semibold text-[#202629]">
                {campaign.mandatory_hashtag || "—"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-gray-400">
                Target URL
              </p>

              {campaign.target_url ? (
                <a
                  href={campaign.target_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block break-all text-sm font-semibold text-[#238C89]"
                >
                  {campaign.target_url}
                </a>
              ) : (
                <p className="mt-2 text-sm text-gray-400">
                  No target URL
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E5DFF6] bg-[#F8F6FC] p-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9383D8]">
            Rating Engine
          </p>

          <h2 className="mt-2 text-xl font-bold text-[#202629]">
            Recalculate campaign ratings
          </h2>

          <p className="mt-3 text-sm leading-6 text-gray-500">
            This recalculates normalized scores, percentile ranks and star
            ratings for eligible ambassadors using their latest verified
            campaign metrics. Saving verified metrics does not run this step
            automatically. Recalculate after new submissions are verified or
            existing metrics change; ambassadors can then refresh their campaign
            page to see the updated status.
          </p>

          <button
            onClick={calculateRatings}
            disabled={calculating}
            className="mt-6 w-full rounded-xl bg-[#9383D8] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {calculating
              ? "Calculating..."
              : "Recalculate Ratings"}
          </button>

          {message && (
            <div
              className={`mt-4 rounded-xl border p-4 text-sm ${
                ratingResult
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </section>

      {ratingResult && (
        <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-7">
            <h2 className="text-xl font-bold text-[#202629]">
              Latest rating calculation
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              {ratingResult.rated_ambassadors} ambassador
              {ratingResult.rated_ambassadors === 1 ? "" : "s"} rated
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px]">
              <thead>
                <tr className="bg-[#F8FAFA] text-left">
                  {[
                    "Ambassador ID",
                    "Score",
                    "Percentile",
                    "Rank",
                    "Rating",
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
                {ratingResult.ratings.map((rating) => (
                  <tr
                    key={rating.ambassador_id}
                    className="border-t border-gray-100"
                  >
                    <td className="px-6 py-5 font-semibold text-[#202629]">
                      #{rating.ambassador_id}
                    </td>

                    <td className="px-6 py-5 font-bold text-[#202629]">
                      {Number(rating.normalized_score).toFixed(2)}
                    </td>

                    <td className="px-6 py-5">
                      {Number(rating.percentile_rank).toFixed(2)}%
                    </td>

                    <td className="px-6 py-5 font-bold text-[#238C89]">
                      #{rating.rank}
                    </td>

                    <td className="px-6 py-5">
                      <Stars count={rating.star_rating} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-6">
        <p className="font-semibold text-[#202629]">
          Current scoring flow
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Only active ambassadors with verified campaign posts and stored metric
          snapshots are included. The rating calculation currently normalizes
          performance within platform before generating a campaign-level score.
        </p>
      </section>
    </div>
  );
}
