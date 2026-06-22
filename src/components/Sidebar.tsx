"use client"
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, FileText, Calendar, Settings, LogOut, Globe, BarChart3, UserCog } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useState, useEffect } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const [userName, setUserName] = useState("Yükleniyor...");
  const [userRole, setUserRole] = useState("Yönetici");
  const [userInitial, setUserInitial] = useState("N");

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: staffRecord } = await supabase
        .from('staff')
        .select('full_name, role')
        .eq('user_id', user.id)
        .single();

      if (staffRecord) {
        setUserName(staffRecord.full_name);
        setUserRole(staffRecord.role === 'admin' ? 'Yönetici' : 'Danışman');
        setUserInitial(staffRecord.full_name.charAt(0).toUpperCase());
      } else {
        const email = user.email || "Nobel Vize";
        setUserName(email);
        setUserRole("Yönetici");
        setUserInitial(email.charAt(0).toUpperCase());
      }
    };
    fetchUser();
  }, []);

  const links = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/customers", icon: Users, label: "Müşteriler" },
    { href: "/countries", icon: Globe, label: "Ülke & Evraklar" },
    { href: "/appointments", icon: Calendar, label: "Randevular" },
    { href: "/staff", icon: UserCog, label: "Personel" },
    { href: "/reports", icon: BarChart3, label: "Raporlar" },
    { href: "/profile", icon: UserCog, label: "Profilim" },
    { href: "/settings", icon: Settings, label: "Ayarlar" },
  ];

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <aside className="w-60 flex flex-col h-screen sticky top-0 z-40 bg-white dark:bg-[#0d1420] border-r border-slate-200 dark:border-[#1f2937]">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-200 dark:border-[#1f2937]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-900/40">
            <Globe className="text-slate-900 dark:text-white w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Nobel Vize</h1>
            <p className="text-[10px] text-blue-400 font-medium uppercase tracking-wider">CRM Sistemi</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-slate-600 mb-3 px-2 uppercase tracking-widest">Ana Menü</p>
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                isActive
                  ? "bg-blue-600/15 border border-blue-600/30 text-blue-400"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-200 hover:bg-white/5 border border-transparent"
              }`}
            >
              <link.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-400" : ""}`} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-slate-200 dark:border-[#1f2937] space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-slate-900 dark:text-white text-xs font-bold shrink-0">{userInitial}</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">{userName}</p>
            <p className="text-[10px] text-slate-500">{userRole}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/8 rounded-xl transition-all text-sm font-medium border border-transparent"
        >
          <LogOut className="w-4 h-4" />
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
