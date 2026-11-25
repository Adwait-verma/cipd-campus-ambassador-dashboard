"use client";

import { authFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

const steps = [
  {
    title: "Read your welcome email",
    body: "At first sign-in, check your email for onboarding steps. If the group invite is available, use it to join; otherwise check this page later. Keep your profile details up to date.",
    href: "/ambassador/profile",
    action: "Open profile",
  },
  {
    title: "Connect Instagram",
    body: "Connect your Instagram Business or Creator account to become ACTIVE and eligible for campaign scoring.",
    href: "/ambassador/social-accounts",
    action: "Connect Instagram",
  },
  {
    title: "Read the campaign brief",
    body: "Check the official content URL, required hashtag, campaign dates and all instructions before publishing.",
    href: "/ambassador/campaigns",
    action: "View campaigns",
  },
  {
    title: "Publish and submit the post",
    body: "Publish on your connected Instagram account during the campaign, then submit the direct Instagram post URL on the campaign page.",
    href: "/ambassador/campaigns",
    action: "Submit a post",
  },
  {
    title: "Metrics update automatically",
    body: "CiPD fetches permitted metrics from your submitted Instagram post on the schedule shown above. If your connection expires, reconnect Instagram; your last successful metrics are kept.",
  },
  {
    title: "Follow your ranking",
    body: "Ratings update automatically after changed metrics arrive. Performance shows overall and campaign rankings. Each campaign result becomes fixed after its closing date.",
    href: "/ambassador/performance",
    action: "View performance",
  },
];

export default function AmbassadorGuidePage() {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    authFetch("http://127.0.0.1:8000/ambassador/whatsapp-group")
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        setInviteUrl(data.whatsapp_group_invite_url || null);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <section className="mb-8">
        <p className="mb-2 text-sm font-medium text-[#238C89]">AMBASSADOR GUIDE</p>
        <h1 className="text-3xl font-bold tracking-tight text-[#202629]">
          From registration to ranking
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
          Follow these steps for every CiPD Instagram campaign. Submit your post once; metrics and ratings update automatically.
        </p>
      </section>

      <section className="mb-6 rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-6">
        <h2 className="font-bold text-[#202629]">Official WhatsApp group</h2>
        {inviteUrl ? (
          <a href={inviteUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block font-semibold text-[#238C89] underline">
            Open group invite ↗
          </a>
        ) : (
          <p className="mt-2 text-sm text-gray-600">The admin has not posted a group invite yet. You can continue with the other steps.</p>
        )}
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
        <h2 className="font-bold text-[#202629]">When your result appears</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Your submission enters scoring after Instagram returns complete metrics. Updates can be delayed by Instagram limits or connection issues. Check Performance after the next update, and contact programme support if a problem continues. Missing data is never counted as zero.
        </p>
      </section>
    </div>
  );
}
