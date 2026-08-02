"use client"
import { useState } from "react";
import { Activity, Building2, Save, Shield, ChevronRight, Loader2, Check, AlertCircle, ClipboardList, Database, MessagesSquare, ScrollText, Info, BadgeCheck, ExternalLink } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import AuditLog from "@/components/AuditLog";
import BackupPanel from "@/components/BackupPanel";
import type { Tables } from "@/types/database";
import MessageTemplatesSettings from "@/components/MessageTemplatesSettings";
import PrivacyNoticeSettings from "@/components/PrivacyNoticeSettings";
import PrivacyLifecycleSettings from "@/components/PrivacyLifecycleSettings";
import OperationsPanel from "@/components/OperationsPanel";

const TABS = [
  { id: "company", label: "Şirket Bilgileri", icon: Building2 },
  { id: "messages", label: "Mesaj Şablonları", icon: MessagesSquare },
  { id: "privacy", label: "KVKK Metinleri", icon: ScrollText },
  { id: "security", label: "Güvenlik", icon: Shield },
  { id: "audit", label: "Sistem Log", icon: ClipboardList },
  { id: "operations", label: "Operasyon", icon: Activity },
  { id: "backup", label: "Veri Yedekleme", icon: Database },
];

const OFFICIAL_CONTACT_SOURCE_URL = "https://www.nobelvize.com/iletisim/";

type SettingsClientProps = {
  company: Tables<"tenants">;
  messageTemplates: Tables<"message_templates">[];
  privacyNotices: Tables<"privacy_notice_versions">[];
  privacySettings: Tables<"privacy_settings">;
  operationalEvents: Tables<"operational_events">[];
  backupRuns: Tables<"backup_runs">[];
  initialTab?: string;
};

export default function SettingsClient({
  company,
  messageTemplates,
  privacyNotices,
  privacySettings,
  operationalEvents,
  backupRuns,
  initialTab,
}: SettingsClientProps) {
  const supabase = createSupabaseBrowserClient();
  const [activeTab, setActiveTab] = useState(
    TABS.some(tab => tab.id === initialTab) ? initialTab ?? "company" : "company",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Company State
  const [companyName, setCompanyName] = useState(company.company_name);
  const [email, setEmail] = useState(company.email || "");
  const [phone, setPhone] = useState(company.phone || "");
  const [contactSourceUrl, setContactSourceUrl] = useState(company.contact_source_url);
  const [contactVerifiedAt, setContactVerifiedAt] = useState(company.contact_verified_at);

  // Security State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consultantMfaRequired, setConsultantMfaRequired] = useState(company.consultant_mfa_required);

  const handleSaveCompany = async () => {
    const normalizedCompanyName = companyName.trim();
    if (!normalizedCompanyName) throw new Error("Şirket adı boş bırakılamaz.");

    const { data, error } = await supabase.rpc("verify_company_contact_v1", {
      p_company_name: normalizedCompanyName,
      p_email: email,
      p_phone: phone,
      p_source_url: OFFICIAL_CONTACT_SOURCE_URL,
    });
    if (error) throw new Error(error.message);

    const verifiedContact = data?.[0];
    if (!verifiedContact) throw new Error("Şirket iletişim bilgileri doğrulanamadı.");

    setCompanyName(verifiedContact.company_name);
    setEmail(verifiedContact.email);
    setPhone(verifiedContact.phone);
    setContactSourceUrl(verifiedContact.contact_source_url);
    setContactVerifiedAt(verifiedContact.contact_verified_at);
  };

  const handleSaveSecurity = async () => {
    const { error: securitySettingsError } = await supabase.rpc("update_tenant_security_settings_v1", {
      p_consultant_mfa_required: consultantMfaRequired,
    });
    if (securitySettingsError) throw new Error(securitySettingsError.message);

    if (!currentPassword && !newPassword && !confirmPassword) return;
    if (!currentPassword) throw new Error("Mevcut şifrenizi girmelisiniz.");
    if (newPassword.length < 12) throw new Error("Yeni şifre en az 12 karakter olmalıdır.");
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
    await supabase.rpc("record_own_security_event_v1", {
      p_event_type: "password_changed",
      p_outcome: "success",
    });
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
              {!contactVerifiedAt && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-xs">
                    Şirket iletişim bilgileri henüz resmî kaynakla doğrulanmadı.
                    Kaydetme işlemi e-posta, telefon, kaynak ve doğrulama zamanını birlikte kaydeder.
                  </p>
                </div>
              )}
              {contactVerifiedAt && contactSourceUrl && (
                <div data-testid="company-contact-verification" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-emerald-800 dark:text-emerald-200">
                  <div className="flex items-start gap-3">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">Resmî kaynakla doğrulandı</p>
                      <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                        Son doğrulama: {new Date(contactVerifiedAt).toLocaleString("tr-TR")}
                      </p>
                    </div>
                  </div>
                  <a
                    href={contactSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2"
                  >
                    Kaynağı aç <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="company-name" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Şirket Adı</label>
                  <input
                    id="company-name"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="company-email" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">E-posta</label>
                  <input
                    id="company-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ornek@firma.com"
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="company-phone" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Telefon</label>
                  <input
                    id="company-phone"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0 (5XX) XXX XX XX"
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
              <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-[#1f2937]">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Rol bazlı MFA politikası</p>
                <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                  <span>Yöneticiler için zorunlu</span>
                  <input type="checkbox" checked disabled className="h-4 w-4 accent-blue-600" />
                </label>
                <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                  <span>Danışmanlar için zorunlu</span>
                  <input
                    type="checkbox"
                    checked={consultantMfaRequired}
                    onChange={event => setConsultantMfaRequired(event.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                </label>
                <p className="text-[10px] text-slate-500">Danışman politikası sonraki girişte uygulanır.</p>
              </div>
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
                Şifre değiştiriyorsanız en az 12 karakter kullanın. MFA ve cihaz yönetimi profil menüsündeki Hesap Güvenliği ekranındadır.
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

        {activeTab === "operations" && (
          <OperationsPanel initialEvents={operationalEvents} />
        )}

        {/* Backup Tab */}
        {activeTab === "backup" && (
          <BackupPanel initialRuns={backupRuns} />
        )}

        {/* Save Button */}
        {activeTab !== "audit" && activeTab !== "backup" && activeTab !== "messages" && activeTab !== "privacy" && activeTab !== "operations" && (
          <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? "Kaydediliyor..." : saved ? "Kaydedildi!" : activeTab === "company" ? "Doğrula ve Kaydet" : "Değişiklikleri Kaydet"}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
