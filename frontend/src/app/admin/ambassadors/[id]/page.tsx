"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

type AmbassadorDetail = {
  id: string;
  name: string;
  initials: string;
  email: string;
  college: string;
  graduationYear: string;
  city: string;
  status: "ACTIVE" | "PENDING" | "SUSPENDED";
  socialAccounts: {
    platform: string;
    username: string;
    followers: string;
    verified: boolean;
    lastSync: string;
  }[];
  reach: string;
  engagement: string;
  score: string;
  percentile: string;
  rank: string;
  stars: number;
};

const ambassadorData: Record<string, AmbassadorDetail> = {
  "1": {
    id: "1",
    name: "Riya Sharma",
    initials: "RS",
    email: "riya@example.com",
    college: "IIT Delhi",
    graduationYear: "2027",
    city: "New Delhi",
    status: "ACTIVE",
    socialAccounts: [
      {
        platform: "Instagram",
        username: "@riya.builds",
        followers: "12,480",
        verified: true,
        lastSync: "3 minutes ago",
      },
    ],
    reach: "83.2K",
    engagement: "11.2%",
    score: "96.3",
    percentile: "99th",
    rank: "#1",
    stars: 5,
  },

  "4": {
    id: "4",
    name: "Aarav Mehta",
    initials: "AM",
    email: "aarav@iiitd.ac.in",
    college: "IIIT Delhi",
    graduationYear: "2027",
    city: "New Delhi",
    status: "ACTIVE",
    socialAccounts: [
      {
        platform: "Instagram",
        username: "@aarav.builds",
        followers: "4,823",
        verified: true,
        lastSync: "5 minutes ago",
      },
    ],
    reach: "42.8K",
    engagement: "8.4%",
    score: "82.6",
    percentile: "87th",
    rank: "#7",
    stars: 4,
  },

  "5": {
    id: "5",
    name: "Kabir Rao",
    initials: "KR",
    email: "kabir@example.com",
    college: "NSUT",
    graduationYear: "2027",
    city: "New Delhi",
    status: "PENDING",
    socialAccounts: [],
    reach: "—",
    engagement: "—",
    score: "—",
    percentile: "—",
    rank: "—",
    stars: 0,
  },
};

function Stars({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-gray-300">Not rated</span>;
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
  const id = String(params.id);

  const ambassador =
    ambassadorData[id] ?? ambassadorData["4"];

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
            {ambassador.initials}
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#9383D8]">
              Ambassador Profile
            </p>

            <h1 className="text-3xl font-bold text-[#202629]">
              {ambassador.name}
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              {ambassador.college} • Graduation {ambassador.graduationYear}
            </p>

            <p className="mt-1 text-sm text-gray-400">
              {ambassador.email}
            </p>
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

      {/* Active / pending explanation */}
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
            ? "This user has at least one verified social account and can participate in engagement-based campaign scoring."
            : "This user is registered but has no verified social account. They are excluded from active ambassador counts, normalization, leaderboard ranking and star allocation."}
        </p>
      </section>

      {/* Performance Cards */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">

        {[
          ["Total Reach", ambassador.reach, "#54B9B4"],
          ["Engagement", ambassador.engagement, "#9383D8"],
          ["Normalized Score", ambassador.score, "#E98AAE"],
          ["Percentile", ambassador.percentile, "#F0C568"],
          ["Rank", ambassador.rank, "#54B9B4"],
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

            <p className="mt-3 text-2xl font-bold text-[#202629]">
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">

        {/* Profile info */}
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold text-[#202629]">
            Profile information
          </h2>

          <div className="mt-6 space-y-5">
            {[
              ["Full name", ambassador.name],
              ["Email", ambassador.email],
              ["College", ambassador.college],
              ["Graduation year", ambassador.graduationYear],
              ["City", ambassador.city],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-gray-100 pb-4"
              >
                <span className="text-sm text-gray-400">
                  {label}
                </span>

                <span className="text-sm font-semibold text-[#202629]">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Social accounts */}
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold text-[#202629]">
            Connected social accounts
          </h2>

          {ambassador.socialAccounts.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-[#F8FAFA] p-6">
              <p className="font-semibold text-[#202629]">
                No verified account
              </p>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                This registered user cannot yet be counted as an active
                Campus Ambassador.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {ambassador.socialAccounts.map((account) => (
                <div
                  key={account.platform}
                  className="rounded-xl bg-[#F8FAFA] p-5"
                >
                  <div className="flex items-center justify-between">

                    <div>
                      <p className="font-bold text-[#202629]">
                        {account.platform}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {account.username}
                      </p>
                    </div>

                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      VERIFIED
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400">
                        Followers
                      </p>

                      <p className="mt-1 font-semibold text-[#202629]">
                        {account.followers}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400">
                        Last sync
                      </p>

                      <p className="mt-1 font-semibold text-[#202629]">
                        {account.lastSync}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Rating Evidence */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Current Award
            </p>

            <div className="mt-3 flex items-center gap-4">
              <Stars count={ambassador.stars} />

              {ambassador.stars > 0 && (
                <span className="rounded-full bg-[#DDF3F1] px-3 py-1 text-xs font-bold text-[#238C89]">
                  {ambassador.stars} STAR
                </span>
              )}
            </div>
          </div>

          {isActive && (
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
              <div>
                <p className="text-xs text-gray-400">
                  Score
                </p>

                <p className="mt-1 font-bold text-[#202629]">
                  {ambassador.score}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400">
                  Percentile
                </p>

                <p className="mt-1 font-bold text-[#202629]">
                  {ambassador.percentile}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400">
                  Rank
                </p>

                <p className="mt-1 font-bold text-[#202629]">
                  {ambassador.rank}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Recent submissions */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-7">
          <h2 className="text-xl font-bold text-[#202629]">
            Campaign submissions
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Recent verified campaign activity
          </p>
        </div>

        {!isActive ? (
          <div className="p-8">
            <p className="text-sm text-gray-500">
              No eligible campaign activity is available.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="bg-[#F8FAFA] text-left">
                  {[
                    "Campaign",
                    "Platform",
                    "Reach",
                    "Likes",
                    "Comments",
                    "Score",
                    "Status",
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
                <tr className="border-t border-gray-100">
                  <td className="px-6 py-5 font-semibold text-[#202629]">
                    AI Awareness Week
                  </td>

                  <td className="px-6 py-5 text-sm text-gray-500">
                    Instagram
                  </td>

                  <td className="px-6 py-5 font-semibold">
                    12,481
                  </td>

                  <td className="px-6 py-5">
                    934
                  </td>

                  <td className="px-6 py-5">
                    74
                  </td>

                  <td className="px-6 py-5 font-bold text-[#238C89]">
                    86.4
                  </td>

                  <td className="px-6 py-5">
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      VERIFIED
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Methodology */}
      <section className="mt-6 rounded-2xl border border-[#E5DFF6] bg-[#F6F3FC] p-6">
        <p className="font-semibold text-[#202629]">
          Award evidence
        </p>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-500">
          In the final system, this screen will display the exact metric
          snapshots, normalized values and scoring calculation used to produce
          the ambassador&apos;s percentile and star rating. This provides an
          auditable explanation for every award.
        </p>
      </section>
    </div>
  );
}