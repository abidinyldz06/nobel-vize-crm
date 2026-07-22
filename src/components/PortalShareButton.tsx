"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Share2, Copy, RefreshCw, X, MessageCircle, Check, AlertCircle, Power } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { toast } from "sonner";

interface PortalShareButtonProps {
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    portal_token: string | null;
    portal_token_expires_at: string | null;
    portal_access_enabled: boolean;
  };
}

export default function PortalShareButton({ customer }: PortalShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [token, setToken] = useState(customer.portal_token);
  const [expiresAt, setExpiresAt] = useState(customer.portal_token_expires_at);
  const [enabled, setEnabled] = useState(customer.portal_access_enabled);

  // Vercel deployment URL or localhost fallback
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://nobel-vize-crm.vercel.app";
  const isExpired = Boolean(expiresAt && new Date(expiresAt) <= new Date());
  const portalUrl = token && enabled && !isExpired ? `${baseUrl}/portal/${token}` : "";

  const handleCopy = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setIsCopied(true);
      toast.success("Bağlantı kopyalandı!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Bağlantı kopyalanamadı.");
    }
  };

  const handleRefresh = async () => {
    if (!confirm("Eski link artık çalışmayacak ve müşteriniz eski linkle giriş yapamayacak. Yeni link oluşturmak istediğinize emin misiniz?")) {
      return;
    }
    
    setIsRefreshing(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc('rotate_customer_portal_token_v1', {
        p_customer_id: customer.id,
        p_valid_days: 90,
      });
        
      if (error) throw error;
      const result = data as { token?: string; expires_at?: string; enabled?: boolean } | null;
      if (!result?.token || !result.expires_at) throw new Error("Portal bağlantısı oluşturulamadı.");
      setToken(result.token);
      setExpiresAt(result.expires_at);
      setEnabled(result.enabled ?? true);
      toast.success("Yeni portal linki başarıyla oluşturuldu.");
    } catch (error) {
      toast.error("Link yenilenirken hata oluştu: " + (error instanceof Error ? error.message : "Bilinmeyen hata"));
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleAccess = async () => {
    setIsRefreshing(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc('set_customer_portal_access_v1', {
      p_customer_id: customer.id,
      p_enabled: !enabled,
    });
    setIsRefreshing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { token?: string; expires_at?: string; enabled?: boolean } | null;
    setToken(result?.token ?? token);
    setExpiresAt(result?.expires_at ?? expiresAt);
    setEnabled(result?.enabled ?? !enabled);
    toast.success(!enabled ? "Portal erişimi açıldı." : "Portal erişimi kapatıldı.");
  };

  const getWhatsAppLink = () => {
    if (!customer.phone || !portalUrl) return "#";
    
    // Temizle ve TR formatına getir (Eğer başında 90 yoksa ekle)
    let phoneStr = customer.phone.replace(/[^0-9]/g, '');
    if (!phoneStr.startsWith('90') && phoneStr.length === 10) {
      phoneStr = '90' + phoneStr;
    }
    
    const message = `Merhaba ${customer.first_name} Bey/Hanım, vize başvuru dosyanızı takip etmek için aşağıdaki linke tıklayabilirsiniz:\n\n${portalUrl}`;
    return `https://wa.me/${phoneStr}?text=${encodeURIComponent(message)}`;
  };

  const handleWhatsAppShare = async () => {
    if (!customer.phone || !portalUrl) {
      toast.error("Aktif portal bağlantısı veya telefon numarası bulunamadı.");
      return;
    }
    const message = `Merhaba ${customer.first_name} Bey/Hanım, vize başvuru dosyanızı takip etmek için aşağıdaki linke tıklayabilirsiniz:\n\n${portalUrl}`;
    const popup = window.open("about:blank", "_blank");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("record_communication_v1", {
      p_payload: {
        customer_id: customer.id,
        type: "whatsapp",
        direction: "giden",
        subject: "Müşteri portalı bağlantısı",
        content: message,
        recipient: customer.phone,
        status: "hazirlandi",
      },
    });
    if (error) {
      popup?.close();
      toast.error(error.message);
      return;
    }
    const link = getWhatsAppLink();
    if (popup) popup.location.href = link;
    else window.open(link, "_blank", "noopener,noreferrer");
    toast.success("Portal paylaşımı iletişim geçmişine kaydedildi.");
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 text-sm font-bold rounded-xl transition-colors shrink-0"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Portal Linki</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0d1420] w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-[#1f2937] overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b border-slate-100 dark:border-[#1f2937] flex items-center justify-between sticky top-0 bg-white/80 dark:bg-[#0d1420]/80 backdrop-blur-md z-10">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Share2 className="w-4 h-4" />
                </div>
                Müşteri Portalı Paylaşımı
              </h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-[#1a2232] text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {!portalUrl ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3 opacity-80" />
                  <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                    {!enabled ? "Bu müşterinin portal erişimi kapalı." : isExpired ? "Portal bağlantısının süresi dolmuş." : "Bu müşteri için portal bağlantısı bulunmuyor."}
                  </p>
                  <div className="mt-5 flex justify-center gap-2">
                    {!enabled && <button type="button" onClick={toggleAccess} disabled={isRefreshing} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Erişimi Aç</button>}
                    <button type="button" onClick={handleRefresh} disabled={isRefreshing} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Yeni Link Oluştur</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-center mb-8">
                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 inline-block">
                      <QRCodeSVG value={portalUrl} size={180} level="H" includeMargin={false} />
                    </div>
                  </div>
                  
                  <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">
                    Telefon Kamerası ile Tarayın
                  </p>
                  {expiresAt && <p className="-mt-4 mb-5 text-center text-[11px] text-slate-500">Geçerlilik: {new Date(expiresAt).toLocaleDateString('tr-TR')}</p>}

                  <div className="space-y-4">
                    {/* Link Kutusu */}
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1.5 block ml-1">Portal URL</label>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-slate-50 dark:bg-[#1a2232] border border-slate-200 dark:border-[#2d3f55] rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap font-medium select-all">
                          {portalUrl}
                        </div>
                        <button
                          onClick={handleCopy}
                          className="flex items-center justify-center w-10 h-10 bg-slate-100 hover:bg-slate-200 dark:bg-[#1a2232] dark:hover:bg-[#2d3f55] text-slate-600 dark:text-slate-300 rounded-xl transition-colors shrink-0"
                          title="Kopyala"
                        >
                          {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleWhatsAppShare}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                          !customer.phone 
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600" 
                            : "bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/20"
                        }`}
                      >
                        <MessageCircle className="w-5 h-5" />
                        WhatsApp
                      </button>
                      
                      <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="flex items-center justify-center gap-2 py-3 px-4 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 border border-red-100 dark:border-red-500/20 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        Link Yenile
                      </button>
                      <button type="button" onClick={toggleAccess} disabled={isRefreshing} className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-600">
                        <Power className="h-4 w-4" /> Portal Erişimini Kapat
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
