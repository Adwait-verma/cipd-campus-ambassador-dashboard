"use client";

import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AmbassadorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("cipd_user");

    if (!storedUser) {
      router.replace("/login");
      return;
    }

    try {
      const user = JSON.parse(storedUser);

      if (user.role !== "AMBASSADOR") {
        localStorage.removeItem("cipd_user");
        localStorage.removeItem("cipd_token");
        router.replace("/login");
        return;
      }

      queueMicrotask(() => setAuthorized(true));
    } catch {
      localStorage.removeItem("cipd_user");
      localStorage.removeItem("cipd_token");
      router.replace("/login");
    }
  }, [router]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7F7]">
        <p className="text-sm text-gray-500">
          Checking access...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7F7]">
      <Sidebar />

      <div className="ml-64 min-h-screen">
        <Navbar />

        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
