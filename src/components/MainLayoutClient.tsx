"use client"
import Sidebar from "@/components/Sidebar";
import { Search, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect, useSyncExternalStore } from "react";
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

  return (
    <div className="flex min-h-screen bg-white dark:bg-[#060d1a]">
      <Sidebar profile={profile} isMobileOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <GlobalSearch open={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 py-3 bg-white/90 dark:bg-[#060d1a]/90 backdrop-blur-sm border-b border-slate-200 dark:border-[#1f2937]">
          
          <div className="flex items-center gap-3">
            {/* Hamburger (Mobile Only) */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-[#1f2937] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>

            {/* Search (Desktop Only) */}
            <div className="relative hidden md:flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                readOnly
                onClick={() => setGlobalSearchOpen(true)}
                placeholder="Ara... (Ctrl+K)"
                className="w-72 pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-500 cursor-text hover:border-blue-500 hover:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 ml-auto">
            <NotificationCenter />
            
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="relative p-2 rounded-xl bg-slate-50 dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2232] transition-all"
            >
              {mounted ? (theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />) : <div className="w-4 h-4" />}
            </button>

            <ProfileMenu profile={profile} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
