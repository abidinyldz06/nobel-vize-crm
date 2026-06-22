"use client"
import { useState } from "react";
import { Building2, Palette, Save, Bell, Shield, Globe, ChevronRight, Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

const TABS = [
  { id: "company", label: "Şirket Bilgileri", icon: Building2 },
  { id: "appearance", label: "Görünüm & Tema", icon: Palette },
  { id: "notifications", label: "Bildirimler", icon: Bell },
  { id: "security", label: "Güvenlik", icon: Shield },
];

const COLORS = [
  { hex: "#2563eb", name: "Mavi (Varsayılan)" },
  { hex: "#10b981", name: "Yeşil" },
  { hex: "#8b5cf6", name: "Mor" },
  { hex: "#f59e0b", name: "Amber" },
  { hex: "#ef4444", name: "Kırmızı" },
  { hex: "#14b8a6", name: "Teal" },
  { hex: "#f43f5e", name: "Gül" },
  { hex: "#6366f1", name: "Indigo" },
];

export default function SettingsClient({ tenant }: { tenant: any }) {
  const [activeTab, setActiveTab] = useState("company");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#2563eb");
  
  const [companyName, setCompanyName] = useState(tenant?.company_name || "Nobel Vize");
  const [subdomain, setSubdomain] = useState(tenant?.subdomain || "nobelvize");
  const [email, setEmail] = useState(tenant?.email || "");
  const [phone, setPhone] = useState(tenant?.phone || "");

  const handleSave = async () => {
    setSaving(true);
    
    const payload = {
      company_name: companyName,
      subdomain: subdomain,
      email: email,
      phone: phone,
      theme_color: selectedColor,
      updated_at: new Date().toISOString()
    };

    if (tenant?.id) {
      await supabase.from('tenants').update(payload).eq('id', tenant.id);
    } else {
      await supabase.from('tenants').insert([payload]);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex gap-6">
      {/* Tab List */}
      <div className="w-52 shrink-0 space-y-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-blue-600/15 border border-blue-500/30 text-blue-400"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 hover:bg-white/5 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <tab.icon className="w-4 h-4 shrink-0" />
              {tab.label}
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-40" />
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 space-y-5">
        {activeTab === "company" && (
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Şirket Bilgileri</h2>
              <p className="text-xs text-slate-500 mt-0.5">Bu bilgiler faturalar ve müşteri e-postalarında görünür.</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Şirket Adı</label>
                  <input
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Subdomain</label>
                  <div className="flex items-center">
                    <input
                      value={subdomain}
                      onChange={e => setSubdomain(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] border-r-0 rounded-l-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-all"
                    />
                    <span className="px-3 py-2.5 bg-slate-200 dark:bg-[#1f2937] border border-slate-200 dark:border-[#1f2937] rounded-r-xl text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">.antigravity.app</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">E-posta</label>
                  <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="info@nobelvize.com"
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Telefon</label>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+90 (212) 000 00 00"
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Plan info */}
              <div className="mt-4 p-4 rounded-xl bg-blue-600/10 border border-blue-500/20 flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-blue-400">Aktif Plan: PRO</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tüm özellikler aktif. Sonraki fatura: 15 Temmuz 2026.</p>
                </div>
                <button className="px-3 py-1.5 bg-slate-200 dark:bg-[#1f2937] hover:bg-[#2d3f55] text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors">
                  Planı Değiştir
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Görünüm & White-label Teması</h2>
              <p className="text-xs text-slate-500 mt-0.5">Login ekranı, raporlar ve müşteri bildirimleri bu temaya göre değişir.</p>
            </div>
            <div className="px-6 py-5 space-y-6">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 block">Ana Renk Teması</label>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map(c => (
                    <button
                      key={c.hex}
                      title={c.name}
                      onClick={() => setSelectedColor(c.hex)}
                      className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-110 ${
                        selectedColor === c.hex ? "border-white scale-110 shadow-lg" : "border-transparent opacity-70"
                      }`}
                      style={{ backgroundColor: c.hex, boxShadow: selectedColor === c.hex ? `0 0 12px ${c.hex}80` : undefined }}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-3">Seçilen: <span className="font-mono text-slate-700 dark:text-slate-300">{selectedColor}</span></p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937]">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Önizleme</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md" style={{ backgroundColor: selectedColor }}>
                    <Globe className="w-5 h-5 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{companyName}</p>
                    <p className="text-xs" style={{ color: selectedColor }}>CRM Sistemi</p>
                  </div>
                </div>
                <button className="mt-3 w-full py-2 text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-all" style={{ backgroundColor: selectedColor }}>
                  Giriş Yap →
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Bildirim Ayarları</h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-[#1f2937]">
              {[
                { label: "Yeni Müşteri Kaydı", desc: "Her yeni müşteri eklendiğinde e-posta al" },
                { label: "Evrak Tamamlandı", desc: "Bir müşteri evrakını yüklediğinde bildir" },
                { label: "Randevu Hatırlatması", desc: "Randevudan 24 saat önce hatırlatma gönder" },
                { label: "Ödeme Alındı", desc: "İyzico'dan ödeme geldiğinde e-posta ile bildir" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-slate-100 dark:bg-[#1a2232] transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                  <div className="w-10 h-6 bg-blue-600 rounded-full relative cursor-pointer shadow-[0_0_10px_rgba(37,99,235,0.4)]">
                    <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Güvenlik Ayarları</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mevcut Şifre</label>
                <input type="password" placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Yeni Şifre</label>
                <input type="password" placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Yeni Şifre (Tekrar)</label>
                <input type="password" placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                Şifreniz en az 8 karakter, bir büyük harf ve bir özel karakter içermelidir.
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? "Kaydediliyor..." : saved ? "Kaydedildi!" : "Değişiklikleri Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
