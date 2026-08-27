import AdminSidebar from "@/components/AdminSidebar";
import AdminNavbar from "@/components/AdminNavbar";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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