"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { CurrentStaffProfile } from "@/types/staff-profile";

export default function ProfileMenu({ profile }: { profile: CurrentStaffProfile }) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const initial = profile.fullName.trim().charAt(0).toLocaleUpperCase("tr-TR") || "N";
  const roleLabel = profile.role === "admin" ? "Yönetici" : "Danışman";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(current => !current)}
        aria-label="Profil menüsünü aç"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex items-center gap-2 rounded-xl p-1 text-left transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-[#1a2232]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-purple-700 text-xs font-bold text-white shadow-md ring-2 ring-white dark:ring-[#060d1a]">
          {initial}
        </span>
        <span className="hidden max-w-36 lg:block">
          <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
            {profile.fullName}
          </span>
          <span className="block text-[10px] text-slate-500">{roleLabel}</span>
        </span>
        <ChevronDown
          className={`hidden h-3.5 w-3.5 text-slate-500 transition-transform lg:block ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Profil seçenekleri"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#1f2937] dark:bg-[#0d1420]"
        >
          <div className="border-b border-slate-100 px-4 py-4 dark:border-[#1f2937]">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-purple-700 text-sm font-bold text-white">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{profile.fullName}</p>
                <p className="truncate text-xs text-slate-500">{profile.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              {roleLabel} hesabı
            </div>
          </div>

          <div className="p-2">
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">
              <UserRound className="h-4 w-4 text-slate-400" />
              <span>Personel No: {profile.staffId.slice(0, 8)}</span>
            </div>
            {profile.role === "admin" && (
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <Settings className="h-4 w-4" />
                Sistem Ayarları
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={isSigningOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              {isSigningOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
