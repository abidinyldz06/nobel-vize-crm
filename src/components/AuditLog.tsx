"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Download, Search, Filter, Clock, User, Activity, FileText, Calendar, CreditCard, ExternalLink } from "lucide-react";
import Link from "next/link";

interface LogEntry {
  id: string;
  action: string;
  performed_by: string | null;
  created_at: string;
  type: string | null;
  customers: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

export default function AuditLog() {
  const supabase = createSupabaseBrowserClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [dateFilter, setDateFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  
  const [limit, setLimit] = useState(50);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('activity_log')
      .select('id, action, performed_by, created_at, type, customers(id, first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (typeFilter !== "all") {
      query = query.eq('type', typeFilter);
    }

    if (dateFilter !== "all") {
      const now = new Date();
      if (dateFilter === "today") {
        now.setHours(0, 0, 0, 0);
        query = query.gte('created_at', now.toISOString());
      } else if (dateFilter === "7d") {
        now.setDate(now.getDate() - 7);
        query = query.gte('created_at', now.toISOString());
      } else if (dateFilter === "30d") {
        now.setDate(now.getDate() - 30);
        query = query.gte('created_at', now.toISOString());
      }
    }

    const { data, error } = await query;
    if (!error && data) {
      // Type asserting because Supabase's generated types might map relations as arrays or single objects
      // in this case customers is a single row relationship or array if misconfigured, but we'll handle it carefully.
      const formattedData = (data as any[]).map((d: any) => ({
        ...d,
        customers: Array.isArray(d.customers) ? d.customers[0] : d.customers
      })) as any[];
      setLogs(formattedData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [dateFilter, typeFilter, limit]);

  const exportToCSV = () => {
    const headers = ["Tarih", "Kullanıcı", "Aksiyon", "Tip", "Müşteri"];
    const rows = logs.map(log => [
      new Date(log.created_at).toLocaleString('tr-TR'),
      log.performed_by || "Sistem",
      log.action,
      log.type || "general",
      log.customers ? `${log.customers.first_name} ${log.customers.last_name}` : "-"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sistem_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getBadge = (type: string | null) => {
    switch (type) {
      case 'customer': return <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center gap-1 w-max"><User className="w-3 h-3"/> Müşteri</span>;
      case 'document': return <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1 w-max"><FileText className="w-3 h-3"/> Evrak</span>;
      case 'payment': return <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1 w-max"><CreditCard className="w-3 h-3"/> Ödeme</span>;
      case 'appointment': return <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-semibold flex items-center gap-1 w-max"><Calendar className="w-3 h-3"/> Randevu</span>;
      case 'status': return <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-1 w-max"><Activity className="w-3 h-3"/> Durum</span>;
      default: return <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 text-xs font-semibold flex items-center gap-1 w-max">Genel</span>;
    }
  };

  return (
    <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl shadow-lg flex flex-col h-full min-h-[600px]">
      
      {/* Header & Filters */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sistem Logları (Audit)</h2>
          <p className="text-xs text-slate-500 mt-0.5">Sistemde yapılan tüm değişiklikleri takip edin.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <select 
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">Tüm Zamanlar</option>
            <option value="today">Bugün</option>
            <option value="7d">Son 7 Gün</option>
            <option value="30d">Son 30 Gün</option>
          </select>
          
          <select 
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">Tüm Tipler</option>
            <option value="customer">Müşteri</option>
            <option value="document">Evrak</option>
            <option value="payment">Ödeme</option>
            <option value="appointment">Randevu</option>
            <option value="status">Durum</option>
          </select>
          
          <button 
            onClick={exportToCSV}
            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Dışa Aktar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        {loading && logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Yükleniyor...</div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#1f2937] bg-white dark:bg-[#0d1420]">
                <th className="px-6 py-3 font-semibold text-slate-500">Tarih</th>
                <th className="px-6 py-3 font-semibold text-slate-500">Kullanıcı</th>
                <th className="px-6 py-3 font-semibold text-slate-500">Tip</th>
                <th className="px-6 py-3 font-semibold text-slate-500">Aksiyon</th>
                <th className="px-6 py-3 font-semibold text-slate-500">Müşteri</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1f2937]/50">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-colors group">
                  <td className="px-6 py-3 text-slate-500 dark:text-slate-400 text-xs">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(log.created_at).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">
                    {log.performed_by || <span className="text-slate-400 italic">Sistem</span>}
                  </td>
                  <td className="px-6 py-3">
                    {getBadge(log.type)}
                  </td>
                  <td className="px-6 py-3 text-slate-700 dark:text-slate-300">
                    {log.action}
                  </td>
                  <td className="px-6 py-3">
                    {log.customers ? (
                      <Link 
                        href={`/customers/${log.customers.id}`}
                        className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                      >
                        {log.customers.first_name} {log.customers.last_name}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination / Load More */}
      {!loading && logs.length >= limit && (
        <div className="p-4 border-t border-slate-200 dark:border-[#1f2937] text-center">
          <button 
            onClick={() => setLimit(prev => prev + 50)}
            className="px-4 py-2 bg-slate-100 dark:bg-[#1a2232] hover:bg-slate-200 dark:hover:bg-[#253041] text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg transition-colors"
          >
            Daha Fazla Yükle ({limit})
          </button>
        </div>
      )}
    </div>
  );
}
