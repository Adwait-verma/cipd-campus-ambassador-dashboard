"use client";

import { useState } from "react";

type AwardRow = {
  rank: number;
  name: string;
  college: string;
  score: number;
  percentile: number;
  stars: number;
  status: "ELIGIBLE" | "PENDING";
};

const rows: AwardRow[] = [
  {
    rank: 1,
    name: "Riya Sharma",
    college: "IIT Delhi",
    score: 96.3,
    percentile: 99,
    stars: 5,
    status: "ELIGIBLE",
  },
  {
    rank: 2,
    name: "Aman Gupta",
    college: "IIIT Delhi",
    score: 93.1,
    percentile: 97,
    stars: 5,
    status: "ELIGIBLE",
  },
  {
    rank: 3,
    name: "Sara Khan",
    college: "DTU",
    score: 91.8,
    percentile: 95,
    stars: 5,
    status: "ELIGIBLE",
  },
  {
    rank: 7,
    name: "Aarav Mehta",
    college: "IIIT Delhi",
    score: 82.6,
    percentile: 87,
    stars: 4,
    status: "ELIGIBLE",
  },
];

function Stars({ count }: { count: number }) {
  return (
    <span className="tracking-wider text-[#F0C568]">
      {"★".repeat(count)}
      <span className="text-gray-200">{"★".repeat(5 - count)}</span>
    </span>
  );
}

export default function AwardsPage() {
  const [frozen, setFrozen] = useState(false);

  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#9383D8]">
            Awards
          </p>

          <h1 className="text-3xl font-bold text-[#202629]">
            Final leaderboard & star awards
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Review normalized performance before finalizing CiPD Campus
            Ambassador awards.
          </p>
        </div>

        <button
          onClick={() => setFrozen(true)}
          disabled={frozen}
          className={`rounded-xl px-5 py-3 text-sm font-semibold text-white ${
            frozen
              ? "cursor-not-allowed bg-gray-400"
              : "bg-[#202629] hover:bg-[#343B3E]"
          }`}
        >
          {frozen ? "Awards finalized" : "Finalize awards"}
        </button>
      </section>

      <section
        className={`mb-6 rounded-2xl border p-5 ${
          frozen
            ? "border-green-200 bg-green-50"
            : "border-[#E5DFF6] bg-[#F6F3FC]"
        }`}
      >
        <p className="font-semibold text-[#202629]">
          {frozen ? "Leaderboard frozen" : "Leaderboard still editable"}
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          {frozen
            ? "The current ranking and star allocation have been finalized for this prototype."
            : "Review all eligible ambassadors and scoring evidence before finalizing awards."}
        </p>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-4">
        {[
          ["Scoring Eligible", "124", "#54B9B4"],
          ["5 Star", "18", "#F0C568"],
          ["4 Star", "46", "#9383D8"],
          ["3 Star", "60", "#E98AAE"],
        ].map(([label, value, color]) => (
          <div
            key={label}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
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
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-7">
          <h2 className="text-xl font-bold text-[#202629]">
            Final ranking
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Only scoring-eligible ambassadors are included.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-[#F8FAFA] text-left">
                {[
                  "Rank",
                  "Ambassador",
                  "College",
                  "Score",
                  "Percentile",
                  "Award",
                  "Eligibility",
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
              {rows.map((row) => (
                <tr
                  key={row.rank}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-6 py-5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F8FAFA] font-bold text-[#202629]">
                      {row.rank}
                    </div>
                  </td>

                  <td className="px-6 py-5 font-semibold text-[#202629]">
                    {row.name}
                  </td>

                  <td className="px-6 py-5 text-sm text-gray-500">
                    {row.college}
                  </td>

                  <td className="px-6 py-5 font-bold text-[#202629]">
                    {row.score}
                  </td>

                  <td className="px-6 py-5 text-sm text-gray-500">
                    {row.percentile}th
                  </td>

                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <Stars count={row.stars} />

                      <span className="rounded-full bg-[#DDF3F1] px-3 py-1 text-xs font-bold text-[#238C89]">
                        {row.stars} STAR
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      ELIGIBLE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-6">
        <p className="font-semibold text-[#202629]">
          Who is excluded?
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Registered users without a verified social account, suspended
          accounts, users without valid campaign submissions, and submissions
          without verified metrics must not enter the normalization cohort.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Prototype note
        </p>

        <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-500">
          Finalization currently changes frontend state only. Later this page
          will read calculated scores from FastAPI and write the finalized
          award state to PostgreSQL.
        </p>
      </section>
    </div>
  );
}