"use client";

import { useState } from "react";
import { MessageCircle, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ReminderCustomer {
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
  };
  country: string;
  docs: string[];
}

export default function BulkWhatsAppReminder({ customersList }: { customersList: ReminderCustomer[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [sentList, setSentList] = useState<Set<string>>(new window.Set());

  const getWhatsAppLink = (customerData: ReminderCustomer) => {
    const phone = customerData.customer.phone;
    if (!phone) return null;

    let phoneStr = phone.replace(/[^0-9]/g, '');
    if (!phoneStr.startsWith('90') && phoneStr.length === 10) {
      phoneStr = '90' + phoneStr;
    }

    const docList = customerData.docs.map((d, i) => `${i + 1}. ${d}`).join('\n');
    const message = `Merhaba ${customerData.customer.first_name} Bey/Hanım,\n\n${customerData.country} vize başvurunuz için eksik evraklarınızın süresi gecikmiştir. İşlemlerinizin aksamaması için aşağıdaki evrakları lütfen en kısa sürede iletiniz:\n\n${docList}\n\nİyi günler dileriz,\nNobel Vize`;
    
    return `https://wa.me/${phoneStr}?text=${encodeURIComponent(message)}`;
  };

  const handleSendAll = () => {
    const validCustomers = customersList.filter(c => c.customer.phone);
    if (validCustomers.length === 0) {
      toast.error("Geçerli telefon numarası bulunan müşteri yok.");
      return;
    }
    
    let delay = 0;
    validCustomers.forEach((c) => {
      const link = getWhatsAppLink(c);
      if (link && !sentList.has(c.customer.id)) {
        setTimeout(() => {
          window.open(link, '_blank');
          setSentList(prev => new window.Set(prev).add(c.customer.id));
        }, delay);
        delay += 1500; // Her sekme arasına 1.5 saniye koyarak tarayıcının popup engelleyicisini aşmaya çalış
      }
    });
    toast.success("Tüm hatırlatmalar yeni sekmelerde açılıyor.");
  };

  const handleSendSingle = (c: ReminderCustomer) => {
    const link = getWhatsAppLink(c);
    if (!link) {
      toast.error("Geçerli telefon numarası yok.");
      return;
    }
    window.open(link, '_blank');
    setSentList(prev => new window.Set(prev).add(c.customer.id));
  };

  if (customersList.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-500/20 dark:hover:bg-red-500/30 text-red-700 dark:text-red-400 text-xs font-bold rounded-lg transition-colors"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">WhatsApp Hatırlatma</span>
        <span className="sm:hidden">Hatırlat</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0d1420] w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-[#1f2937] overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b border-slate-100 dark:border-[#1f2937] flex items-center justify-between sticky top-0 bg-white/80 dark:bg-[#0d1420]/80 backdrop-blur-md z-10">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366]">
                  <MessageCircle className="w-4 h-4" />
                </div>
                Toplu Evrak Hatırlatması
              </h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-[#1a2232] text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-0 overflow-y-auto flex-1">
              <div className="divide-y divide-slate-100 dark:divide-[#1f2937]">
                {customersList.map((c) => (
                  <div key={c.customer.id} className="p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#1a2232] flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-sm uppercase">
                        {c.customer.first_name?.[0]}{c.customer.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-900 dark:text-white">
                          {c.customer.first_name} {c.customer.last_name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {c.docs.length} evrak gecikti • {c.customer.phone || 'Telefon yok'}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleSendSingle(c)}
                      disabled={!c.customer.phone}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        sentList.has(c.customer.id)
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : !c.customer.phone
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500"
                          : "bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/20"
                      }`}
                    >
                      {sentList.has(c.customer.id) ? (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> Gönderildi</>
                      ) : (
                        <><MessageCircle className="w-3.5 h-3.5" /> Gönder</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] mt-auto">
              <button
                onClick={handleSendAll}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-[#25D366]/20"
              >
                <MessageCircle className="w-4 h-4" /> Tümüne Sırayla Gönder
              </button>
              <p className="text-[10px] text-center text-slate-500 mt-2">
                "Tümüne Gönder" butonuna bastığınızda sekmeler sırayla açılacaktır. Tarayıcınızın pop-up engelleyicisine takılmaması için izin vermeniz gerekebilir.
              </p>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
