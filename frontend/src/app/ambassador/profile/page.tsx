"use client";

import { authFetch } from "@/lib/api";
import { useEffect, useState } from "react";

type StoredUser = {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
};

type Profile = {
  user_id: number;
  ambassador_id: number;
  full_name: string;
  email: string;
  college_name: string;
  graduation_year: number;
  status: string;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    college: "",
    graduationYear: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const stored = sessionStorage.getItem("cipd_user");

        if (!stored) {
          window.location.href = "/login";
          return;
        }

        const user: StoredUser = JSON.parse(stored);

        if (user.role !== "AMBASSADOR") {
          window.location.href = "/login";
          return;
        }

        const response = await authFetch(
          `http://127.0.0.1:8000/ambassador/profile/${user.user_id}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Failed to load profile."
          );
        }

        const loadedProfile: Profile =
          data.profile ?? data;

        setProfile(loadedProfile);

        setForm({
          fullName: loadedProfile.full_name,
          email: loadedProfile.email,
          college: loadedProfile.college_name,
          graduationYear:
            loadedProfile.graduation_year.toString(),
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load profile."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setSaved(false);
    setError("");

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSave() {
    if (!profile) return;

    setSaved(false);
    setError("");

    if (!form.fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!form.email.trim()) {
      setError("Email is required.");
      return;
    }

    if (!form.college.trim()) {
      setError("College is required.");
      return;
    }

    const graduationYear = Number(form.graduationYear);

    if (
      !Number.isInteger(graduationYear) ||
      graduationYear < 2000 ||
      graduationYear > 2100
    ) {
      setError("Enter a valid graduation year.");
      return;
    }

    try {
      setSaving(true);

      const response = await authFetch(
        `http://127.0.0.1:8000/ambassador/profile/${profile.user_id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            full_name: form.fullName.trim(),
            email: form.email.trim(),
            college_name: form.college.trim(),
            graduation_year: graduationYear,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to update profile."
        );
      }

      const updatedProfile: Profile = data.profile;

      setProfile(updatedProfile);

      setForm({
        fullName: updatedProfile.full_name,
        email: updatedProfile.email,
        college: updatedProfile.college_name,
        graduationYear:
          updatedProfile.graduation_year.toString(),
      });

      const stored = sessionStorage.getItem("cipd_user");

      if (stored) {
        const currentUser: StoredUser =
          JSON.parse(stored);

        sessionStorage.setItem(
          "cipd_user",
          JSON.stringify({
            ...currentUser,
            full_name: updatedProfile.full_name,
            email: updatedProfile.email,
          })
        );
      }

      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save profile."
      );
    } finally {
      setSaving(false);
    }
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1500px] py-20 text-center text-gray-500">
        Loading profile...
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="mx-auto max-w-[1500px]">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const isActive = profile.status === "ACTIVE";

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
          Manage your personal and campus information used by the
          CiPD Campus Ambassador programme.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_2fr]">
        {/* Profile summary */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#54B9B4] text-2xl font-bold text-white">
              {getInitials(profile.full_name)}
            </div>

            <h2 className="mt-5 text-2xl font-bold text-[#202629]">
              {profile.full_name}
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              {profile.college_name}
            </p>

            <p className="mt-1 text-sm text-gray-400">
              Graduation {profile.graduation_year}
            </p>

            <div className="mt-5">
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  isActive
                    ? "bg-[#DDF3F1] text-[#238C89]"
                    : "bg-[#FFF1CC] text-[#A87500]"
                }`}
              >
                {isActive
                  ? "ACTIVE AMBASSADOR"
                  : "PENDING VERIFICATION"}
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

                <span
                  className={`text-sm font-semibold ${
                    isActive
                      ? "text-green-700"
                      : "text-amber-600"
                  }`}
                >
                  {isActive
                    ? "Verified"
                    : "Verification required"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Ambassador status
                </span>

                <span
                  className={`text-sm font-semibold ${
                    isActive
                      ? "text-[#238C89]"
                      : "text-amber-600"
                  }`}
                >
                  {isActive ? "Active" : "Pending"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Editable information */}
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <div className="mb-7">
            <h2 className="text-xl font-bold text-[#202629]">
              Personal information
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Keep your information accurate for campaign
              administration and reporting.
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
                  updateField(
                    "fullName",
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#54B9B4]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Email
              </label>

              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  updateField(
                    "email",
                    e.target.value
                  )
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
                  updateField(
                    "college",
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#54B9B4]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Graduation year
              </label>

              <input
                type="number"
                min="2000"
                max="2100"
                value={form.graduationYear}
                onChange={(e) =>
                  updateField(
                    "graduationYear",
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#54B9B4]"
              />
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8 flex items-center gap-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-[#202629] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#343B3E] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : "Save changes"}
            </button>

            {saved && (
              <span className="text-sm font-semibold text-green-700">
                Changes saved successfully
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Status rule */}
      <section className="mt-6 rounded-2xl border border-[#BDE3E0] bg-[#EDF8F7] p-5">
        <p className="font-semibold text-[#202629]">
          Ambassador status rule
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Registration alone does not make a user an active Campus
          Ambassador. At least one supported social account must be
          connected and verified before the user is counted in
          ambassador statistics or becomes eligible for
          engagement-based scoring.
        </p>
      </section>
    </div>
  );
}
