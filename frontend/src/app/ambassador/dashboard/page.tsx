const metrics = [
  {
    label: "Total Reach",
    value: "42.8K",
    change: "+12%",
    accent: "bg-[#54B9B4]",
  },
  {
    label: "Engagement Rate",
    value: "8.4%",
    change: "+1.6%",
    accent: "bg-[#9383D8]",
  },
  {
    label: "Published Posts",
    value: "12",
    change: "3 active",
    accent: "bg-[#E98AAE]",
  },
  {
    label: "Current Rank",
    value: "#7",
    change: "of 124",
    accent: "bg-[#F0C568]",
  },
];

export default function AmbassadorDashboard() {
  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Header */}
      <section className="mb-8 flex items-start justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-[#238C89]">
            AMBASSADOR DASHBOARD
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#202629]">
            Good afternoon, Aarav.
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Here&apos;s how your CiPD campaign performance is looking.
          </p>
        </div>

        {/* Rating */}
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Current rating
          </p>

          <div className="mt-2 flex items-center gap-3">
            <div className="text-xl tracking-wider text-[#F0C568]">
              ★★★★
              <span className="text-gray-200">★</span>
            </div>

            <span className="rounded-full bg-[#DDF3F1] px-3 py-1 text-xs font-bold text-[#238C89]">
              4 STAR
            </span>
          </div>
        </div>
      </section>

      {/* Metric cards */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className={`mb-5 h-1.5 w-10 rounded-full ${metric.accent}`} />

            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {metric.label}
            </p>

            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-bold text-[#202629]">
                {metric.value}
              </p>

              <span className="text-xs font-semibold text-[#238C89]">
                {metric.change}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Main analytics */}
      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        {/* Performance chart */}
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#202629]">
                Performance Trend
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Total engagement generated over the last 6 weeks
              </p>
            </div>

            <select className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 outline-none">
              <option>Last 6 weeks</option>
              <option>Last 3 months</option>
            </select>
          </div>

          {/* Temporary visual chart */}
          <div className="relative h-64 overflow-hidden rounded-xl bg-[#F8FAFA]">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-around px-6 py-6">
              {[1, 2, 3, 4, 5].map((line) => (
                <div
                  key={line}
                  className="border-t border-dashed border-gray-200"
                />
              ))}
            </div>

            {/* Fake chart bars */}
            <div className="absolute bottom-6 left-8 right-8 flex h-[75%] items-end justify-between gap-4">
              {[35, 49, 42, 65, 58, 82, 91].map((height, index) => (
                <div
                  key={index}
                  className="group flex h-full flex-1 items-end"
                >
                  <div
                    className="w-full rounded-t-lg bg-[#54B9B4] transition hover:bg-[#238C89]"
                    style={{ height: `${height}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-between px-3 text-xs text-gray-400">
            <span>Jul 14</span>
            <span>Jul 21</span>
            <span>Jul 28</span>
            <span>Aug 04</span>
            <span>Aug 11</span>
            <span>Aug 18</span>
            <span>Aug 25</span>
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {/* Campaign */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#238C89]">
                Active Campaign
              </p>

              <span className="rounded-full bg-[#DDF3F1] px-3 py-1 text-xs font-semibold text-[#238C89]">
                ACTIVE
              </span>
            </div>

            <h3 className="mt-5 text-xl font-bold text-[#202629]">
              AI Awareness Week
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Promote CiPD&apos;s latest AI research reel across your connected
              social platforms.
            </p>

            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
              <div>
                <p className="text-xs text-gray-400">Deadline</p>
                <p className="mt-1 text-sm font-semibold text-[#202629]">
                  September 5
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400">Posts due</p>
                <p className="mt-1 text-right text-sm font-semibold text-[#202629]">
                  2
                </p>
              </div>
            </div>

            <button className="mt-5 w-full rounded-xl bg-[#202629] py-3 text-sm font-semibold text-white transition hover:bg-[#343B3E]">
              View Campaign →
            </button>
          </div>

          {/* Submission */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9383D8]">
              Latest Submission
            </p>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#202629]">
                  Instagram Reel
                </h3>

                <p className="mt-1 text-xs text-gray-400">
                  AI Awareness Week
                </p>
              </div>

              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                VERIFIED
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#F8FAFA] p-3">
                <p className="text-xs text-gray-400">Reach</p>
                <p className="mt-1 font-bold text-[#202629]">12.4K</p>
              </div>

              <div className="rounded-xl bg-[#F8FAFA] p-3">
                <p className="text-xs text-gray-400">Score</p>
                <p className="mt-1 font-bold text-[#202629]">86.4</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Eligibility note */}
      <section className="mt-6 rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#54B9B4] font-bold text-white">
            ✓
          </div>

          <div>
            <p className="font-semibold text-[#202629]">
              You&apos;re an active CiPD Campus Ambassador
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Your Instagram account is connected and verified, so your
              campaign engagement is eligible for scoring and ranking.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}