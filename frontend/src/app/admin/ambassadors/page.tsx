"use client";
import { authFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AmbassadorStatus = "ACTIVE" | "PENDING" | "SUSPENDED";

type Ambassador = {
  ambassador_id: number;
  user_id: number;
  full_name: string;
  email: string;
  college_name: string;
  graduation_year: number;
  status: AmbassadorStatus;
  platforms: string;
  total_reach: number;
  normalized_score: number | null;
  star_rating: number | null;
};

function Stars({ count }: { count: number | null }) {
  if (!count) {
    return <span className="text-gray-300">—</span>;
  }

  return (
    <span className="tracking-wider text-[#F0C568]">
      {"★".repeat(count)}
      <span className="text-gray-200">
        {"★".repeat(5 - count)}
      </span>
    </span>
  );
}

export default function AdminAmbassadorsPage() {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAmbassadors() {
      const storedUser = localStorage.getItem("cipd_user");

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

        const response = await authFetch(
  "http://127.0.0.1:8000/admin/ambassadors"
);
        const data = await response.json();

        if (!response.ok) {
          setError(data.detail || "Failed to load ambassadors.");
          return;
        }

        setAmbassadors(data.ambassadors);
      } catch {
        setError(
          "Could not connect to the backend. Make sure FastAPI is running."
        );
      } finally {
        setLoading(false);
      }
    }

    loadAmbassadors();
  }, []);

  const filtered = useMemo(() => {
    return ambassadors.filter((ambassador) => {
      const searchValue = search.toLowerCase();

      const matchesSearch =
        ambassador.full_name.toLowerCase().includes(searchValue) ||
        ambassador.college_name.toLowerCase().includes(searchValue) ||
        ambassador.email.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "ALL" ||
        ambassador.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [ambassadors, search, statusFilter]);

  const activeCount = ambassadors.filter(
    (ambassador) => ambassador.status === "ACTIVE"
  ).length;

  const pendingCount = ambassadors.filter(
    (ambassador) => ambassador.status === "PENDING"
  ).length;

  function formatReach(reach: number) {
    if (reach >= 1_000_000) {
      return `${(reach / 1_000_000).toFixed(1)}M`;
    }

    if (reach >= 1_000) {
      return `${(reach / 1_000).toFixed(1)}K`;
    }

    return reach.toLocaleString();
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">
          Loading ambassadors...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-semibold text-red-700">
            Could not load ambassadors
          </p>

          <p className="mt-2 text-sm text-red-600">
            {error}
          </p>
        </div>
      </div>
    );
  }

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
            Review registered ambassadors, social-account eligibility,
            campaign reach, ratings and verification status.
          </p>
        </div>
      </section>

      {/* Real summary cards */}
      <section className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Total Registered
          </p>

          <p className="mt-3 text-3xl font-bold text-[#202629]">
            {ambassadors.length}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Active Ambassadors
          </p>

          <p className="mt-3 text-3xl font-bold text-[#238C89]">
            {activeCount}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Pending
          </p>

          <p className="mt-3 text-3xl font-bold text-[#C28A18]">
            {pendingCount}
          </p>
        </div>
      </section>

      {/* Rule */}
      <section className="mb-6 rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-5">
        <p className="font-semibold text-[#202629]">
          Active Ambassador rule
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          A registered user becomes an active Campus Ambassador only when at
          least one supported social account is connected and verified.
          Pending ambassadors are excluded from scoring, rankings and awards.
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
          {["ALL", "ACTIVE", "PENDING", "SUSPENDED"].map(
            (status) => (
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
                  : status.charAt(0) +
                    status.slice(1).toLowerCase()}
              </button>
            )
          )}
        </div>
      </section>

      {/* Real table */}
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
                  key={ambassador.ambassador_id}
                  className="border-b border-gray-100 transition hover:bg-gray-50"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#202629] text-xs font-bold text-white">
                        {ambassador.full_name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>

                      <div>
                        <p className="font-semibold text-[#202629]">
                          {ambassador.full_name}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          {ambassador.email}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <p className="text-sm text-gray-500">
                      {ambassador.college_name}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Graduation {ambassador.graduation_year}
                    </p>
                  </td>

                  <td className="px-6 py-5">
                    {ambassador.platforms ? (
                      <span className="rounded-full bg-[#DDF3F1] px-3 py-1 text-xs font-semibold text-[#238C89]">
                        {ambassador.platforms}
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                        Not connected
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-5 font-semibold text-[#202629]">
                    {formatReach(ambassador.total_reach)}
                  </td>

                  <td className="px-6 py-5">
                    {ambassador.normalized_score === null ? (
                      <span className="text-gray-300">
                        —
                      </span>
                    ) : (
                      <span className="rounded-lg bg-[#F8FAFA] px-3 py-2 text-sm font-bold text-[#202629]">
                        {Number(
                          ambassador.normalized_score
                        ).toFixed(2)}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-5">
                    <Stars count={ambassador.star_rating} />
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
                      href={`/admin/ambassadors/${ambassador.ambassador_id}`}
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
    </div>
  );
}