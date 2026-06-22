import { Check, Zap, Building2, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 dark:text-white font-sans selection:bg-primary/30">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="font-bold text-lg">A</span>
            </div>
            <span className="font-bold text-xl tracking-tight">Antigravity CRM</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors">Müşteri Girişi</Link>
          </div>
        </div>
      </header>

      {/* Pricing Section */}
      <main className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Vize Danışmanlık Süreçlerinizi <span className="text-primary">Otomatize Edin</span></h1>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            Acentenizin tüm operasyonunu tek bir ekrandan yönetin. Evrak listeleri, müşteri takibi ve randevuları otomatikleştirerek operasyonel maliyetlerinizi %70 oranında düşürün.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Basic Plan */}
          <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 flex flex-col">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Başlangıç</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Küçük ve orta ölçekli vize acenteleri için.</p>
            </div>
            <div className="mb-8">
              <span className="text-4xl font-bold">₺1.499</span>
              <span className="text-slate-500 dark:text-slate-400">/ay</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              {[
                "Aylık 50 Yeni Başvuru",
                "2 Danışman Hesabı",
                "Otomatik Evrak Listeleri",
                "Randevu Takvimi",
                "Müşteri Paneli",
                "Standart E-posta Desteği"
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <button className="w-full py-4 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold transition-colors">
              14 Gün Ücretsiz Dene
            </button>
          </div>

          {/* Pro Plan */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-primary/10 to-slate-900 border border-primary/30 relative flex flex-col shadow-2xl shadow-primary/10">
            <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-1 bg-primary text-slate-900 dark:text-white text-xs font-bold rounded-full shadow-lg shadow-primary/30">
              EN ÇOK TERCİH EDİLEN
            </div>
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Profesyonel (SaaS)</h3>
              <p className="text-primary-light text-sm">Büyüyen ve yüksek hacimli acenteler için tam otomasyon.</p>
            </div>
            <div className="mb-8">
              <span className="text-4xl font-bold">₺3.999</span>
              <span className="text-slate-500 dark:text-slate-400">/ay</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              {[
                "Sınırsız Başvuru",
                "Sınırsız Danışman Hesabı",
                "White-label (Sisteme Kendi Logonuzu Ekleyin)",
                "İyzico ile Müşteriden Ödeme Alma",
                "Gelişmiş Raporlar ve Analitik",
                "Google Forms Webhook Entegrasyonu",
                "7/24 Öncelikli Teknik Destek"
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-900 dark:text-slate-200">
                  <Check className="w-5 h-5 text-primary shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <button className="w-full py-4 rounded-xl bg-primary hover:bg-primary-dark text-slate-900 dark:text-white font-bold transition-colors shadow-lg shadow-primary/20">
              Hemen Başla (İyzico ile Öde)
            </button>
          </div>
        </div>
        
        <div className="mt-16 text-center text-slate-500 text-sm">
          <p>Tüm planlarda KVKK uyumlu güvenli sunucular (Supabase) ve anlık yedekleme dahildir.</p>
        </div>
      </main>
    </div>
  );
}
