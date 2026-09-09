"use client";

import { authFetch } from "@/lib/api";
import { useEffect, useState } from "react";

type LoggedInUser = {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
};

type AmbassadorProfile = {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  ambassador_id: number;
  college_name: string;
  graduation_year: number;
  status: string;
};

export default function Navbar() {
  const [profile, setProfile] = useState<AmbassadorProfile | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const storedUser = localStorage.getItem("cipd_user");

      if (!storedUser) {
        return;
      }

      try {
        const user: LoggedInUser = JSON.parse(storedUser);

        const response = await authFetch(
          `https://scaling-carnival-7v7pjrpwwxx92pg54-8000.app.github.dev/ambassador/profile/${user.user_id}`
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(data.detail);
          return;
        }

        setProfile(data.profile);
      } catch (error) {
        console.error("Failed to load ambassador profile:", error);
      }
    }

    loadProfile();
  }, []);

  function getInitials(name: string) {
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    <header className="flex h-20 items-center justify-between border-b border-gray-200 bg-white px-8">
      <div>
        <p className="text-sm font-medium text-gray-400">
          CiPD Campus Ambassador Portal
        </p>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3 border-l border-gray-200 pl-5">
          <div className="text-right">
            <p className="text-sm font-semibold text-[#202629]">
              {profile ? profile.full_name : "Loading..."}
            </p>

            <p className="text-xs text-gray-400">
              {profile ? profile.college_name : ""}
            </p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#54B9B4] font-bold text-white">
            {profile ? getInitials(profile.full_name) : "..."}
          </div>
        </div>
      </div>
    </header>
  );
}
