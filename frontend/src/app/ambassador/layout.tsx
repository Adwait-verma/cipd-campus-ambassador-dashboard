import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export default function AmbassadorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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