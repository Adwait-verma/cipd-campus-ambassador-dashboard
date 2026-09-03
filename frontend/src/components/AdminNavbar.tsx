"use client";

import { useEffect, useState } from "react";

type AdminUser = {
  full_name: string;
};

export default function AdminNavbar() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("cipd_user");

    if (!storedUser) {
      return;
    }

    try {
      const parsedAdmin: AdminUser = JSON.parse(storedUser);
      queueMicrotask(() => setAdmin(parsedAdmin));
    } catch {
      queueMicrotask(() => setAdmin(null));
    }
  }, []);

  const adminName = admin?.full_name || "Administrator";
  const initials = adminName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-20 items-center justify-between border-b border-gray-200 bg-white px-8">
      <div>
        <p className="text-sm font-medium text-gray-400">
          CiPD Campus Ambassador Administration
        </p>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3 border-l border-gray-200 pl-5">
          <div className="text-right">
            <p className="text-sm font-semibold text-[#202629]">
              {adminName}
            </p>
            <p className="text-xs text-gray-400">
              Administrator
            </p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#9383D8] font-bold text-white">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
