"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ambassador" | "admin">("ambassador");
  const [message, setMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setMessage("Please enter your email and password.");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Login failed.");
        return;
      }

      if (!data.access_token) {
        setMessage("Login succeeded, but no access token was returned.");
        return;
      }

      if (role === "admin" && data.user.role !== "ADMIN") {
        setMessage("This account is not an admin account.");
        return;
      }

      if (role === "ambassador" && data.user.role !== "AMBASSADOR") {
        setMessage("This account is not an ambassador account.");
        return;
      }

      sessionStorage.setItem("cipd_user", JSON.stringify(data.user));
      sessionStorage.setItem("cipd_token", data.access_token);

      // Discard credentials left by the previous shared-window storage.
      localStorage.removeItem("cipd_user");
      localStorage.removeItem("cipd_token");

      if (data.user.role === "ADMIN") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/ambassador/dashboard";
      }
    } catch {
      setMessage(
        "Could not connect to the backend. Make sure FastAPI is running."
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7F7]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        {/* Left branding */}
        <section className="hidden bg-[#202629] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="text-3xl font-bold tracking-tight">
              C<span className="text-[#54B9B4]">i</span>PD
            </div>

            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#54B9B4]">
              Campus Ambassador Programme
            </p>
          </div>

          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9383D8]">
              Connect. Promote. Perform.
            </p>

            <h1 className="mt-5 text-5xl font-bold leading-tight">
              Turn your impact into measurable performance.
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-gray-300">
              Help students discover CiPD programmes, workshops and product
              innovation at IIIT-Delhi. Share official campaigns, track verified
              engagement and earn recognition for your campus outreach.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-2xl font-bold text-[#54B9B4]">Reach</p>
                <p className="mt-2 text-xs text-gray-400">
                  Track campaign impact
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-2xl font-bold text-[#9383D8]">Rank</p>
                <p className="mt-2 text-xs text-gray-400">
                  Compare fairly
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-2xl font-bold text-[#F0C568]">★</p>
                <p className="mt-2 text-xs text-gray-400">
                  Earn recognition
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Centre for intelligent Product Development · IIIT-Delhi
            <a href="https://cipd.iiitd.ac.in/" target="_blank" rel="noreferrer" className="mt-2 block text-[#54B9B4] underline">
              Visit the official CiPD website ↗
            </a>
          </p>
        </section>

        {/* Login */}
        <section className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <div className="text-3xl font-bold text-[#202629]">
                C<span className="text-[#54B9B4]">i</span>PD
              </div>
            </div>

            <p className="text-sm font-semibold uppercase tracking-wider text-[#238C89]">
              Welcome back
            </p>

            <h2 className="mt-2 text-3xl font-bold text-[#202629]">
              Sign in to CiPD
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              Access your Campus Ambassador workspace or administration
              dashboard.
            </p>

            {/* Role selection */}
            <div className="mt-8 grid grid-cols-2 rounded-xl border border-gray-300 bg-white p-1">
              <button
                type="button"
                onClick={() => {
                  setRole("ambassador");
                  setMessage("");
                }}
                className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${
                  role === "ambassador"
                    ? "bg-[#202629] text-white"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                Ambassador
              </button>

              <button
                type="button"
                onClick={() => {
                  setRole("admin");
                  setMessage("");
                }}
                className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${
                  role === "admin"
                    ? "bg-[#202629] text-white"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                Admin
              </button>
            </div>

            <form
              onSubmit={handleLogin}
              className="mt-6 rounded-2xl border border-gray-200 bg-white p-7 shadow-sm"
            >
              {/* Email */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Email address
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setMessage("");
                  }}
                  placeholder="you@college.edu"
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[#202629] outline-none transition placeholder:font-medium placeholder:text-gray-500 focus:border-[#54B9B4] focus:ring-1 focus:ring-[#54B9B4]"
                />
              </div>

              {/* Password */}
              <div className="mt-5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setMessage("");
                  }}
                  placeholder="Enter your password"
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[#202629] outline-none transition placeholder:font-medium placeholder:text-gray-500 focus:border-[#54B9B4] focus:ring-1 focus:ring-[#54B9B4]"
                />
              </div>

              <button
                type="submit"
                className="mt-7 w-full rounded-xl bg-[#202629] py-3.5 text-sm font-semibold text-white transition hover:bg-[#343B3E]"
              >
                Sign in
              </button>

              {message && (
                <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">
                  {message}
                </div>
              )}
            </form>

            {role === "ambassador" && (
              <p className="mt-6 text-center text-sm text-gray-600">
                New to the programme?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-[#238C89]"
                >
                  Register as an Ambassador
                </Link>
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
