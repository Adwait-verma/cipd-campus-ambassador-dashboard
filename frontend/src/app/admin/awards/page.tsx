"use client";
import { authFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type AwardRow = {
  rank: number;
  ambassador_id: number;
  campaign_id: number;
  full_name: string;
  college_name: string;
  status: string;
  campaign_title: string;
  normalized_score: number;
  percentile_rank: number;
  star_rating: number;
  calculated_at: string;
};

type AwardsResponse = {
  summary: {
    scoring_eligible: number;
    five_star: number;
    four_star: number;
    three_star: number;
  };
  awards: AwardRow[];
};

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

export default function AwardsPage() {
  const [data, setData] =
    useState<AwardsResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAwards() {
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

       const response = await authFetch(
  "http://127.0.0.1:8000/admin/awards"
);

        const result = await response.json();

        if (!response.ok) {
          setError(
            result.detail || "Failed to load awards."
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

    loadAwards();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">
          Loading awards...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-semibold text-red-700">
            Could not load awards
          </p>

          <p className="mt-2 text-sm text-red-600">
            {error || "No award data available."}
          </p>
        </div>
      </div>
    );
  }

  const { summary, awards } = data;

  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#9383D8]">
          Awards
        </p>

        <h1 className="text-3xl font-bold text-[#202629]">
          Leaderboard & star awards
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
          Real calculated campaign ratings from verified ambassador
          performance.
        </p>
      </section>

      <section className="mb-6 rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-5">
        <p className="font-semibold text-[#202629]">
          Live calculated leaderboard
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          These results come directly from stored campaign ratings.
          Recalculating a campaign updates this page automatically.
        </p>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-4">
        {[
          [
            "Scoring Eligible",
            summary.scoring_eligible,
            "#54B9B4",
          ],
          [
            "5 Star",
            summary.five_star,
            "#F0C568",
          ],
          [
            "4 Star",
            summary.four_star,
            "#9383D8",
          ],
          [
            "3 Star",
            summary.three_star,
            "#E98AAE",
          ],
        ].map(([label, value, color]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div
              className="mb-5 h-1.5 w-10 rounded-full"
              style={{
                backgroundColor: String(color),
              }}
            />

            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {label}
            </p>

            <p className="mt-3 text-3xl font-bold text-[#202629]">
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-7">
          <h2 className="text-xl font-bold text-[#202629]">
            Current ranking
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Only ambassadors with calculated ratings are shown.
          </p>
        </div>

        {awards.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-semibold text-[#202629]">
              No ratings calculated yet
            </p>

            <p className="mt-2 text-sm text-gray-400">
              Open a campaign and calculate its ratings first.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead>
                <tr className="bg-[#F8FAFA] text-left">
                  {[
                    "Rank",
                    "Ambassador",
                    "College",
                    "Campaign",
                    "Score",
                    "Percentile",
                    "Award",
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
                {awards.map((row) => (
                  <tr
                    key={`${row.ambassador_id}-${row.campaign_id}`}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-6 py-5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F8FAFA] font-bold text-[#202629]">
                        {row.rank}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <p className="font-semibold text-[#202629]">
                        {row.full_name}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Ambassador #{row.ambassador_id}
                      </p>
                    </td>

                    <td className="px-6 py-5 text-sm text-gray-500">
                      {row.college_name}
                    </td>

                    <td className="px-6 py-5 text-sm font-semibold text-[#202629]">
                      {row.campaign_title}
                    </td>

                    <td className="px-6 py-5 font-bold text-[#202629]">
                      {Number(
                        row.normalized_score
                      ).toFixed(2)}
                    </td>

                    <td className="px-6 py-5 text-sm text-gray-500">
                      {Number(
                        row.percentile_rank
                      ).toFixed(2)}
                      %
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <Stars count={row.star_rating} />

                        <span className="rounded-full bg-[#DDF3F1] px-3 py-1 text-xs font-bold text-[#238C89]">
                          {row.star_rating} STAR
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <Link
                        href={`/admin/ambassadors/${row.ambassador_id}`}
                        className="text-sm font-semibold text-[#9383D8]"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-[#E5DFF6] bg-[#F6F3FC] p-6">
        <p className="font-semibold text-[#202629]">
          Eligibility rule
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Registered users without a verified social account,
          suspended ambassadors, unverified campaign posts and posts
          without metric snapshots are excluded before ratings are
          calculated.
        </p>
      </section>
    </div>
  );
}
