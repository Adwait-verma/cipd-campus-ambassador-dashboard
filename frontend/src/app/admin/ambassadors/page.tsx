"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AmbassadorStatus = "ACTIVE" | "PENDING" | "SUSPENDED";

type Ambassador = {
  id: number;
  name: string;
  email: string;
  college: string;
  platform: string;
  reach: string;
  score: string;
  stars: number;
  status: AmbassadorStatus;
};

const ambassadors: Ambassador[] = [
  {
    id: 1,
    name: "Riya Sharma",
    email: "riya@example.com",
    college: "IIT Delhi",
    platform: "Instagram",
    reach: "83.2K",
    score: "96.3",
    stars: 5,
    status: "ACTIVE",
  },
  {
    id: 2,
    name: "Aman Gupta",
    email: "aman@example.com",
    college: "IIIT Delhi",
    platform: "Instagram",
    reach: "71.8K",
    score: "93.1",
    stars: 5,
    status: "ACTIVE",
  },
  {
    id: 3,
    name: "Sara Khan",
    email: "sara@example.com",
    college: "DTU",
    platform: "LinkedIn",
    reach: "69.3K",
    score: "91.8",
    stars: 5,
    status: "ACTIVE",
  },
  {
    id: 4,
    name: "Aarav Mehta",
    email: "aarav@iiitd.ac.in",
    college: "IIIT Delhi",
    platform: "Instagram",
    reach: "42.8K",
    score: "82.6",
    stars: 4,
    status: "ACTIVE",
  },
  {
    id: 5,
    name: "Kabir Rao",
    email: "kabir@example.com",
    college: "NSUT",
    platform: "—",
    reach: "—",
    score: "—",
    stars: 0,
    status: "PENDING",
  },
  {
    id: 6,
    name: "Neha Jain",
    email: "neha@example.com",
    college: "BITS Pilani",
    platform: "Instagram",
    reach: "12.6K",
    score: "55.8",
    stars: 3,
    status: "ACTIVE",
  },
  {
    id: 7,
    name: "Dev Malhotra",
    email: "dev@example.com",
    college: "DTU",
    platform: "—",
    reach: "—",
    score: "—",
    stars: 0,
    status: "SUSPENDED",
  },
];

function Stars({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-gray-300">—</span>;
  }

  return (
    <span className="tracking-wider text-[#F0C568]">
      {"★".repeat(count)}
      <span className="text-gray-200">{"★".repeat(5 - count)}</span>
    </span>
  );
}

export default function AdminAmbassadorsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return ambassadors.filter((ambassador) => {
      const matchesSearch =
        ambassador.name.toLowerCase().includes(search.toLowerCase()) ||
        ambassador.college.toLowerCase().includes(search.toLowerCase()) ||
        ambassador.email.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || ambassador.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-[#9383D8]">
            AMBASSADORS
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#202629]">
            Ambassador management
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Review registered users, identify active Campus Ambassadors and
            inspect eligibility for engagement-based scoring.
          </p>
        </div>

        <button className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-[#202629] shadow-sm transition hover:bg-gray-50">
          Export CSV
        </button>
      </section>

      {/* Rule */}
      <section className="mb-6 rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-5">
        <p className="font-semibold text-[#202629]">
          Active Ambassador rule
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Only registered users with at least one verified connected social
          account are counted as active Campus Ambassadors. Pending users are
          excluded from engagement totals, normalization, leaderboard ranking
          and star allocation.
        </p>
      </section>

      {/* Filters */}
      <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, college or email..."
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#9383D8] md:max-w-md"
        />

        <div className="flex flex-wrap gap-3">
          {["ALL", "ACTIVE", "PENDING", "SUSPENDED"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                statusFilter === status
                  ? "bg-[#202629] text-white"
                  : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {status === "ALL"
                ? "All"
                : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F8FAFA] text-left">
                {[
                  "Ambassador",
                  "College",
                  "Social",
                  "Reach",
                  "Score",
                  "Rating",
                  "Status",
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
              {filtered.map((ambassador) => (
                <tr
                  key={ambassador.id}
                  className="border-b border-gray-100 transition hover:bg-gray-50"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#202629] text-xs font-bold text-white">
                        {ambassador.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </div>

                      <div>
                        <p className="font-semibold text-[#202629]">
                          {ambassador.name}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          {ambassador.email}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-5 text-sm text-gray-500">
                    {ambassador.college}
                  </td>

                  <td className="px-6 py-5">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        ambassador.platform === "—"
                          ? "bg-gray-100 text-gray-500"
                          : "bg-[#DDF3F1] text-[#238C89]"
                      }`}
                    >
                      {ambassador.platform}
                    </span>
                  </td>

                  <td className="px-6 py-5 font-semibold text-[#202629]">
                    {ambassador.reach}
                  </td>

                  <td className="px-6 py-5">
                    {ambassador.score === "—" ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <span className="rounded-lg bg-[#F8FAFA] px-3 py-2 text-sm font-bold text-[#202629]">
                        {ambassador.score}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-5">
                    <Stars count={ambassador.stars} />
                  </td>

                  <td className="px-6 py-5">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        ambassador.status === "ACTIVE"
                          ? "bg-green-50 text-green-700"
                          : ambassador.status === "PENDING"
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-red-50 text-red-700"
                      }`}
                    >
                      {ambassador.status}
                    </span>
                  </td>

                  <td className="px-6 py-5 text-right">
                    <Link
                      href={`/admin/ambassadors/${ambassador.id}`}
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

        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <p className="font-semibold text-[#202629]">
              No ambassadors found
            </p>

            <p className="mt-2 text-sm text-gray-400">
              Try changing the search or status filter.
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Prototype note
        </p>

        <p className="mt-3 text-sm leading-6 text-gray-500">
          This table currently uses mock values. The final implementation will
          derive ambassador status from PostgreSQL social-account verification
          and retrieve metrics, scores and star ratings through FastAPI.
        </p>
      </section>
    </div>
  );
}