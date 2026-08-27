"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    name: "Overview",
    href: "/admin",
    icon: "▦",
  },
  {
    name: "Ambassadors",
    href: "/admin/ambassadors",
    icon: "◎",
  },
  {
    name: "Campaigns",
    href: "/admin/campaigns",
    icon: "◫",
  },
  {
    name: "Awards",
    href: "/admin/awards",
    icon: "★",
  },
  {
    name: "Analytics",
    href: "/admin/analytics",
    icon: "↗",
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col bg-[#202629] text-white">
      <div className="border-b border-white/10 px-6 py-7">
        <div className="text-2xl font-bold tracking-tight">
          C<span className="text-[#54B9B4]">i</span>PD
        </div>

        <p className="mt-2 text-xs font-semibold tracking-[0.18em] text-[#9383D8]">
          ADMIN
        </p>
      </div>

      <nav className="flex-1 px-4 py-6">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          Administration
        </p>

        <div className="space-y-2">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/admin" &&
                pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                  active
                    ? "bg-white/10 font-semibold text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-base ${
                    active
                      ? "bg-[#9383D8] text-white"
                      : "bg-white/5 text-gray-400"
                  }`}
                >
                  {item.icon}
                </span>

                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 px-4 py-5">
        <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white">
          <span>⚙</span>
          Settings
        </button>

        <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white">
          <span>↪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}