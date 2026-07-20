"use client"
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, Calendar, Settings, LogOut, Globe, BarChart3, UserCog } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { CurrentStaffProfile } from "@/types/staff-profile";

export default function Sidebar({
  profile,
  isMobileOpen = false,
  onClose,
}: {
  profile: CurrentStaffProfile;
  isMobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const userName = profile.fullName;
  const userRole = profile.role === "admin" ? "Yönetici" : "Danışman";
  const userInitial = profile.fullName.trim().charAt(0).toLocaleUpperCase("tr-TR") || "N";

  const baseLinks = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/customers", icon: Users, label: "Müşteriler" },
    { href: "/countries", icon: Globe, label: "Ülke & Evraklar" },
    { href: "/appointments", icon: Calendar, label: "Randevular" },
  ];

  if (userRole === "Yönetici") {
    baseLinks.push({ href: "/staff", icon: UserCog, label: "Personel" });
  }

  baseLinks.push(
    { href: "/reports", icon: BarChart3, label: "Raporlar" },
    { href: "/settings", icon: Settings, label: "Ayarlar" }
  );

  const links = baseLinks;

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-60 flex flex-col h-screen fixed md:sticky top-0 left-0 z-50 md:z-40 
        bg-white dark:bg-[#0d1420] border-r border-slate-200 dark:border-[#1f2937]
        transition-transform duration-300 ease-in-out
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-200 dark:border-[#1f2937] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-900/40">
              <Globe className="text-white w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Nobel Vize</h1>
              <p className="text-[10px] text-blue-500 dark:text-blue-400 font-medium uppercase tracking-wider">CRM Sistemi</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-600 mb-3 px-2 uppercase tracking-widest">Ana Menü</p>
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-600/15 border border-blue-200 dark:border-blue-600/30 text-blue-600 dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent"
                }`}
              >
                <link.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : ""}`} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="px-3 py-4 border-t border-slate-200 dark:border-[#1f2937] space-y-1 bg-slate-50/50 dark:bg-transparent">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{userInitial}</div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">{userName}</p>
              <p className="text-[10px] text-slate-500">{userRole}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all text-sm font-medium border border-transparent"
          >
            <LogOut className="w-4 h-4" />
            Çıkış Yap
          </button>
        </div>
      </aside>
    </>
  );
}
