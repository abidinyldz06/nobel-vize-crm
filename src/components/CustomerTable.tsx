"use client"
import { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, Filter, Clock, CheckCircle2, AlertCircle, FileText, Calendar, Loader, XCircle, Trash2, UserPlus, MessageCircle, RefreshCw, X } from "lucide-react";
import CustomerActionMenu from "./CustomerActionMenu";
import { toast } from "sonner";

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
  latest_application_id?: string | null;
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

export default function CustomerTable({ customers, isAdmin, staffList = [] }: { customers: Customer[], isAdmin: boolean, staffList?: any[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Bulk Selection State
  const [selected, setSelected] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  
  const toggleSelectAll = () => {
    if (selected.length === filtered.length && filtered.length > 0) {
      setSelected([]);
    } else {
      setSelected(filtered.map(c => c.id));
    }
  };

  const handleBulkAction = async (action: 'update_status' | 'assign_staff' | 'delete', value?: string) => {
    if (selected.length === 0) return;
    
    setIsProcessing(true);
    try {
      const selectedCustomers = customers.filter(c => selected.includes(c.id));
      const applicationIds = selectedCustomers.map(c => c.latest_application_id).filter(Boolean);

      const res = await fetch('/api/customers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, customerIds: selected, applicationIds, value })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "İşlem başarısız");
      }

      toast.success("Toplu işlem başarıyla tamamlandı.");
      setSelected([]);
      setShowDeleteConfirm(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Bir hata oluştu.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWhatsAppReminder = () => {
    if (selected.length === 0) return;
    const selectedCustomers = customers.filter(c => selected.includes(c.id) && c.phone);
    if (selectedCustomers.length === 0) {
      toast.error("Seçili müşterilerin geçerli bir telefon numarası yok.");
      return;
    }

    let delay = 0;
    selectedCustomers.forEach(c => {
      let phoneStr = c.phone!.replace(/[^0-9]/g, '');
      if (!phoneStr.startsWith('90') && phoneStr.length === 10) phoneStr = '90' + phoneStr;
      
      const message = `Merhaba ${c.first_name} Bey/Hanım,\n\nNobel Vize sisteminden hatırlatma: Başvurunuzla ilgili bekleyen işlemler bulunmaktadır. Lütfen en kısa sürede danışmanınızla iletişime geçin.\n\nİyi günler dileriz.`;
      const link = `https://wa.me/${phoneStr}?text=${encodeURIComponent(message)}`;
      
      setTimeout(() => {
        window.open(link, '_blank');
      }, delay);
      delay += 1500;
    });
    
    toast.success(`${selectedCustomers.length} müşteriye WhatsApp sekmeleri açılıyor.`);
  };

  return (
    <>
      {/* BULK ACTION BAR */}
      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-5 border border-slate-700 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">
              {selected.length}
            </div>
            <span className="text-sm font-medium whitespace-nowrap">müşteri seçili</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            {/* Status Update */}
            <select 
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer min-w-[140px]"
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkAction('update_status', e.target.value);
                  e.target.value = "";
                }
              }}
              disabled={isProcessing}
            >
              <option value="">Durum Güncelle</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            {/* Assign Staff (Admin Only) */}
            {isAdmin && staffList.length > 0 && (
              <select 
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer min-w-[140px]"
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkAction('assign_staff', e.target.value);
                    e.target.value = "";
                  }
                }}
                disabled={isProcessing}
              >
                <option value="">Danışman Ata</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                ))}
              </select>
            )}

            <button 
              onClick={handleWhatsAppReminder}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/20 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </button>

            {isAdmin && (
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" /> Sil
              </button>
            )}

            <button 
              onClick={() => setSelected([])}
              className="p-2 text-slate-400 hover:text-white transition-colors ml-auto sm:ml-0"
              title="Seçimi İptal Et"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0d1420] w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 dark:border-[#1f2937] p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Seçili Müşterileri Sil</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Seçtiğiniz <strong>{selected.length}</strong> müşteri kalıcı olarak silinecektir. Bu müşterilere ait tüm başvuru, evrak ve ödeme kayıtları da geri döndürülemez şekilde silinir. Onaylıyor musunuz?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1a2232] hover:bg-slate-200 dark:hover:bg-[#1f2937] transition-colors">
                İptal
              </button>
              <button 
                onClick={() => handleBulkAction('delete')} 
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="px-4 md:px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] flex justify-between items-center bg-slate-50 dark:bg-[#0a101a]">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={selected.length === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll}
              className="md:hidden w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Müşteri Listesi</h2>
          </div>
          <span className="text-xs font-medium text-slate-500">{filtered.length} kayıt</span>
        </div>
        
        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-slate-200 dark:border-[#1f2937]">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input 
                    type="checkbox" 
                    checked={selected.length === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
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
                const isSelected = selected.includes(customer.id);

                return (
                  <tr key={customer.id} className={`hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group ${isSelected ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}>
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleSelect(customer.id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
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
                      <CustomerActionMenu 
                        customerId={customer.id} 
                        isAdmin={isAdmin} 
                        currentStaffId={(customer as any).assigned_staff_id} 
                      />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    {search || statusFilter !== "all" ? "Arama kriterlerine uygun müşteri bulunamadı." : "Henüz hiç müşteri yok."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-[#1f2937]">
          {filtered.map(customer => {
            const cfg = STATUS_CONFIG[customer.status || "profil_analizi"] || STATUS_CONFIG.profil_analizi;
            const Icon = cfg.icon;
            const isSelected = selected.includes(customer.id);

            return (
              <div key={customer.id} className={`p-4 transition-colors relative ${isSelected ? 'bg-blue-50/50 dark:bg-blue-500/5' : 'bg-white dark:bg-[#0d1420]'}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleSelect(customer.id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Link href={`/customers/${customer.id}`} className="font-semibold text-slate-900 dark:text-slate-200 text-sm truncate">
                        {customer.first_name} {customer.last_name}
                      </Link>
                      <CustomerActionMenu customerId={customer.id} isAdmin={isAdmin} currentStaffId={(customer as any).assigned_staff_id} />
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-2 text-[11px]">
                      {customer.country ? (
                        <span className="font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1a2232] px-2 py-0.5 rounded-md">
                          {customer.country}
                        </span>
                      ) : (
                        <span className="text-slate-500 bg-slate-100 dark:bg-[#1a2232] px-2 py-0.5 rounded-md">
                          Ülke Seçilmedi
                        </span>
                      )}
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                      <p className="flex items-center gap-1.5"><Search className="w-3 h-3" /> {customer.phone || 'Tel yok'}</p>
                      <p className="flex items-center gap-1.5"><FileText className="w-3 h-3" /> {customer.email || 'E-posta yok'}</p>
                    </div>

                    {customer.profile_score != null && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-[#1a2232]">
                        <span className="text-[10px] text-slate-500">Skor:</span>
                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-[#1f2937] rounded-full overflow-hidden flex-1 max-w-[100px]">
                          <div
                            className={`h-full rounded-full ${customer.profile_score >= 70 ? 'bg-emerald-500' : customer.profile_score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${customer.profile_score}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{customer.profile_score}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              {search || statusFilter !== "all" ? "Arama kriterlerine uygun müşteri bulunamadı." : "Henüz hiç müşteri yok."}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
