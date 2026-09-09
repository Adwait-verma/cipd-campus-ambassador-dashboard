"use client";

import { authFetch } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type LoggedInUser = {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
};

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

type Submission = {
  post_id: number;
  platform: string;
  post_url: string;
  platform_post_id: string | null;
  published_at: string | null;
  is_verified: boolean;
  reach_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  fetched_at: string | null;
};

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = Number(params.id);

  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);

  const [platform, setPlatform] =
    useState<"INSTAGRAM" | "LINKEDIN">("INSTAGRAM");

  const [postUrl, setPostUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("cipd_user");

    if (!storedUser) {
      window.location.href = "/login";
      return;
    }

    try {
      const parsedUser: LoggedInUser = JSON.parse(storedUser);

      if (parsedUser.role !== "AMBASSADOR") {
        window.location.href = "/login";
        return;
      }

      queueMicrotask(() => setUser(parsedUser));
      loadPage(parsedUser.user_id);
    } catch {
      localStorage.removeItem("cipd_user");
      window.location.href = "/login";
    }
  }, [campaignId]);

  async function loadPage(userId: number) {
    try {
      setLoading(true);

      const campaignResponse = await authFetch(
        `https://scaling-carnival-7v7pjrpwwxx92pg54-8000.app.github.dev/ambassador/campaigns/${campaignId}`
      );

      const campaignData = await campaignResponse.json();

      if (!campaignResponse.ok) {
        setError(campaignData.detail || "Failed to load campaign.");
        return;
      }

      setCampaign(campaignData.campaign);

      const submissionResponse = await authFetch(
        `https://scaling-carnival-7v7pjrpwwxx92pg54-8000.app.github.dev/ambassador/campaigns/${campaignId}/submission/${userId}`
      );

      const submissionData = await submissionResponse.json();

      if (submissionResponse.ok) {
        setSubmission(submissionData.submission);
      }
    } catch {
      setError(
        "Could not connect to the backend. Make sure FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!user || !postUrl.trim()) {
      setMessage("Enter a social post URL first.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      const response = await authFetch(
        "https://scaling-carnival-7v7pjrpwwxx92pg54-8000.app.github.dev/ambassador/campaign-posts",
        {
          method: "POST",
          body: JSON.stringify({
            user_id: user.user_id,
            campaign_id: campaignId,
            platform,
            post_url: postUrl.trim(),
            platform_post_id: null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Submission failed.");
        return;
      }

      setMessage(
        "Post submitted successfully. It is now waiting for verification and metric collection."
      );

      setPostUrl("");

      await loadPage(user.user_id);
    } catch {
      setMessage("Could not connect to the backend.");
    } finally {
      setSubmitting(false);
    }
  }

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
        <p className="text-sm text-gray-500">Loading campaign...</p>
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

  const canSubmit = campaign.status === "ACTIVE";

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-6">
        <Link
          href="/ambassador/campaigns"
          className="text-sm font-semibold text-[#238C89]"
        >
          ← Back to campaigns
        </Link>
      </div>

      <section className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-[#238C89]">
            CAMPAIGN DETAILS
          </p>

          <h1 className="text-3xl font-bold text-[#202629]">
            {campaign.title}
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-500">
            {campaign.description || "No campaign description provided."}
          </p>
        </div>

        <span
          className={`w-fit rounded-full px-4 py-2 text-xs font-bold ${
            campaign.status === "ACTIVE"
              ? "bg-[#DDF3F1] text-[#238C89]"
              : campaign.status === "UPCOMING"
                ? "bg-[#EEEAFB] text-[#6E5DB7]"
                : "bg-gray-100 text-gray-500"
          }`}
        >
          {campaign.status}
        </span>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-bold text-[#202629]">
              Campaign brief
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
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

            <div className="mt-6 rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Official CiPD content
              </p>

              <p className="mt-3 text-sm text-gray-500">
                Review the official campaign content before sharing your
                promotional post.
              </p>

              {campaign.target_url ? (
                <a
                  href={campaign.target_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block rounded-xl bg-[#202629] px-5 py-3 text-sm font-semibold text-white"
                >
                  Open official content ↗
                </a>
              ) : (
                <p className="mt-4 text-sm text-gray-400">
                  No official target URL has been added.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-bold text-[#202629]">
              Submit your social post
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Choose the platform and paste the URL of the post you published
              for this campaign.
            </p>

            {!canSubmit && (
              <div className="mt-5 rounded-xl bg-[#FFF8E8] p-4">
                <p className="text-sm font-semibold text-[#9A6A00]">
                  Submissions are only allowed while this campaign is active.
                </p>
              </div>
            )}

            <div className="mt-6">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Platform
              </label>

              <select
                value={platform}
                onChange={(e) =>
                  setPlatform(
                    e.target.value as "INSTAGRAM" | "LINKEDIN"
                  )
                }
                disabled={!canSubmit}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#54B9B4] disabled:bg-gray-100"
              >
                <option value="INSTAGRAM">Instagram</option>
                <option value="LINKEDIN">LinkedIn</option>
              </select>
            </div>

            <div className="mt-5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Social post URL
              </label>

              <input
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                disabled={!canSubmit}
                placeholder="https://instagram.com/reel/..."
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#54B9B4] disabled:bg-gray-100"
              />
            </div>

            {message && (
              <p className="mt-4 text-sm font-medium text-[#238C89]">
                {message}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="mt-5 rounded-xl bg-[#202629] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#343B3E] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit post"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9383D8]">
              Submission status
            </p>

            {!submission ? (
              <div className="mt-5">
                <p className="font-semibold text-[#202629]">
                  No post submitted yet
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Your submitted campaign post will appear here once it is
                  saved in the CiPD database.
                </p>
              </div>
            ) : (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[#202629]">
                    {submission.platform}
                  </p>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      submission.is_verified
                        ? "bg-green-50 text-green-700"
                        : "bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    {submission.is_verified ? "VERIFIED" : "PENDING"}
                  </span>
                </div>

                <a
                  href={submission.post_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block break-all text-xs font-medium text-[#238C89]"
                >
                  {submission.post_url}
                </a>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    ["Reach", submission.reach_count],
                    ["Likes", submission.likes_count],
                    ["Comments", submission.comments_count],
                    ["Shares", submission.shares_count],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl bg-[#F8FAFA] p-4"
                    >
                      <p className="text-xs text-gray-400">{label}</p>

                      <p className="mt-1 font-bold text-[#202629]">
                        {Number(value).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                {!submission.fetched_at && (
                  <div className="mt-4 rounded-xl bg-[#FFF8E8] p-4">
                    <p className="text-sm text-[#9A6A00]">
                      Metrics have not been collected for this post yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-5">
            <p className="font-semibold text-[#202629]">
              Scoring eligibility
            </p>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              A submitted post is stored immediately, but it only enters
              normalization after verification and valid social engagement
              metrics are collected.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
