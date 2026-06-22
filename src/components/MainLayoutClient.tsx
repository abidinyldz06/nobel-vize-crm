"use client"
import Sidebar from "@/components/Sidebar";
import { Search, Bell, Sun, Moon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/customers": "Müşteriler",
  "/appointments": "Randevu Takvimi",
  "/countries": "Ülke & Evraklar",
  "/reports": "Raporlar",
  "/settings": "Ayarlar",
};

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error("Search error", err);
      }
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const title = Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] || "";

  return (
    <div className="flex min-h-screen bg-white dark:bg-[#060d1a]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header — like the mockup */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 bg-white dark:bg-[#060d1a]/90 backdrop-blur-sm border-b border-slate-200 dark:border-[#1f2937]">
          <div className="relative hidden md:flex items-center" ref={searchRef}>
            <Search className={`absolute left-3 w-4 h-4 ${isSearching ? 'text-blue-500 animate-pulse' : 'text-slate-500'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  setShowDropdown(false);
                  router.push(`/customers?search=${encodeURIComponent(searchQuery)}`);
                }
              }}
              placeholder="Müşteri ara (İsim, Tel, Pasaport)..."
              className="w-72 pl-10 pr-4 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-all"
            />
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl shadow-xl overflow-hidden z-50">
                {searchResults.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto py-2">
                    {searchResults.map((customer) => (
                      <Link 
                        key={customer.id} 
                        href={`/customers/${customer.id}`}
                        onClick={() => { setShowDropdown(false); setSearchQuery(""); }}
                        className="block px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-colors border-b border-slate-100 dark:border-[#1f2937] last:border-0"
                      >
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">
                          {customer.first_name} {customer.last_name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-2">
                          {customer.phone && <span>📞 {customer.phone}</span>}
                          {customer.passport_no && <span>🛂 {customer.passport_no}</span>}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-sm text-slate-500 text-center">
                    Sonuç bulunamadı
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="relative p-2 rounded-xl bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-all"
            >
              {mounted ? (theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />) : <div className="w-4 h-4" />}
            </button>

            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-700 flex items-center justify-center text-slate-900 dark:text-white text-xs font-bold shadow-md">
              N
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
