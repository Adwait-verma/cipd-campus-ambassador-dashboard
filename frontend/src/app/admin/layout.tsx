"use client";

import AdminSidebar from "@/components/AdminSidebar";
import AdminNavbar from "@/components/AdminNavbar";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const storedUser = sessionStorage.getItem("cipd_user");

    if (!storedUser) {
      router.replace("/login");
      return;
    }

    try {
      const user = JSON.parse(storedUser);

      if (user.role !== "ADMIN") {
        sessionStorage.removeItem("cipd_user");
        sessionStorage.removeItem("cipd_token");
        router.replace("/login");
        return;
      }

      queueMicrotask(() => setAuthorized(true));
    } catch {
      sessionStorage.removeItem("cipd_user");
      sessionStorage.removeItem("cipd_token");
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
      <AdminSidebar />

      <div className="ml-64 min-h-screen">
        <AdminNavbar />

        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
