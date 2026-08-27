"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

const campaignMap = {
  "1": {
    title: "AI Awareness Week",
    status: "ACTIVE",
    dates: "Aug 26 → Sep 05",
    hashtag: "#CiPDResearch",
    description:
      "Promote CiPD's latest AI research reel across your connected social platforms.",
    targetUrl: "https://cipd.iiitd.ac.in/",
  },
  "2": {
    title: "Product Nation Stories",
    status: "UPCOMING",
    dates: "Sep 02 → Sep 12",
    hashtag: "#ProductNation",
    description:
      "Share CiPD content highlighting Indian product innovation and entrepreneurship.",
    targetUrl: "https://cipd.iiitd.ac.in/",
  },
  "3": {
    title: "CiPD Research Showcase",
    status: "COMPLETED",
    dates: "Aug 10 → Aug 20",
    hashtag: "#CiPDInnovation",
    description:
      "Highlight selected CiPD research projects and student-led innovation.",
    targetUrl: "https://cipd.iiitd.ac.in/",
  },
};

export default function CampaignDetailPage() {
  const params = useParams();
  const id = String(params.id);

  const campaign =
    campaignMap[id as keyof typeof campaignMap] ?? campaignMap["1"];

  const [postUrl, setPostUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!postUrl.trim()) return;
    setSubmitted(true);
  }

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
            {campaign.description}
          </p>
        </div>

        <span className="w-fit rounded-full bg-[#DDF3F1] px-4 py-2 text-xs font-bold text-[#238C89]">
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
                  {campaign.dates}
                </p>
              </div>

              <div className="rounded-xl bg-[#F8FAFA] p-4">
                <p className="text-xs text-gray-400">Required hashtag</p>
                <p className="mt-1 text-sm font-semibold text-[#238C89]">
                  {campaign.hashtag}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Official CiPD content
              </p>

              <p className="mt-3 text-sm text-gray-500">
                Use the official campaign content before submitting your own
                promotional post.
              </p>

              <a
                href={campaign.targetUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block rounded-xl bg-[#202629] px-5 py-3 text-sm font-semibold text-white"
              >
                Open official content ↗
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-bold text-[#202629]">
              Submit your social post
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Paste the URL of the Instagram or LinkedIn post you used to
              promote this campaign.
            </p>

            <div className="mt-6">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Social post URL
              </label>

              <input
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder="https://instagram.com/reel/..."
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#54B9B4]"
              />
            </div>

            <button
              onClick={handleSubmit}
              className="mt-5 rounded-xl bg-[#202629] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#343B3E]"
            >
              Submit post
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9383D8]">
              Submission status
            </p>

            {!submitted ? (
              <div className="mt-5">
                <p className="font-semibold text-[#202629]">
                  No post submitted yet
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Submit a valid campaign post to become eligible for metric
                  verification.
                </p>
              </div>
            ) : (
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#202629]">
                    Instagram Reel
                  </p>

                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                    VERIFIED
                  </span>
                </div>

                <p className="mt-2 break-all text-xs text-gray-400">
                  {postUrl}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    ["Reach", "12,481"],
                    ["Likes", "934"],
                    ["Comments", "74"],
                    ["Shares", "91"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl bg-[#F8FAFA] p-4"
                    >
                      <p className="text-xs text-gray-400">{label}</p>

                      <p className="mt-1 font-bold text-[#202629]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl bg-[#EDF8F7] p-4">
                  <p className="text-xs text-gray-400">
                    Performance score
                  </p>

                  <p className="mt-1 text-2xl font-bold text-[#238C89]">
                    86.4
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-5">
            <p className="font-semibold text-[#202629]">
              Scoring eligibility
            </p>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              A campaign post enters normalization only after the social
              account is verified and valid engagement metrics are available.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}