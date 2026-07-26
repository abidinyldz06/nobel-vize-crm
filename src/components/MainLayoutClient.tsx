"use client"
import Sidebar from "@/components/Sidebar";
import { Search, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import NotificationCenter from "@/components/NotificationCenter";
import GlobalSearch from "@/components/GlobalSearch";
import ProfileMenu from "@/components/ProfileMenu";
import type { CurrentStaffProfile } from "@/types/staff-profile";

export default function MainLayoutClient({ children, profile }: { children: React.ReactNode; profile: CurrentStaffProfile }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  const closeSidebar = () => {
    setIsSidebarOpen(false);
    mobileMenuButtonRef.current?.focus();
  };

  useEffect(() => {
    // Ctrl+K to open global search
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSidebar();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isSidebarOpen]);

  return (
    <div className="flex min-h-screen bg-white dark:bg-[#060d1a]">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Ana içeriğe geç
      </a>
      <Sidebar profile={profile} isMobileOpen={isSidebarOpen} onClose={closeSidebar} />
      <GlobalSearch open={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 py-3 bg-white/90 dark:bg-[#060d1a]/90 backdrop-blur-sm border-b border-slate-200 dark:border-[#1f2937]">
          
          <div className="flex items-center gap-3">
            {/* Hamburger (Mobile Only) */}
            <button
              ref={mobileMenuButtonRef}
              type="button"
              disabled={!mounted}
              onClick={() => setIsSidebarOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setIsSidebarOpen(true);
                }
              }}
              aria-label="Ana menüyü aç"
              aria-controls="primary-sidebar"
              aria-expanded={isSidebarOpen}
              className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-[#1f2937] transition-colors disabled:cursor-wait disabled:opacity-60"
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>

            {/* Search (Desktop Only) */}
            <div className="relative hidden items-center md:flex">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 w-4 h-4 text-slate-500" />
              <button
                type="button"
                onClick={() => setGlobalSearchOpen(true)}
                className="w-72 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-left text-sm text-slate-500 transition-all hover:border-blue-500 hover:bg-white dark:border-[#1f2937] dark:bg-[#0d1420]"
              >
                Ara... (Ctrl+K)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 ml-auto">
            <NotificationCenter />
            
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={mounted ? (theme === "dark" ? "Gündüz temasına geç" : "Gece temasına geç") : "Temayı değiştir"}
              className="relative p-2 rounded-xl bg-slate-50 dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2232] transition-all"
            >
              {mounted ? (theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />) : <div className="w-4 h-4" />}
            </button>

            <ProfileMenu profile={profile} />
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
