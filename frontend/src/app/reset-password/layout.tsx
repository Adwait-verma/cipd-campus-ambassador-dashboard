import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset password | CiPD",
  referrer: "no-referrer",
};

export default function ResetPasswordLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
