import Link from "next/link";

const steps = [
  {
    title: "Read your welcome email",
    body: "Use the admin-provided invite link to join the official WhatsApp group, then keep your name, college, graduation year, email and WhatsApp mobile number up to date.",
    href: "/ambassador/profile",
    action: "Open profile",
  },
  {
    title: "Connect a social account",
    body: "Add Instagram, LinkedIn or X/Twitter. At least one account must be verified before you become ACTIVE and enter scoring.",
    href: "/ambassador/social-accounts",
    action: "Manage social accounts",
  },
  {
    title: "Read the campaign brief",
    body: "Check the official content URL, required hashtag, campaign dates and all instructions before publishing.",
    href: "/ambassador/campaigns",
    action: "View campaigns",
  },
  {
    title: "Publish and submit the post",
    body: "Publish on a connected platform during the campaign, then submit the direct public post URL on the campaign page.",
    href: "/ambassador/campaigns",
    action: "Submit a post",
  },
  {
    title: "Admin verifies the metrics",
    body: "In this prototype, platform metrics are not fetched automatically. An admin checks the post and stores its reach and engagement snapshot.",
  },
  {
    title: "Admin calculates campaign ratings",
    body: "After verified metrics are available, the admin runs the existing normalized calculation for that campaign. Your rank, percentile and star rating then appear in Performance.",
    href: "/ambassador/performance",
    action: "View performance",
  },
];

export default function AmbassadorGuidePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <section className="mb-8">
        <p className="mb-2 text-sm font-medium text-[#238C89]">AMBASSADOR GUIDE</p>
        <h1 className="text-3xl font-bold tracking-tight text-[#202629]">
          From registration to ranking
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
          Follow these steps for every CiPD campaign. Verification and rating are separate so only reviewed campaign data enters the leaderboard.
        </p>
      </section>

      <section className="space-y-4">
        {steps.map((step, index) => (
          <article
            key={step.title}
            className="flex gap-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#DDF3F1] font-bold text-[#238C89]">
              {index + 1}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#202629]">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{step.body}</p>
              {step.href && (
                <Link
                  href={step.href}
                  className="mt-3 inline-block text-sm font-semibold text-[#238C89]"
                >
                  {step.action} →
                </Link>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-[#E5DFF6] bg-[#F6F3FC] p-6">
        <h2 className="font-bold text-[#202629]">What “wait for rating calculation” means</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Submitting a URL creates a pending post. The admin first verifies the stored metrics, then runs the campaign calculation. This avoids ranking unreviewed or incomplete data and does not change the existing scoring formula.
        </p>
      </section>
    </div>
  );
}
