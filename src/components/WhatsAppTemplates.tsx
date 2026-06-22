"use client"
import { useState, useRef, useEffect } from "react";
import { MessageCircle, FileText, Calendar, CheckCircle2, XCircle, CreditCard, ChevronDown } from "lucide-react";

type Props = {
  customer: any;
  activeApp?: any;
  documents?: any[];
  payments?: any[];
};

export default function WhatsAppTemplates({ customer, activeApp, documents, payments }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!customer?.phone) return null;

  const rawPhone = customer.phone.replace(/\D/g, '');
  const phoneParam = rawPhone.startsWith('90') ? rawPhone : `90${rawPhone}`;

  // Hesaplamalar
  const totalPaid = payments?.filter(p => p.status === 'alindi').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const totalFee = activeApp?.total_fee || 0;
  const kalanTutar = Math.max(0, totalFee - totalPaid);
  
  const docList = documents?.map((d: any, i: number) => `${i + 1}. ${d.document_type} ${d.status === 'tamamlandi' ? '✅' : '⏳'}`).join('\n') || '';

  const sendWaMsg = (text: string) => {
    window.open(`https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}`, '_blank');
    setIsOpen(false);
  };

  const templates = [
    {
      id: 'evrak',
      title: 'Evrak Listesi',
      desc: 'İstenen evrakları gönder',
      icon: <FileText className="w-4 h-4 text-amber-500" />,
      text: `Merhaba ${customer.first_name} Bey/Hanım,\n\n${activeApp?.country || ''} vize başvurunuz için gereken evraklar:\n\n${docList}\n\n⏳ = Bekliyor, ✅ = Tamamlandı\n\nSaygılarımızla,\nNobel Vize`,
      show: documents && documents.length > 0
    },
    {
      id: 'randevu',
      title: 'Randevu Hatırlatma',
      desc: 'Tarih ve lokasyon bilgisi',
      icon: <Calendar className="w-4 h-4 text-blue-500" />,
      text: `Merhaba ${customer.first_name} Bey/Hanım,\n\n${activeApp?.country || ''} vize randevunuz: ${activeApp?.appointment_date ? new Date(activeApp.appointment_date).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short'}) : 'Henüz netleşmedi'} - ${activeApp?.appointment_location || 'Belirtilmedi'}\n\nLütfen saatinden önce orada olun. Gerekli evrakları yanınızda getirin.\n\nNobel Vize`,
      show: activeApp && activeApp.status === 'randevu_alindi'
    },
    {
      id: 'onay',
      title: 'Sonuç (Onay)',
      desc: 'Vize onay mesajı',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      text: `Merhaba ${customer.first_name} Bey/Hanım,\n\n${activeApp?.country || ''} vize başvurunuz ONAYLANMIŞTIR! 🎉\n\nPasaportunuzu almak için konsolosluğa gidebilirsiniz.\n\nNobel Vize`,
      show: activeApp && activeApp.status === 'onaylandi'
    },
    {
      id: 'red',
      title: 'Sonuç (Red)',
      desc: 'Vize ret mesajı',
      icon: <XCircle className="w-4 h-4 text-red-500" />,
      text: `Merhaba ${customer.first_name} Bey/Hanım,\n\n${activeApp?.country || ''} vize başvurunuz maalesef reddedilmiştir.\n\nİtiraz süreci ve sonraki adımlar için bizimle iletişime geçin.\n\nNobel Vize`,
      show: activeApp && activeApp.status === 'reddedildi'
    },
    {
      id: 'odeme',
      title: 'Ödeme Hatırlatma',
      desc: `Kalan bakiye: ${kalanTutar} TL`,
      icon: <CreditCard className="w-4 h-4 text-purple-500" />,
      text: `Merhaba ${customer.first_name} Bey/Hanım,\n\n${activeApp?.country || ''} vize başvuru dosyanız için ${kalanTutar} TL ödeme beklenmektedir.\n\nÖdeme bilgileri için bizimle iletişime geçin.\n\nNobel Vize`,
      show: kalanTutar > 0
    }
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-slate-900 dark:text-white text-[11px] font-semibold rounded-lg transition-all"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        Mesaj Gönder
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-64 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl shadow-xl overflow-hidden z-50">
          <div className="p-2 space-y-1">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => sendWaMsg(t.text)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-colors ${!t.show ? 'opacity-50' : ''}`}
              >
                <div className="mt-0.5">{t.icon}</div>
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">{t.title}</div>
                  <div className="text-[10px] text-slate-500">{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
