"use client";

import { authFetch } from "@/lib/api";
import { useEffect, useState } from "react";

type Platform = "INSTAGRAM" | "LINKEDIN";

type LoggedInUser = {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
};

type SocialAccount = {
  account_id: number;
  platform: string;
  platform_user_id: string;
  profile_handle: string;
  follower_count: number;
  verified: boolean;
  updated_at: string;
};

const supportedPlatforms: Platform[] = ["INSTAGRAM", "LINKEDIN"];

export default function SocialAccountsPage() {
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingPlatform, setWorkingPlatform] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("cipd_user");

    if (!storedUser) {
      window.location.href = "/login";
      return;
    }

    try {
      const parsedUser: LoggedInUser = JSON.parse(storedUser);

      if (parsedUser.role !== "AMBASSADOR") {
        window.location.href = "/login";
        return;
      }

      queueMicrotask(() => setUser(parsedUser));
      loadAccounts(parsedUser.user_id);
    } catch {
      localStorage.removeItem("cipd_user");
      window.location.href = "/login";
    }
  }, []);

  async function loadAccounts(userId: number) {
    try {
      setLoading(true);

      const response = await authFetch(
        `http://127.0.0.1:8000/ambassador/social-accounts/${userId}`
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Failed to load social accounts.");
        return;
      }

      setAccounts(data.accounts);
    } catch {
      setMessage(
        "Could not connect to the backend. Make sure FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  }

  function getAccount(platform: Platform) {
    return accounts.find((account) => account.platform === platform);
  }

  async function connectAccount(platform: Platform) {
    if (!user) return;

    /*
      TEMPORARY MANUAL PROTOTYPE CONNECTION

      We are not using real Instagram/LinkedIn OAuth yet.
      This creates a test verified connection in PostgreSQL so we can
      complete and test the application workflow.

      Later this function will be replaced with OAuth.
    */

    const platformName =
      platform === "INSTAGRAM" ? "Instagram" : "LinkedIn";

    const handle = window.prompt(
      `Enter your ${platformName} username/profile handle:`
    );

    if (!handle || !handle.trim()) {
      return;
    }

    try {
      setWorkingPlatform(platform);
      setMessage("");

      const response = await authFetch(
        "http://127.0.0.1:8000/ambassador/social-accounts/connect",
        {
          method: "POST",
          body: JSON.stringify({
            user_id: user.user_id,
            platform,
            platform_user_id: `${platform.toLowerCase()}_${user.user_id}`,
            profile_handle: handle.trim(),
            follower_count: 0,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Failed to connect social account.");
        return;
      }

      setMessage(
        `${platformName} connected successfully. Ambassador status: ${data.ambassador_status}.`
      );

      await loadAccounts(user.user_id);
    } catch {
      setMessage("Could not connect to the backend.");
    } finally {
      setWorkingPlatform(null);
    }
  }

  async function disconnectAccount(platform: Platform) {
    if (!user) return;

    const platformName =
      platform === "INSTAGRAM" ? "Instagram" : "LinkedIn";

    const confirmed = window.confirm(
      `Disconnect your ${platformName} account?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setWorkingPlatform(platform);
      setMessage("");

      const response = await authFetch(
        `http://127.0.0.1:8000/ambassador/social-accounts/${user.user_id}/${platform}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Failed to disconnect social account.");
        return;
      }

      setMessage(
        `${platformName} disconnected. Ambassador status: ${data.ambassador_status}.`
      );

      await loadAccounts(user.user_id);
    } catch {
      setMessage("Could not connect to the backend.");
    } finally {
      setWorkingPlatform(null);
    }
  }

  const hasVerifiedAccount = accounts.some(
    (account) => account.verified
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">
          Loading social accounts...
        </p>
      </div>
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

      {/* Status message */}
      {message && (
        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-[#202629]">{message}</p>
        </section>
      )}

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
            <div className="flex items-center gap-3">
              <p className="text-lg font-bold text-[#202629]">
                {hasVerifiedAccount
                  ? "Active Campus Ambassador"
                  : "Pending social connection"}
              </p>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  hasVerifiedAccount
                    ? "bg-[#DDF3F1] text-[#238C89]"
                    : "bg-[#FCECC8] text-[#9A6A00]"
                }`}
              >
                {hasVerifiedAccount ? "ACTIVE" : "PENDING"}
              </span>
            </div>

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
        {supportedPlatforms.map((platform) => {
          const account = getAccount(platform);
          const connected = Boolean(account);

          const platformName =
            platform === "INSTAGRAM" ? "Instagram" : "LinkedIn";

          return (
            <div
              key={platform}
              className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl font-bold text-white ${
                      platform === "INSTAGRAM"
                        ? "bg-[#E98AAE]"
                        : "bg-[#9383D8]"
                    }`}
                  >
                    {platform === "INSTAGRAM" ? "IG" : "in"}
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-[#202629]">
                      {platformName}
                    </h2>

                    <p className="mt-1 text-sm text-gray-400">
                      {connected
                        ? "Connected account"
                        : "No account connected"}
                    </p>
                  </div>
                </div>

                {connected ? (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      account?.verified
                        ? "bg-green-50 text-green-700"
                        : "bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    {account?.verified ? "VERIFIED" : "PENDING"}
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                    NOT CONNECTED
                  </span>
                )}
              </div>

              {account ? (
                <>
                  <div className="mt-6 rounded-xl bg-[#F8FAFA] p-5">
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <p className="text-xs text-gray-400">Account</p>

                        <p className="mt-1 font-semibold text-[#202629]">
                          {account.profile_handle}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400">Followers</p>

                        <p className="mt-1 font-semibold text-[#202629]">
                          {account.follower_count.toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400">Last sync</p>

                        <p className="mt-1 font-semibold text-[#202629]">
                          {new Date(account.updated_at).toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400">Status</p>

                        <p
                          className={`mt-1 font-semibold ${
                            account.verified
                              ? "text-green-700"
                              : "text-yellow-700"
                          }`}
                        >
                          {account.verified
                            ? "Ready for scoring"
                            : "Verification pending"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => disconnectAccount(platform)}
                    disabled={workingPlatform === platform}
                    className="mt-5 rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {workingPlatform === platform
                      ? "Disconnecting..."
                      : `Disconnect ${platformName}`}
                  </button>
                </>
              ) : (
                <>
                  <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-[#F8FAFA] p-6">
                    <p className="text-sm font-semibold text-[#202629]">
                      Manually connect {platformName}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      Connect this account to allow CiPD to use permitted
                      campaign engagement metrics for performance evaluation.
                    </p>
                  </div>

                  <button
                    onClick={() => connectAccount(platform)}
                    disabled={workingPlatform === platform}
                    className="mt-5 rounded-xl bg-[#202629] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#343B3E] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {workingPlatform === platform
                      ? "Connecting..."
                      : `Connect ${platformName} (prototype)`}
                  </button>
                </>
              )}
            </div>
          );
        })}
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
            "Disconnected accounts are excluded from active ambassador counts.",
            "OAuth tokens must remain server-side and should never be exposed in the frontend.",
            "The final product will show the last metric synchronization time for transparency.",
          ].map((item) => (
            <div
              key={item}
              className="flex gap-3 rounded-xl bg-[#F8FAFA] p-4"
            >
              <span className="mt-0.5 text-[#54B9B4]">✓</span>

              <p className="text-sm leading-6 text-gray-500">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Prototype warning */}
      <section className="mt-6 rounded-2xl border border-[#E5DFF6] bg-[#F6F3FC] p-5">
        <p className="font-semibold text-[#202629]">
          Prototype social connection
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Social connections are currently being stored in the real CiPD
          database, but platform OAuth is not connected yet. During this
          prototype stage, entering a profile handle simulates successful
          verification. Real Instagram and LinkedIn authorization will replace
          this step later.
        </p>
      </section>
    </div>
  );
}
