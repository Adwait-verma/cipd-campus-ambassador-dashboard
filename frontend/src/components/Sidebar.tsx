"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navigation = [
  {
    name: "Dashboard",
    href: "/ambassador/dashboard",
    icon: "▦",
  },
  {
    name: "Campaigns",
    href: "/ambassador/campaigns",
    icon: "◫",
  },
  {
    name: "Performance",
    href: "/ambassador/performance",
    icon: "↗",
  },
  {
    name: "Social Accounts",
    href: "/ambassador/social-accounts",
    icon: "◎",
  },
  {
    name: "Profile",
    href: "/ambassador/profile",
    icon: "○",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    sessionStorage.removeItem("cipd_user");
    sessionStorage.removeItem("cipd_token");

    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col bg-[#202629] text-white">
      {/* Branding */}
      <div className="border-b border-white/10 px-6 py-7">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold tracking-tight">
            C<span className="text-[#54B9B4]">i</span>PD
          </div>
        </div>

        <p className="mt-2 text-xs font-semibold tracking-[0.18em] text-[#54B9B4]">
          AMBASSADOR
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          Workspace
        </p>

        <div className="space-y-2">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/ambassador/dashboard" &&
                pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all ${
                  active
                    ? "bg-white/10 font-semibold text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-base ${
                    active
                      ? "bg-[#54B9B4] text-[#202629]"
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

      {/* Bottom */}
      <div className="border-t border-white/10 px-4 py-5">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
        >
          <span>↪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
