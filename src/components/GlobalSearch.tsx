"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, User, Globe, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ customers: any[], countries: any[], applications: any[] }>({
    customers: [], countries: [], applications: []
  });
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = "hidden";
    } else {
      setQuery("");
      setResults({ customers: [], countries: [], applications: [] });
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [open]);

  useEffect(() => {
    if (query.length < 2) {
      setResults({ customers: [], countries: [], applications: [] });
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (err) {
        console.error("Search error", err);
      }
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  if (!open) return null;

  const hasResults = results.customers.length > 0 || results.countries.length > 0 || results.applications.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0d1420] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-[#1f2937] flex flex-col max-h-[80vh]">
        
        {/* Search Input */}
        <div className="relative flex items-center px-4 py-3 border-b border-slate-200 dark:border-[#1f2937]">
          <Search className={`w-5 h-5 mr-3 shrink-0 ${isSearching ? 'text-blue-500 animate-pulse' : 'text-slate-400'}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Müşteri, ülke, başvuru durumu ara..."
            className="flex-1 bg-transparent border-none focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-lg py-1"
          />
          <button 
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a2232] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto">
          {query.length >= 2 ? (
            hasResults ? (
              <div className="p-2 space-y-4">
                
                {/* Customers */}
                {results.customers.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">Müşteriler</h3>
                    <div className="space-y-1">
                      {results.customers.map((c) => (
                        <Link
                          key={`cust-${c.id}`}
                          href={`/customers/${c.id}`}
                          onClick={onClose}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                              {c.first_name} {c.last_name}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              {c.phone ? `📞 ${c.phone}` : ''} {c.passport_no ? `🛂 ${c.passport_no}` : ''}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Applications */}
                {results.applications.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">Başvurular</h3>
                    <div className="space-y-1">
                      {results.applications.map((app) => (
                        <Link
                          key={`app-${app.id}`}
                          href={`/customers/${app.customer_id}`}
                          onClick={onClose}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-purple-500 transition-colors">
                              {app.customers?.first_name} {app.customers?.last_name}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 capitalize truncate">
                              🌍 {app.country} — <span className="font-medium">{app.status?.replace(/_/g, ' ')}</span>
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Countries */}
                {results.countries.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">Ülkeler (Gereksinimler)</h3>
                    <div className="space-y-1">
                      {results.countries.map((country, idx) => (
                        <Link
                          key={`country-${country.country}-${idx}`}
                          href={`/countries`}
                          onClick={onClose}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
                              {country.country}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 capitalize">
                              Vize Sistemi: {country.visa_type}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <Search className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p>"{query}" için sonuç bulunamadı.</p>
              </div>
            )
          ) : (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
              <p className="text-sm">Aramaya başlamak için en az 2 karakter girin.</p>
              <div className="flex justify-center gap-4 mt-6 opacity-60">
                <div className="flex flex-col items-center gap-2 text-xs">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-[#1a2232] flex items-center justify-center"><User className="w-4 h-4"/></div>
                  <span>Müşteriler</span>
                </div>
                <div className="flex flex-col items-center gap-2 text-xs">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-[#1a2232] flex items-center justify-center"><FileText className="w-4 h-4"/></div>
                  <span>Başvurular</span>
                </div>
                <div className="flex flex-col items-center gap-2 text-xs">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-[#1a2232] flex items-center justify-center"><Globe className="w-4 h-4"/></div>
                  <span>Ülkeler</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] text-[10px] text-slate-500 flex justify-between items-center">
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><kbd className="bg-slate-200 dark:bg-[#1f2937] px-1.5 py-0.5 rounded font-mono">↑↓</kbd> Gezin</span>
            <span className="flex items-center gap-1"><kbd className="bg-slate-200 dark:bg-[#1f2937] px-1.5 py-0.5 rounded font-mono">Enter</kbd> Seç</span>
          </div>
          <span className="flex items-center gap-1"><kbd className="bg-slate-200 dark:bg-[#1f2937] px-1.5 py-0.5 rounded font-mono">ESC</kbd> Kapat</span>
        </div>
      </div>
    </div>
  );
}
