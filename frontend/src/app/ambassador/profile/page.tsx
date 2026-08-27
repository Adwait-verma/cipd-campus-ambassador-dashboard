"use client";

import { useState } from "react";

export default function ProfilePage() {
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    fullName: "Aarav Mehta",
    email: "aarav@iiitd.ac.in",
    college: "IIIT Delhi",
    graduationYear: "2027",
    city: "New Delhi",
  });

  function updateField(field: keyof typeof form, value: string) {
    setSaved(false);

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSave() {
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Header */}
      <section className="mb-8">
        <p className="mb-2 text-sm font-medium text-[#238C89]">
          PROFILE
        </p>

        <h1 className="text-3xl font-bold tracking-tight text-[#202629]">
          Ambassador profile
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Manage your personal and campus information used by the CiPD Campus
          Ambassador programme.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_2fr]">
        {/* Profile summary */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#54B9B4] text-2xl font-bold text-white">
              AM
            </div>

            <h2 className="mt-5 text-2xl font-bold text-[#202629]">
              {form.fullName}
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              {form.college}
            </p>

            <p className="mt-1 text-sm text-gray-400">
              Graduation {form.graduationYear}
            </p>

            <div className="mt-5">
              <span className="rounded-full bg-[#DDF3F1] px-3 py-1.5 text-xs font-bold text-[#238C89]">
                ACTIVE AMBASSADOR
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Eligibility
            </p>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Registration
                </span>

                <span className="text-sm font-semibold text-green-700">
                  Complete
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Social account
                </span>

                <span className="text-sm font-semibold text-green-700">
                  Verified
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Ambassador status
                </span>

                <span className="text-sm font-semibold text-[#238C89]">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Editable form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <div className="mb-7">
            <h2 className="text-xl font-bold text-[#202629]">
              Personal information
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Keep your information accurate for campaign administration and
              reporting.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Full name
              </label>

              <input
                value={form.fullName}
                onChange={(e) =>
                  updateField("fullName", e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#54B9B4]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Email
              </label>

              <input
                value={form.email}
                onChange={(e) =>
                  updateField("email", e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#54B9B4]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                College
              </label>

              <input
                value={form.college}
                onChange={(e) =>
                  updateField("college", e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#54B9B4]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Graduation year
              </label>

              <input
                value={form.graduationYear}
                onChange={(e) =>
                  updateField("graduationYear", e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#54B9B4]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                City
              </label>

              <input
                value={form.city}
                onChange={(e) =>
                  updateField("city", e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#54B9B4]"
              />
            </div>
          </div>

          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={handleSave}
              className="rounded-xl bg-[#202629] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#343B3E]"
            >
              Save changes
            </button>

            {saved && (
              <span className="text-sm font-semibold text-green-700">
                Changes saved
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Important rule */}
      <section className="mt-6 rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-5">
        <p className="font-semibold text-[#202629]">
          Ambassador status rule
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Registration alone does not make a user an active Campus
          Ambassador. At least one supported social account must be connected
          and verified before the user is counted in ambassador statistics or
          becomes eligible for engagement-based scoring.
        </p>
      </section>
    </div>
  );
}