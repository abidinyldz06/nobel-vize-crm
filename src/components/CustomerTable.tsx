"use client"
import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Filter, MoreVertical, Clock, CheckCircle2, AlertCircle, FileText, Calendar, Loader, XCircle } from "lucide-react";

type Customer = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  profile_score: number | null;
  country?: string | null;
  status?: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  profil_analizi:     { label: "Profil Analizi",      color: "text-slate-500 dark:text-slate-400 bg-slate-800/50",    icon: Clock },
  evrak_bekleniyor:   { label: "Evrak Bekleniyor",    color: "text-amber-400 bg-amber-500/10",    icon: AlertCircle },
  randevu_bekleniyor: { label: "Randevu Bekleniyor",  color: "text-orange-400 bg-orange-500/10",  icon: Calendar },
  randevu_alindi:     { label: "Randevu Alındı",      color: "text-blue-400 bg-blue-500/10",      icon: Calendar },
  evrak_hazirlaniyor: { label: "Evrak Hazırlanıyor",  color: "text-indigo-400 bg-indigo-500/10",  icon: FileText },
  basvuru_yapildi:    { label: "Başvuru Yapıldı",     color: "text-purple-400 bg-purple-500/10",  icon: Loader },
  onaylandi:          { label: "Onaylandı",           color: "text-emerald-400 bg-emerald-500/10", icon: CheckCircle2 },
  reddedildi:         { label: "Reddedildi",          color: "text-red-400 bg-red-500/10",        icon: XCircle },
  itiraz:             { label: "İtiraz",              color: "text-yellow-400 bg-yellow-500/10",  icon: AlertCircle },
  kapandi:            { label: "Kapandı",             color: "text-slate-500 bg-slate-800/50",    icon: XCircle },
};

export default function CustomerTable({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return customers.filter(c => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.country || "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || (c.status || "profil_analizi") === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [customers, search, statusFilter]);

  return (
    <>
      <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-4 rounded-2xl mb-6 flex flex-col md:flex-row gap-4 shadow-lg shadow-black/20">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="İsim, telefon, e-posta veya ülke ile ara..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#060c18] border border-slate-200 dark:border-[#1f2937] rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-500 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex items-center px-4 py-2.5 bg-slate-50 dark:bg-[#060c18] border border-slate-200 dark:border-[#1f2937] rounded-xl">
            <Filter className="w-4 h-4 text-slate-500 shrink-0 mr-2" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-transparent focus:outline-none text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[160px] appearance-none cursor-pointer"
            >
              <option value="all">Tüm Durumlar</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg shadow-black/20">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] flex justify-between items-center bg-slate-50 dark:bg-[#0a101a]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Müşteri Listesi</h2>
          <span className="text-xs font-medium text-slate-500">{filtered.length} kayıt</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-slate-200 dark:border-[#1f2937]">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Müşteri</th>
                <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">İletişim</th>
                <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Hedef Ülke</th>
                <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Durum</th>
                <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Kayıt Tarihi</th>
                <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#1f2937]">
              {filtered.map(customer => {
                const cfg = STATUS_CONFIG[customer.status || "profil_analizi"] || STATUS_CONFIG.profil_analizi;
                const Icon = cfg.icon;
                return (
                  <tr key={customer.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-800 to-blue-900 flex items-center justify-center font-bold text-xs text-blue-300 uppercase shrink-0 border border-blue-800/50">
                          {customer.first_name?.[0]}{customer.last_name?.[0]}
                        </div>
                        <div>
                          <Link href={`/customers/${customer.id}`} className="font-medium text-slate-900 dark:text-slate-200 group-hover:text-blue-400 transition-colors">
                            {customer.first_name} {customer.last_name}
                          </Link>
                          {customer.profile_score != null && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="w-10 h-1 bg-slate-200 dark:bg-[#1f2937] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${customer.profile_score >= 70 ? 'bg-emerald-500' : customer.profile_score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${customer.profile_score}%` }}
                                />
                              </div>
                              <span className="text-[9px] text-slate-600">{customer.profile_score}p</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      <div>
                        <p className="text-slate-700 dark:text-slate-300">{customer.phone || '-'}</p>
                        <p className="text-[11px] text-slate-500">{customer.email || '-'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {customer.country
                        ? <span className="font-medium text-slate-700 dark:text-slate-300">{customer.country}</span>
                        : <span className="text-slate-600 text-xs">Başvuru yok</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {new Date(customer.created_at).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/customers/${customer.id}`} className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors inline-flex">
                        <MoreVertical className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    {search || statusFilter !== "all" ? "Arama kriterlerine uygun müşteri bulunamadı." : "Henüz hiç müşteri yok."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
