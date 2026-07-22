"use client"
import { useState } from "react";
import { Building2, Save, Shield, ChevronRight, Loader2, Check, AlertCircle, ClipboardList, Database, MessagesSquare, ScrollText } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import AuditLog from "@/components/AuditLog";
import BackupPanel from "@/components/BackupPanel";
import type { Tables, TablesUpdate } from "@/types/database";
import MessageTemplatesSettings from "@/components/MessageTemplatesSettings";
import PrivacyNoticeSettings from "@/components/PrivacyNoticeSettings";
import PrivacyLifecycleSettings from "@/components/PrivacyLifecycleSettings";

const TABS = [
  { id: "company", label: "Şirket Bilgileri", icon: Building2 },
  { id: "messages", label: "Mesaj Şablonları", icon: MessagesSquare },
  { id: "privacy", label: "KVKK Metinleri", icon: ScrollText },
  { id: "security", label: "Güvenlik", icon: Shield },
  { id: "audit", label: "Sistem Log", icon: ClipboardList },
  { id: "backup", label: "Veri Yedekleme", icon: Database },
];

export default function SettingsClient({ company, messageTemplates, privacyNotices, privacySettings }: { company: Tables<'tenants'>; messageTemplates: Tables<'message_templates'>[]; privacyNotices: Tables<'privacy_notice_versions'>[]; privacySettings: Tables<'privacy_settings'> }) {
  const supabase = createSupabaseBrowserClient();
  const [activeTab, setActiveTab] = useState("company");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Company State
  const [companyName, setCompanyName] = useState(company.company_name);
  const [email, setEmail] = useState(company.email || "");
  const [phone, setPhone] = useState(company.phone || "");

  // Security State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const saveCompanyData = async (payload: TablesUpdate<'tenants'>) => {
    const { error } = await supabase.from('tenants').update(payload).eq('id', company.id);
    if (error) throw new Error(error.message);
  };

  const handleSaveCompany = async () => {
    const normalizedCompanyName = companyName.trim();
    if (!normalizedCompanyName) throw new Error("Şirket adı boş bırakılamaz.");

    await saveCompanyData({
      company_name: normalizedCompanyName,
      email: email.trim() || null,
      phone: phone.trim() || null,
    });
    setCompanyName(normalizedCompanyName);
  };

  const handleSaveSecurity = async () => {
    if (!currentPassword) throw new Error("Mevcut şifrenizi girmelisiniz.");
    if (newPassword.length < 6) throw new Error("Yeni şifre en az 6 karakter olmalıdır.");
    if (newPassword !== confirmPassword) throw new Error("Yeni şifreler eşleşmiyor.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) throw new Error("Kullanıcı bilgisi alınamadı.");

    // Mevcut şifreyi doğrula
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      throw new Error("Mevcut şifre hatalı.");
    }

    // Şifreyi güncelle
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      throw new Error("Şifre güncellenirken bir hata oluştu: " + updateError.message);
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSaved(false);
    
    try {
      if (activeTab === "company") {
        await handleSaveCompany();
      } else if (activeTab === "security") {
        await handleSaveSecurity();
      }
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Kaydetme işlemi başarısız oldu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Tab List */}
      <div className="w-full md:w-52 shrink-0 space-y-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setErrorMsg(null); setSaved(false); }}
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
        
        {/* Hata ve Başarı Mesajları */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-500">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{errorMsg}</p>
          </div>
        )}
        {saved && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-emerald-500">
            <Check className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">Değişiklikler başarıyla kaydedildi!</p>
          </div>
        )}

        {/* Company Tab */}
        {activeTab === "company" && (
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Şirket Bilgileri</h2>
              <p className="text-xs text-slate-500 mt-0.5">Nobel Vize tek şirket kaydı ve iletişim bilgileri.</p>
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

            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Güvenlik Ayarları</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mevcut Şifre</label>
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Yeni Şifre</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Yeni Şifre (Tekrar)</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" 
                />
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                Şifreniz en az 6 karakter olmalıdır. Şifrenizi güvenli tutmak için güçlü bir kombinasyon seçin.
              </div>
            </div>
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === "audit" && (
          <AuditLog />
        )}

        {activeTab === "messages" && (
          <MessageTemplatesSettings initialTemplates={messageTemplates} />
        )}

        {activeTab === "privacy" && (
          <div className="space-y-5"><PrivacyLifecycleSettings settings={privacySettings} /><PrivacyNoticeSettings initialNotices={privacyNotices} /></div>
        )}

        {/* Backup Tab */}
        {activeTab === "backup" && (
          <BackupPanel />
        )}

        {/* Save Button */}
        {activeTab !== "audit" && activeTab !== "backup" && activeTab !== "messages" && activeTab !== "privacy" && (
          <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? "Kaydediliyor..." : saved ? "Kaydedildi!" : "Değişiklikleri Kaydet"}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
