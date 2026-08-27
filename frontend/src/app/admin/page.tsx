const metrics = [
  {
    label: "Registered Users",
    value: "156",
    change: "+18 this month",
    accent: "bg-[#54B9B4]",
  },
  {
    label: "Active Ambassadors",
    value: "124",
    change: "Verified socials",
    accent: "bg-[#9383D8]",
  },
  {
    label: "Pending Connection",
    value: "32",
    change: "Not counted yet",
    accent: "bg-[#E98AAE]",
  },
  {
    label: "Active Campaigns",
    value: "4",
    change: "2 ending soon",
    accent: "bg-[#F0C568]",
  },
];

const attentionItems = [
  {
    value: "12",
    label: "Unverified campaign posts",
  },
  {
    value: "7",
    label: "Ambassadors missing required data",
  },
  {
    value: "3",
    label: "Campaigns closing this week",
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-[#9383D8]">
            ADMIN OVERVIEW
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#202629]">
            Campus Ambassador programme
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Monitor registrations, verified ambassadors, campaign activity,
            engagement and award readiness.
          </p>
        </div>

        <button className="rounded-xl bg-[#202629] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#343B3E]">
          + Create Campaign
        </button>
      </section>

      {/* Important rule */}
      <section className="mb-6 rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-5">
        <p className="font-semibold text-[#202629]">
          Active Ambassador definition
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Registered users are counted as active Campus Ambassadors only after
          at least one supported social account is connected and verified.
          Pending users are excluded from engagement normalization,
          leaderboard rankings and star allocation.
        </p>
      </section>

      {/* KPI cards */}
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

            <div className="mt-3">
              <p className="text-3xl font-bold text-[#202629]">
                {metric.value}
              </p>

              <p className="mt-2 text-xs font-medium text-gray-400">
                {metric.change}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* Analytics */}
      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#202629]">
              Overall engagement trend
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Aggregate engagement generated across active CiPD campaigns
            </p>
          </div>

          <div className="relative h-72 overflow-hidden rounded-xl bg-[#F8FAFA]">
            <div className="absolute inset-0 flex flex-col justify-around px-6 py-6">
              {[1, 2, 3, 4, 5].map((line) => (
                <div
                  key={line}
                  className="border-t border-dashed border-gray-200"
                />
              ))}
            </div>

            <div className="absolute bottom-7 left-8 right-8 flex h-[76%] items-end justify-between gap-5">
              {[40, 51, 47, 63, 72, 68, 88].map((height, index) => (
                <div
                  key={index}
                  className="flex h-full flex-1 items-end"
                >
                  <div
                    className="w-full rounded-t-lg bg-[#9383D8] transition hover:bg-[#7564BC]"
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

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#202629]">
              Needs attention
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Items requiring admin review
            </p>

            <div className="mt-6 space-y-4">
              {attentionItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-4 rounded-xl bg-[#F8FAFA] p-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F6EAF0] font-bold text-[#C95E85]">
                    {item.value}
                  </div>

                  <p className="text-sm leading-5 text-gray-500">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-[#202629] p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#54B9B4]">
              Total programme reach
            </p>

            <p className="mt-4 text-4xl font-bold">
              1.82M
            </p>

            <p className="mt-2 text-sm text-gray-300">
              From verified campaign posts
            </p>

            <div className="mt-5 border-t border-white/10 pt-5">
              <p className="text-xs text-gray-400">
                Verified posts
              </p>

              <p className="mt-1 text-xl font-bold">
                587
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent activity */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-7">
          <h2 className="text-xl font-bold text-[#202629]">
            Recent programme activity
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Current prototype activity feed
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {[
            [
              "Aarav Mehta",
              "submitted an Instagram Reel for AI Awareness Week",
              "5 min ago",
            ],
            [
              "Riya Sharma",
              "received a verified metric snapshot",
              "18 min ago",
            ],
            [
              "Kabir Rao",
              "registered but has not connected a social account",
              "43 min ago",
            ],
            [
              "CiPD Admin",
              "created Product Nation Stories campaign",
              "2 hours ago",
            ],
          ].map(([name, action, time]) => (
            <div
              key={`${name}-${time}`}
              className="flex items-center justify-between gap-5 px-7 py-5"
            >
              <div>
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-[#202629]">
                    {name}
                  </span>{" "}
                  {action}
                </p>
              </div>

              <span className="shrink-0 text-xs text-gray-400">
                {time}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Prototype note
        </p>

        <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-500">
          These values are mock frontend data. After the admin experience is
          complete, this page will be connected to FastAPI endpoints that
          calculate registration counts, active ambassadors, pending
          connections, campaign activity and verified engagement directly from
          PostgreSQL.
        </p>
      </section>
    </div>
  );
}