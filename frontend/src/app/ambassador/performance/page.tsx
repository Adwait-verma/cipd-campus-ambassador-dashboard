const leaderboard = [
  {
    rank: 1,
    name: "Riya Sharma",
    college: "IIT Delhi",
    reach: "83.2K",
    score: "96.3",
    stars: 5,
  },
  {
    rank: 2,
    name: "Aman Gupta",
    college: "IIIT Delhi",
    reach: "71.8K",
    score: "93.1",
    stars: 5,
  },
  {
    rank: 3,
    name: "Sara Khan",
    college: "DTU",
    reach: "69.3K",
    score: "91.8",
    stars: 5,
  },
  {
    rank: 4,
    name: "Dev Mehta",
    college: "NSUT",
    reach: "58.6K",
    score: "87.2",
    stars: 4,
  },
  {
    rank: 7,
    name: "Aarav Mehta",
    college: "IIIT Delhi",
    reach: "42.8K",
    score: "82.6",
    stars: 4,
    currentUser: true,
  },
];

const scoringSteps = [
  {
    title: "Raw Metrics",
    description: "Reach, likes, comments, shares and views",
  },
  {
    title: "Engagement Rate",
    description: "Measures engagement relative to audience/reach",
  },
  {
    title: "Platform Normalization",
    description: "Makes performance comparable across social platforms",
  },
  {
    title: "Z-Score",
    description: "Measures performance relative to the comparison group",
  },
  {
    title: "Weighted Score",
    description: "Combines normalized performance components",
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
  return (
    <span className="tracking-wider text-[#F0C568]">
      {"★".repeat(count)}
      <span className="text-gray-200">{"★".repeat(5 - count)}</span>
    </span>
  );
}

export default function PerformancePage() {
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

      {/* Main score cards */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="rounded-2xl bg-[#202629] p-7 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#54B9B4]">
            Current Rating
          </p>

          <div className="mt-5 flex items-center gap-4">
            <p className="text-4xl font-bold">4 STAR</p>

            <Stars count={4} />
          </div>

          <p className="mt-5 text-sm leading-6 text-gray-300">
            Based on your current normalized campaign performance.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 h-1.5 w-10 rounded-full bg-[#54B9B4]" />

          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Normalized Score
          </p>

          <p className="mt-4 text-3xl font-bold text-[#202629]">82.6</p>

          <p className="mt-2 text-xs text-gray-400">
            Cross-platform performance
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 h-1.5 w-10 rounded-full bg-[#9383D8]" />

          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Percentile
          </p>

          <p className="mt-4 text-3xl font-bold text-[#202629]">87th</p>

          <p className="mt-2 text-xs text-gray-400">
            Among eligible ambassadors
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 h-1.5 w-10 rounded-full bg-[#E98AAE]" />

          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Current Rank
          </p>

          <p className="mt-4 text-3xl font-bold text-[#202629]">#7</p>

          <p className="mt-2 text-xs text-gray-400">of 124 ambassadors</p>
        </div>
      </section>

      {/* Scoring explanation */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
        <div className="mb-7">
          <h2 className="text-xl font-bold text-[#202629]">
            How is my rating calculated?
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Raw social metrics should not be compared directly across
            Instagram, LinkedIn or other platforms. The system first
            transforms them into comparable performance measures before
            allocating a star rating.
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

      {/* Eligibility rule */}
      <section className="mt-6 rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#54B9B4] font-bold text-white">
            ✓
          </div>

          <div>
            <p className="font-semibold text-[#202629]">
              You are currently scoring-eligible
            </p>

            <p className="mt-1 text-sm leading-6 text-gray-500">
              Only registered users with at least one verified connected
              social account and valid campaign engagement data enter the
              normalization cohort and leaderboard.
            </p>
          </div>
        </div>
      </section>

      {/* Leaderboard */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-7 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#202629]">
              Ambassador Leaderboard
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Current normalized performance ranking
            </p>
          </div>

          <div className="flex gap-3">
            <select className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 outline-none">
              <option>All Colleges</option>
              <option>IIIT Delhi</option>
              <option>IIT Delhi</option>
              <option>DTU</option>
              <option>NSUT</option>
            </select>

            <select className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 outline-none">
              <option>Overall</option>
              <option>Instagram</option>
              <option>LinkedIn</option>
            </select>
          </div>
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
                  Rating
                </th>
              </tr>
            </thead>

            <tbody>
              {leaderboard.map((ambassador) => (
                <tr
                  key={ambassador.rank}
                  className={`border-b border-gray-100 transition hover:bg-gray-50 ${
                    ambassador.currentUser ? "bg-[#EDF8F7]" : ""
                  }`}
                >
                  <td className="px-7 py-5">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                        ambassador.rank === 1
                          ? "bg-[#FFF3D6] text-[#A87500]"
                          : ambassador.rank === 2
                            ? "bg-gray-100 text-gray-500"
                            : ambassador.rank === 3
                              ? "bg-[#F6E6DA] text-[#9B5B34]"
                              : "bg-[#F8FAFA] text-gray-500"
                      }`}
                    >
                      {ambassador.rank}
                    </div>
                  </td>

                  <td className="px-7 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#202629] text-xs font-bold text-white">
                        {ambassador.name
                          .split(" ")
                          .map((name) => name[0])
                          .join("")
                          .slice(0, 2)}
                      </div>

                      <div>
                        <p className="font-semibold text-[#202629]">
                          {ambassador.name}
                        </p>

                        {ambassador.currentUser && (
                          <p className="mt-1 text-xs font-medium text-[#238C89]">
                            You
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-7 py-5 text-sm text-gray-500">
                    {ambassador.college}
                  </td>

                  <td className="px-7 py-5 font-semibold text-[#202629]">
                    {ambassador.reach}
                  </td>

                  <td className="px-7 py-5">
                    <span className="rounded-lg bg-[#F8FAFA] px-3 py-2 text-sm font-bold text-[#202629]">
                      {ambassador.score}
                    </span>
                  </td>

                  <td className="px-7 py-5">
                    <Stars count={ambassador.stars} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Methodology disclaimer */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Methodology note
        </p>

        <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-500">
          The values displayed on this prototype are mock values. The final
          implementation will calculate engagement rate, platform
          normalization, Z-scores, weighted scores, percentiles and star
          allocation in the FastAPI backend using validated campaign metric
          snapshots.
        </p>
      </section>
    </div>
  );
}