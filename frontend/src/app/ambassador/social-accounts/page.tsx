"use client";

import { useState } from "react";

type Platform = "Instagram" | "LinkedIn";

type SocialAccount = {
  platform: Platform;
  username: string;
  followers: number;
  connected: boolean;
  verified: boolean;
  lastSync?: string;
};

export default function SocialAccountsPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([
    {
      platform: "Instagram",
      username: "@aarav.builds",
      followers: 4823,
      connected: true,
      verified: true,
      lastSync: "5 minutes ago",
    },
    {
      platform: "LinkedIn",
      username: "",
      followers: 0,
      connected: false,
      verified: false,
    },
  ]);

  const hasVerifiedAccount = accounts.some(
    (account) => account.connected && account.verified
  );

  function toggleLinkedIn() {
    setAccounts((current) =>
      current.map((account) =>
        account.platform === "LinkedIn"
          ? account.connected
            ? {
                ...account,
                connected: false,
                verified: false,
                username: "",
                followers: 0,
                lastSync: undefined,
              }
            : {
                ...account,
                connected: true,
                verified: true,
                username: "Aarav Mehta",
                followers: 1640,
                lastSync: "Just now",
              }
          : account
      )
    );
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Header */}
      <section className="mb-8">
        <p className="mb-2 text-sm font-medium text-[#238C89]">
          SOCIAL ACCOUNTS
        </p>

        <h1 className="text-3xl font-bold tracking-tight text-[#202629]">
          Connected social platforms
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
          Connect the social accounts you use for CiPD campaigns. Only users
          with at least one verified social account are counted as active
          Campus Ambassadors.
        </p>
      </section>

      {/* Ambassador eligibility */}
      <section
        className={`mb-7 rounded-2xl border p-6 ${
          hasVerifiedAccount
            ? "border-[#BDE3E0] bg-[#EDF8F7]"
            : "border-[#F1D9A7] bg-[#FFF9EC]"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-white ${
              hasVerifiedAccount ? "bg-[#54B9B4]" : "bg-[#F0C568]"
            }`}
          >
            {hasVerifiedAccount ? "✓" : "!"}
          </div>

          <div>
            <p className="text-lg font-bold text-[#202629]">
              {hasVerifiedAccount
                ? "Active Campus Ambassador"
                : "Pending social connection"}
            </p>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              {hasVerifiedAccount
                ? "At least one connected social account is verified. Your valid campaign engagement can be included in scoring and normalization."
                : "Your registration exists, but you are not counted as an active Campus Ambassador until a supported social account is connected and verified."}
            </p>
          </div>
        </div>
      </section>

      {/* Accounts */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {accounts.map((account) => (
          <div
            key={account.platform}
            className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl font-bold text-white ${
                    account.platform === "Instagram"
                      ? "bg-[#E98AAE]"
                      : "bg-[#9383D8]"
                  }`}
                >
                  {account.platform === "Instagram" ? "IG" : "in"}
                </div>

                <div>
                  <h2 className="text-xl font-bold text-[#202629]">
                    {account.platform}
                  </h2>

                  <p className="mt-1 text-sm text-gray-400">
                    {account.connected
                      ? "Connected account"
                      : "No account connected"}
                  </p>
                </div>
              </div>

              {account.connected ? (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    account.verified
                      ? "bg-green-50 text-green-700"
                      : "bg-yellow-50 text-yellow-700"
                  }`}
                >
                  {account.verified ? "VERIFIED" : "PENDING"}
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                  NOT CONNECTED
                </span>
              )}
            </div>

            {account.connected ? (
              <>
                <div className="mt-6 rounded-xl bg-[#F8FAFA] p-5">
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <p className="text-xs text-gray-400">
                        Account
                      </p>

                      <p className="mt-1 font-semibold text-[#202629]">
                        {account.username}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400">
                        Followers
                      </p>

                      <p className="mt-1 font-semibold text-[#202629]">
                        {account.followers.toLocaleString()}
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

                    <div>
                      <p className="text-xs text-gray-400">
                        Status
                      </p>

                      <p className="mt-1 font-semibold text-green-700">
                        {account.verified
                          ? "Ready for scoring"
                          : "Verification pending"}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={
                    account.platform === "LinkedIn"
                      ? toggleLinkedIn
                      : undefined
                  }
                  className="mt-5 rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-50"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-[#F8FAFA] p-6">
                  <p className="text-sm font-semibold text-[#202629]">
                    Connect {account.platform}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Connect this account to allow CiPD to use permitted
                    campaign engagement metrics for performance evaluation.
                  </p>
                </div>

                <button
                  onClick={
                    account.platform === "LinkedIn"
                      ? toggleLinkedIn
                      : undefined
                  }
                  className="mt-5 rounded-xl bg-[#202629] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#343B3E]"
                >
                  Connect {account.platform}
                </button>
              </>
            )}
          </div>
        ))}
      </section>

      {/* Data policy */}
      <section className="mt-7 rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-bold text-[#202629]">
          Social data & eligibility
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            "Registration alone does not make a user an active Campus Ambassador.",
            "At least one supported social account must be connected and verified.",
            "Only verified campaign posts with valid engagement metrics enter normalization.",
            "Disconnected or suspended accounts are excluded from active ambassador counts.",
            "OAuth tokens must remain server-side and should never be exposed in the frontend.",
            "The final product will show the last metric synchronization time for transparency.",
          ].map((item) => (
            <div
              key={item}
              className="flex gap-3 rounded-xl bg-[#F8FAFA] p-4"
            >
              <span className="mt-0.5 text-[#54B9B4]">✓</span>

              <p className="text-sm leading-6 text-gray-500">
                {item}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#E5DFF6] bg-[#F6F3FC] p-5">
        <p className="font-semibold text-[#202629]">
          Prototype behaviour
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          The Connect LinkedIn button currently simulates a successful
          connection. In the final system, this action will initiate OAuth and
          verification through the platform integration handled by FastAPI.
        </p>
      </section>
    </div>
  );
}