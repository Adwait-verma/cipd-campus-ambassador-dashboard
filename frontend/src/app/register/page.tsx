"use client";

import Link from "next/link";
import { useState } from "react";
import BrandLogo from "@/components/BrandLogo";

export default function RegisterPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    college: "",
    graduationYear: "",
    password: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setSuccess(false);
    setMessage("");

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMessage("");
    setSuccess(false);

    if (
      !form.fullName.trim() ||
      !form.email.trim() ||
      !form.phoneNumber.trim() ||
      !form.college.trim() ||
      !form.graduationYear.trim() ||
      !form.password ||
      !form.confirmPassword
    ) {
      setMessage("Please fill in all required fields.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (form.password.length < 6) {
      setMessage("Password must contain at least 6 characters.");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: form.fullName,
          email: form.email,
          phone_number: form.phoneNumber.trim(),
          college_name: form.college,
          graduation_year: Number(form.graduationYear),
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Registration failed.");
        return;
      }

      setSuccess(true);

      setForm({
        fullName: "",
        email: "",
        phoneNumber: "",
        college: "",
        graduationYear: "",
        password: "",
        confirmPassword: "",
      });
    } catch {
      setMessage(
        "Could not connect to the backend. Make sure FastAPI is running."
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7F7]">
      <div className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">

        {/* Left side */}
        <section className="hidden bg-[#202629] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <BrandLogo className="w-44" />

            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#54B9B4]">
              Campus Ambassador Programme
            </p>
          </div>

          <div className="max-w-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9383D8]">
              Become an Ambassador
            </p>

            <h1 className="mt-5 text-5xl font-bold leading-tight">
              Represent CiPD on your campus.
            </h1>

            <p className="mt-6 text-base leading-7 text-gray-300">
              Join the Campus Ambassador programme, promote official campaigns,
              connect your social platforms and build a measurable record of
              your impact.
            </p>

            <div className="mt-10 space-y-4">
              {[
                "Participate in official CiPD campaigns",
                "Track verified reach and engagement",
                "Compete on a normalized leaderboard",
                "Earn 3, 4 and 5 star recognition",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#54B9B4]/20 text-sm font-bold text-[#54B9B4]">
                    ✓
                  </div>

                  <p className="text-sm text-gray-300">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Centre for intelligent Product Development · IIIT-Delhi
            <a href="https://cipd.iiitd.ac.in/" target="_blank" rel="noreferrer" className="mt-2 block text-[#54B9B4] underline">
              Visit the official CiPD website ↗
            </a>
          </p>
        </section>

        {/* Registration form */}
        <section className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-2xl">

            <div className="mb-8 lg:hidden">
              <BrandLogo className="w-36" />
            </div>

            <p className="text-sm font-semibold uppercase tracking-wider text-[#238C89]">
              Ambassador Registration
            </p>

            <h2 className="mt-2 text-3xl font-bold text-[#202629]">
              Create your account
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500">
              Register your profile first. You will become eligible for
              campaign scoring after connecting and verifying a supported
              social account.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-8 rounded-2xl border border-gray-200 bg-white p-7 shadow-sm"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Full name
                  </label>

                  <input
                    value={form.fullName}
                    onChange={(e) =>
                      updateField("fullName", e.target.value)
                    }
                    placeholder="Enter your full name"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#54B9B4]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                    College email
                  </label>

                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      updateField("email", e.target.value)
                    }
                    placeholder="you@college.edu"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#54B9B4]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Mobile number (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={form.phoneNumber}
                    onChange={(e) => updateField("phoneNumber", e.target.value)}
                    placeholder="+91 9876543210"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#54B9B4]"
                  />
                  <p className="mt-1 text-xs text-gray-600">Used by CiPD administrators to contact you about campaigns.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                    College / University
                  </label>

                  <input
                    value={form.college}
                    onChange={(e) =>
                      updateField("college", e.target.value)
                    }
                    placeholder="e.g. IIIT Delhi"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#54B9B4]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Graduation year
                  </label>

                  <input
                    type="number"
                    min="2026"
                    max="2035"
                    value={form.graduationYear}
                    onChange={(e) =>
                      updateField("graduationYear", e.target.value)
                    }
                    placeholder="2028"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#54B9B4]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Programme status
                  </label>

                  <div className="mt-2 flex h-[46px] items-center rounded-xl border border-[#E5DFF6] bg-[#F6F3FC] px-4">
                    <span className="text-sm font-semibold text-[#735FC7]">
                      Pending social verification
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Password
                  </label>

                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      updateField("password", e.target.value)
                    }
                    placeholder="Create a password"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#54B9B4]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Confirm password
                  </label>

                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) =>
                      updateField("confirmPassword", e.target.value)
                    }
                    placeholder="Repeat your password"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#54B9B4]"
                  />
                </div>
              </div>

              {message && (
                <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">
                  {message}
                </div>
              )}

              {success && (
                <div className="mt-5 rounded-xl border border-[#BDE3E0] bg-[#EDF8F7] p-5">
                  <p className="font-semibold text-[#238C89]">
                    Registration successful.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Your account has been saved successfully. Your ambassador
                    profile is currently pending social verification. Your
                    onboarding guide has been queued for email, including the
                    WhatsApp group invite if it is available. Email delivery
                    depends on the portal&apos;s mail configuration.
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="mt-7 w-full rounded-xl bg-[#202629] py-3.5 text-sm font-semibold text-white transition hover:bg-[#343B3E]"
              >
                Create Ambassador Account
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Already registered?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-[#238C89]"
                >
                  Sign in
                </Link>
              </p>
            </div>

            <section className="mt-6 rounded-2xl border border-[#E5DFF6] bg-[#F6F3FC] p-5">
              <p className="font-semibold text-[#202629]">
                How ambassador eligibility works
              </p>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Registration creates your account and Campus Ambassador
                profile. However, only users with at least one connected and
                verified supported social media account will be treated as
                active ambassadors for campaign metrics, normalization,
                leaderboard ranking and awards.
              </p>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
