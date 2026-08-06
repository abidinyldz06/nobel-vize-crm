"use client"
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Plus, Save, Trash2, Settings, Globe, Loader2, Info, FileText, Edit, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { VISA_TYPE_LABELS, DOCUMENT_CATEGORIES } from "@/lib/visa-types";
import {
  getVisaRuleSourceStatus,
  parseVisaRuleSources,
  VISA_RULE_SOURCE_STATUS_LABELS,
  type VisaRuleSource,
} from "@/lib/visa-rule-sources";
import type { Json, Tables } from "@/types/database";

// Dropdown options
const TRAVEL_METHODS = { "null": "Tümü", ucak: "Uçak", tur_paketi: "Tur Paketi", gemi: "Gemi", kendi_araci: "Kendi Aracı" };
const ACCOMMODATIONS = { "null": "Tümü", otel: "Otel", aile_arkadas: "Aile/Arkadaş Yanı", diger: "Diğer" };
const OCCUPATIONS = { "null": "Tümü", calisan: "Çalışan", memur: "Memur", emekli: "Emekli", ogrenci: "Öğrenci", issiz: "İşsiz", sirket_sahibi: "Şirket Sahibi" };
const WITH_CHILDREN = { "null": "Farketmez", "true": "Evet", "false": "Hayır" };
const NATIONALITIES = { "null": "Farketmez", tc: "TC Vatandaşı", diger: "Diğer" };

type VisaDocumentRule = {
  name: string;
  required: boolean;
  category: string;
  description?: string;
};

type VisaRule = {
  id?: string;
  country_id: string;
  visa_category: string;
  travel_method: string | null;
  accommodation: string | null;
  occupation: string | null;
  with_children: boolean | null;
  nationality: string | null;
  documents: VisaDocumentRule[];
  processing_time: string | null;
  validity: string | null;
  max_stay: string | null;
  multiple_entry: boolean;
  notes: string | null;
  sources: VisaRuleSource[];
  sources_last_reviewed_at: string | null;
  sources_reviewed_by_staff_id: string | null;
};

function parseDocuments(value: Json): VisaDocumentRule[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const name = typeof entry.name === "string" ? entry.name : "";
    if (!name) return [];
    return [{
      name,
      required: entry.required !== false,
      category: typeof entry.category === "string" ? entry.category : "diger",
      description: typeof entry.description === "string" ? entry.description : "",
    }];
  });
}

function toVisaRule(rule: Tables<'country_visa_rules'>): VisaRule {
  return {
    ...rule,
    documents: parseDocuments(rule.documents),
    sources: parseVisaRuleSources(rule.sources),
  };
}

const SOURCE_STATUS_STYLES = {
  verified: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  review_due: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
  secondary: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  review_pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  unverified: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20",
} as const;

type Country = {
  id: string;
  name: string;
  visa_system: string;
  appointment_system: string;
  base_fee_visa: number;
  base_fee_service: number;
  active: boolean;
  notes: string;
  appCount: number;
  rules: VisaRule[];
};

type InitialCountry = Tables<'countries'> & {
  appCount: number;
  rules: Tables<'country_visa_rules'>[];
};

function toCountry(country: InitialCountry): Country {
  return {
    ...country,
    visa_system: country.visa_system ?? "",
    appointment_system: country.appointment_system ?? "",
    notes: country.notes ?? "",
    rules: country.rules.map(toVisaRule),
  };
}

export default function CountriesManager({ initialCountries }: { initialCountries: InitialCountry[] }) {
  const normalizedInitialCountries = initialCountries.map(toCountry);
  const [countries, setCountries] = useState<Country[]>(normalizedInitialCountries);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(normalizedInitialCountries[0] ?? null);
  const [mode, setMode] = useState<"genel" | "kurallar">("genel");
  const [savingCountry, setSavingCountry] = useState(false);
  const router = useRouter();

  // Rule Editor state
  const [editingRule, setEditingRule] = useState<VisaRule | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [confirmSources, setConfirmSources] = useState(false);

  const handleSelectCountry = (c: Country) => {
    setSelectedCountry(c);
    setMode("genel");
    setEditingRule(null);
    setConfirmSources(false);
  };

  const handleSaveCountry = async () => {
    if (!selectedCountry) return;
    setSavingCountry(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("countries")
      .update({
        name: selectedCountry.name,
        visa_system: selectedCountry.visa_system,
        appointment_system: selectedCountry.appointment_system,
        base_fee_visa: selectedCountry.base_fee_visa || 0,
        base_fee_service: selectedCountry.base_fee_service || 0,
        active: selectedCountry.active,
        notes: selectedCountry.notes
      })
      .eq("id", selectedCountry.id);

    if (!error) {
      setCountries(prev => prev.map(c => c.id === selectedCountry.id ? selectedCountry : c));
      router.refresh();
      alert("Ülke ana ayarları kaydedildi.");
    } else {
      alert("Hata: " + error.message);
    }
    setSavingCountry(false);
  };

  const openNewRule = () => {
    if (!selectedCountry) return;
    setEditingRule({
      country_id: selectedCountry.id,
      visa_category: "turistik",
      travel_method: null,
      accommodation: null,
      occupation: null,
      with_children: null,
      nationality: null,
      documents: [],
      processing_time: "",
      validity: "",
      max_stay: "",
      multiple_entry: true,
      notes: "",
      sources: [],
      sources_last_reviewed_at: null,
      sources_reviewed_by_staff_id: null,
    });
    setConfirmSources(false);
  };

  const openExistingRule = (rule: VisaRule) => {
    setEditingRule(rule);
    setConfirmSources(false);
  };

  const handleSaveRule = async () => {
    if (!editingRule || !selectedCountry) return;
    setSavingRule(true);

    const payload = {
      country_id: editingRule.country_id,
      visa_category: editingRule.visa_category,
      travel_method: editingRule.travel_method === "null" ? null : editingRule.travel_method,
      accommodation: editingRule.accommodation === "null" ? null : editingRule.accommodation,
      occupation: editingRule.occupation === "null" ? null : editingRule.occupation,
      with_children: editingRule.with_children === null ? null : (editingRule.with_children.toString() === "true"),
      nationality: editingRule.nationality === "null" ? null : editingRule.nationality,
      documents: editingRule.documents,
      processing_time: editingRule.processing_time || null,
      validity: editingRule.validity || null,
      max_stay: editingRule.max_stay || null,
      multiple_entry: editingRule.multiple_entry,
      notes: editingRule.notes || null,
      sources: editingRule.sources,
    };

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("save_country_visa_rule_v1", {
      ...(editingRule.id ? { p_rule_id: editingRule.id } : {}),
      p_payload: payload,
      p_confirm_sources: confirmSources,
    });

    if (!error && data) {
      setEditingRule(null);
      setConfirmSources(false);
      updateLocalRule(toVisaRule(data), !editingRule.id);
    }

    if (!error) {
      alert("Kural başarıyla kaydedildi.");
      router.refresh();
    } else {
      if (error.code === '23505') {
        alert("Hata: Bu kriterlere sahip bir kural zaten mevcut! (Aynı eşleşmeye sahip ikinci bir kural ekleyemezsiniz)");
      } else {
        alert("Hata: " + error.message);
      }
    }
    setSavingRule(false);
  };

  const handleDeleteRule = async (id: string) => {
    if(!confirm("Bu kuralı silmek istediğinize emin misiniz?")) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("delete_country_visa_rule_v1", { p_rule_id: id });
    if (!error) {
      const updatedCountries = [...countries];
      const cIndex = updatedCountries.findIndex(c => c.id === selectedCountry?.id);
      if (cIndex >= 0) {
        updatedCountries[cIndex].rules = updatedCountries[cIndex].rules.filter(r => r.id !== id);
        setCountries(updatedCountries);
        setSelectedCountry(updatedCountries[cIndex]);
      }
      router.refresh();
    } else {
      alert("Silinirken hata oluştu: " + error.message);
    }
  };

  const updateLocalRule = (rule: VisaRule, isNew = false) => {
    if (!selectedCountry) return;
    const updatedCountries = [...countries];
    const cIndex = updatedCountries.findIndex(c => c.id === selectedCountry.id);
    if (cIndex >= 0) {
      if (isNew) {
        if(!updatedCountries[cIndex].rules) updatedCountries[cIndex].rules = [];
        updatedCountries[cIndex].rules.push(rule);
      } else {
        const rIndex = updatedCountries[cIndex].rules.findIndex(r => r.id === rule.id);
        if (rIndex >= 0) updatedCountries[cIndex].rules[rIndex] = rule;
      }
      setCountries(updatedCountries);
      setSelectedCountry(updatedCountries[cIndex]);
    }
  };

  // Rule Editor Document logic
  const addDoc = () => {
    if (!editingRule) return;
    setEditingRule({
      ...editingRule,
      documents: [...(editingRule.documents || []), { name: "Yeni Evrak", required: true, category: "temel", description: "" }]
    });
  };

  const updateDoc = <K extends keyof VisaDocumentRule>(index: number, field: K, value: VisaDocumentRule[K]) => {
    if (!editingRule) return;
    const newDocs = [...editingRule.documents];
    newDocs[index] = { ...newDocs[index], [field]: value };
    setEditingRule({ ...editingRule, documents: newDocs });
  };

  const removeDoc = (index: number) => {
    if (!editingRule) return;
    setEditingRule({
      ...editingRule,
      documents: editingRule.documents.filter((_, i) => i !== index)
    });
  };

  const addSource = () => {
    if (!editingRule) return;
    const reviewDate = new Date();
    reviewDate.setDate(reviewDate.getDate() + 90);
    setEditingRule({
      ...editingRule,
      sources: [...editingRule.sources, {
        title: "Yeni Kaynak",
        url: "https://",
        kind: "official",
        review_due_at: reviewDate.toISOString().slice(0, 10),
      }],
    });
    setConfirmSources(false);
  };

  const updateSource = <K extends keyof VisaRuleSource>(
    index: number,
    field: K,
    value: VisaRuleSource[K],
  ) => {
    if (!editingRule) return;
    const sources = [...editingRule.sources];
    sources[index] = { ...sources[index], [field]: value };
    delete sources[index].checked_at;
    setEditingRule({ ...editingRule, sources });
    setConfirmSources(false);
  };

  const removeSource = (index: number) => {
    if (!editingRule) return;
    setEditingRule({
      ...editingRule,
      sources: editingRule.sources.filter((_, sourceIndex) => sourceIndex !== index),
    });
    setConfirmSources(false);
  };

  const groupedDocs = editingRule?.documents?.reduce((acc, doc, index) => {
    const cat = doc.category || 'diger';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push({ ...doc, originalIndex: index });
    return acc;
  }, {} as Record<string, Array<VisaDocumentRule & { originalIndex: number }>>) || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Country List - Left Panel */}
      <div className="lg:col-span-3 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl p-4 flex flex-col gap-2 shadow-lg h-[calc(100vh-120px)] overflow-y-auto">
        <h3 className="font-semibold mb-2 px-2 text-slate-900 dark:text-white flex items-center gap-2 text-sm">
          <Globe className="w-4 h-4 text-blue-400" /> Ülkeler
        </h3>
        <div className="space-y-1">
          {countries.map(c => (
            <button
              key={c.id}
              onClick={() => handleSelectCountry(c)}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                selectedCountry?.id === c.id ? "bg-blue-600/10 border border-blue-500/30 text-slate-900 dark:text-white shadow-[0_0_10px_rgba(59,130,246,0.1)]" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:bg-[#1a2232] border border-transparent"
              }`}
            >
              <div>
                <p className="font-semibold text-sm">{c.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{c.rules?.length || 0} Kural</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Config Area */}
      {selectedCountry ? (
        <div className="lg:col-span-9 flex flex-col gap-5">
          
          {/* Mode Tabs */}
          <div className="flex bg-slate-100 dark:bg-[#0a101a] p-1 rounded-xl w-fit">
            <button onClick={() => { setMode("genel"); setEditingRule(null); setConfirmSources(false); }} className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${mode === "genel" ? "bg-white dark:bg-[#1f2937] shadow text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              Genel Ayarlar
            </button>
            <button onClick={() => setMode("kurallar")} className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${mode === "kurallar" ? "bg-white dark:bg-[#1f2937] shadow text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              Evrak Kuralları
            </button>
          </div>

          {mode === "genel" && (
            <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl p-5 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-500" /> {selectedCountry.name} Ana Ayarları
                </h2>
                <button onClick={handleSaveCountry} disabled={savingCountry} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
                  {savingCountry ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Ülkeyi Kaydet
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Sistem</label>
                  <input type="text" value={selectedCountry.visa_system || ""} onChange={e => setSelectedCountry({...selectedCountry, visa_system: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Randevu Sistemi</label>
                  <input type="text" value={selectedCountry.appointment_system || ""} onChange={e => setSelectedCountry({...selectedCountry, appointment_system: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Vize Harcı</label>
                  <input type="number" value={selectedCountry.base_fee_visa || ""} onChange={e => setSelectedCountry({...selectedCountry, base_fee_visa: Number(e.target.value)})} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Hizmet Bedeli</label>
                  <input type="number" value={selectedCountry.base_fee_service || ""} onChange={e => setSelectedCountry({...selectedCountry, base_fee_service: Number(e.target.value)})} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
          )}

          {mode === "kurallar" && !editingRule && (
            <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl p-5 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" /> {selectedCountry.name} Evrak Kuralları
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Kosmosvize mantığıyla, farklı müşteri profilleri için dinamik evrak listeleri tanımlayın.</p>
                </div>
                <button onClick={openNewRule} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/20">
                  <Plus className="w-3.5 h-3.5" /> Yeni Kural Ekle
                </button>
              </div>

              {(!selectedCountry.rules || selectedCountry.rules.length === 0) ? (
                <div className="text-center py-10 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                  <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-semibold">Henüz kural eklenmemiş</p>
                  <p className="text-xs text-slate-500 mt-1">Bu ülke için bir evrak kuralı ekleyerek başlayın.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#1a2232] text-slate-500 dark:text-slate-400">
                        <th className="p-3 font-semibold rounded-tl-lg">Kategori</th>
                        <th className="p-3 font-semibold">Seyahat / Konaklama</th>
                        <th className="p-3 font-semibold">Profil (Meslek/Çocuk/Uyruk)</th>
                        <th className="p-3 font-semibold">Evraklar</th>
                        <th className="p-3 font-semibold">Kaynak Durumu</th>
                        <th className="p-3 font-semibold rounded-tr-lg text-right">Aksiyon</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1f2937]">
                      {selectedCountry.rules.map(rule => {
                        const sourceStatus = getVisaRuleSourceStatus(rule.sources);
                        return (
                        <tr key={rule.id} className="hover:bg-slate-50 dark:hover:bg-[#151b28] transition-colors group border-b border-slate-100 dark:border-[#1f2937] last:border-0">
                          <td className="p-3 font-semibold text-slate-700 dark:text-slate-200">
                            {VISA_TYPE_LABELS[rule.visa_category as keyof typeof VISA_TYPE_LABELS] || rule.visa_category}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-slate-600 dark:text-slate-400 font-medium">Araç: <span className="font-normal">{TRAVEL_METHODS[rule.travel_method as keyof typeof TRAVEL_METHODS || "null"]}</span></span>
                              <span className="text-slate-600 dark:text-slate-400 font-medium">Otel: <span className="font-normal">{ACCOMMODATIONS[rule.accommodation as keyof typeof ACCOMMODATIONS || "null"]}</span></span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-slate-600 dark:text-slate-400 font-medium">Meslek: <span className="font-normal">{OCCUPATIONS[rule.occupation as keyof typeof OCCUPATIONS || "null"]}</span></span>
                              <span className="text-slate-600 dark:text-slate-400 font-medium text-[10px]">
                                Çocuk: <span className="font-normal">{WITH_CHILDREN[(rule.with_children === null ? "null" : rule.with_children.toString()) as keyof typeof WITH_CHILDREN]}</span> • 
                                Uyruk: <span className="font-normal">{NATIONALITIES[rule.nationality as keyof typeof NATIONALITIES || "null"]}</span>
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">
                            <span className="px-2 py-1 bg-slate-100 dark:bg-[#1a2232] rounded text-[10px] font-semibold">{rule.documents?.length || 0} Evrak</span>
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex px-2 py-1 rounded border text-[10px] font-semibold ${SOURCE_STATUS_STYLES[sourceStatus]}`}>
                              {VISA_RULE_SOURCE_STATUS_LABELS[sourceStatus]}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button aria-label="Kuralı düzenle" onClick={() => openExistingRule(rule)} className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-md transition-colors">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button aria-label="Kuralı sil" onClick={() => handleDeleteRule(rule.id!)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Rule Editor Modal/Panel */}
          {mode === "kurallar" && editingRule && (
            <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-500" /> Kural Düzenleyici
                </h3>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingRule(null); setConfirmSources(false); }} className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-[#1f2937] rounded-lg transition-colors">
                    İptal
                  </button>
                  <button onClick={handleSaveRule} disabled={savingRule} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
                    {savingRule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Kaydet
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50 dark:bg-[#060d1a] p-4 rounded-xl border border-slate-200 dark:border-[#1f2937]">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Vize Kategorisi *</label>
                    <select value={editingRule.visa_category} onChange={e => setEditingRule({...editingRule, visa_category: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500">
                      {Object.keys(VISA_TYPE_LABELS).map(k => <option key={k} value={k}>{VISA_TYPE_LABELS[k as keyof typeof VISA_TYPE_LABELS]}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Seyahat Aracı</label>
                    <select value={editingRule.travel_method || "null"} onChange={e => setEditingRule({...editingRule, travel_method: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500">
                      {Object.entries(TRAVEL_METHODS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Konaklama Tipi</label>
                    <select value={editingRule.accommodation || "null"} onChange={e => setEditingRule({...editingRule, accommodation: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500">
                      {Object.entries(ACCOMMODATIONS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Meslek</label>
                    <select value={editingRule.occupation || "null"} onChange={e => setEditingRule({...editingRule, occupation: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500">
                      {Object.entries(OCCUPATIONS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Çocuklu Mu?</label>
                    <select value={editingRule.with_children === null ? "null" : editingRule.with_children.toString()} onChange={e => setEditingRule({...editingRule, with_children: e.target.value === "null" ? null : e.target.value === "true"})} className="w-full px-3 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500">
                      {Object.entries(WITH_CHILDREN).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Uyruk</label>
                    <select value={editingRule.nationality || "null"} onChange={e => setEditingRule({...editingRule, nationality: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500">
                      {Object.entries(NATIONALITIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>

                {/* Meta details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">İşlem Süresi</label>
                    <input type="text" placeholder="Örn: 10-15 İş Günü" value={editingRule.processing_time || ""} onChange={e => setEditingRule({...editingRule, processing_time: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Geçerlilik</label>
                    <input type="text" placeholder="Örn: 6 Ay" value={editingRule.validity || ""} onChange={e => setEditingRule({...editingRule, validity: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Maksimum Kalış</label>
                    <input type="text" placeholder="Örn: 90 Gün" value={editingRule.max_stay || ""} onChange={e => setEditingRule({...editingRule, max_stay: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500" />
                  </div>
                  <div className="space-y-1 flex flex-col justify-end">
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-lg transition-colors">
                      <input type="checkbox" checked={editingRule.multiple_entry} onChange={e => setEditingRule({...editingRule, multiple_entry: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Çoklu Giriş (Multiple)</span>
                    </label>
                  </div>
                </div>

                {/* Source verification */}
                <div className="mb-6 p-4 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Kaynak ve Doğrulama</h4>
                        {(() => {
                          const status = getVisaRuleSourceStatus(editingRule.sources);
                          return (
                            <span className={`inline-flex px-2 py-1 rounded border text-[10px] font-semibold ${SOURCE_STATUS_STYLES[status]}`}>
                              {VISA_RULE_SOURCE_STATUS_LABELS[status]}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Konsolosluk/başvuru merkezi için “Resmî”, danışmanlık siteleri için “İkincil” seçin.
                      </p>
                    </div>
                    <button onClick={addSource} type="button" className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-lg border border-blue-600/20">
                      <Plus className="w-3.5 h-3.5" /> Kaynak Ekle
                    </button>
                  </div>

                  {editingRule.sources.length === 0 ? (
                    <div className="p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-500 text-center">
                      Bu kuralın kaynağı henüz kayıtlı değil.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {editingRule.sources.map((source, sourceIndex) => (
                        <div key={`${source.url}-${sourceIndex}`} className="grid grid-cols-12 gap-3 p-3 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg">
                          <div className="col-span-12 md:col-span-4 space-y-1">
                            <label className="text-[9px] text-slate-400 font-semibold uppercase">Kaynak Başlığı</label>
                            <input aria-label="Kaynak Başlığı" value={source.title} onChange={event => updateSource(sourceIndex, "title", event.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-md text-xs outline-none focus:border-blue-500" />
                          </div>
                          <div className="col-span-12 md:col-span-4 space-y-1">
                            <label className="text-[9px] text-slate-400 font-semibold uppercase">HTTPS Adresi</label>
                            <div className="flex gap-1">
                              <input aria-label="HTTPS Adresi" value={source.url} onChange={event => updateSource(sourceIndex, "url", event.target.value)} className="min-w-0 flex-1 px-2 py-1.5 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-md text-xs outline-none focus:border-blue-500" />
                              {source.url.startsWith("https://") && (
                                <a href={source.url} target="_blank" rel="noreferrer" aria-label="Kaynağı yeni sekmede aç" className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-md">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="col-span-6 md:col-span-2 space-y-1">
                            <label className="text-[9px] text-slate-400 font-semibold uppercase">Kaynak Türü</label>
                            <select aria-label="Kaynak Türü" value={source.kind} onChange={event => updateSource(sourceIndex, "kind", event.target.value as VisaRuleSource["kind"])} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-md text-xs outline-none focus:border-blue-500">
                              <option value="official">Resmî</option>
                              <option value="secondary">İkincil</option>
                            </select>
                          </div>
                          <div className="col-span-5 md:col-span-2 space-y-1">
                            <label className="text-[9px] text-slate-400 font-semibold uppercase">Yeniden Kontrol</label>
                            <input aria-label="Yeniden Kontrol" type="date" value={source.review_due_at || ""} onChange={event => updateSource(sourceIndex, "review_due_at", event.target.value || undefined)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-md text-xs outline-none focus:border-blue-500" />
                          </div>
                          <div className="col-span-1 flex items-end justify-end">
                            <button type="button" onClick={() => removeSource(sourceIndex)} aria-label="Kaynağı kaldır" className="p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-500 rounded-md">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="col-span-12 text-[10px] text-slate-500">
                            {source.checked_at
                              ? `Son kontrol: ${new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(source.checked_at))}`
                              : "Bu kaynak henüz doğrulanmadı."}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <label className={`mt-4 flex items-start gap-2 p-3 rounded-lg border ${editingRule.sources.length === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer bg-emerald-500/5 border-emerald-500/20"}`}>
                    <input
                      type="checkbox"
                      disabled={editingRule.sources.length === 0}
                      checked={confirmSources}
                      onChange={event => setConfirmSources(event.target.checked)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      <strong>Kaynakları şimdi kontrol ettim.</strong> İşaretlenirse kontrol zamanı ve yönetici audit kaydı birlikte yazılır. Kural içeriği değişip bu kutu işaretlenmezse eski doğrulama otomatik kaldırılır.
                    </span>
                  </label>
                </div>

                {/* Documents Builder */}
                <div className="mb-4 flex justify-between items-end">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Evrak Listesi</h4>
                    <p className="text-[10px] text-slate-500">Bu kurala uyan müşterilerden istenecek belgeler.</p>
                  </div>
                  <button onClick={addDoc} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-lg transition-colors border border-emerald-600/20">
                    <Plus className="w-3.5 h-3.5" /> Evrak Ekle
                  </button>
                </div>

                {(!editingRule.documents || editingRule.documents.length === 0) ? (
                  <div className="text-center py-10 bg-slate-50 dark:bg-[#0a101a] border border-slate-200 dark:border-[#1f2937] border-dashed rounded-xl">
                    <Info className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Bu kural için henüz evrak eklenmemiş.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.keys(DOCUMENT_CATEGORIES).map(catKey => {
                      const docsInCat = groupedDocs[catKey];
                      if (!docsInCat || docsInCat.length === 0) return null;

                      return (
                        <div key={catKey} className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl overflow-hidden shadow-sm">
                          <div className="px-4 py-2 bg-slate-100 dark:bg-[#1a2232] border-b border-slate-200 dark:border-[#1f2937]">
                            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-200">{DOCUMENT_CATEGORIES[catKey as keyof typeof DOCUMENT_CATEGORIES]}</h5>
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-[#1f2937]">
                            {docsInCat.map((doc) => (
                              <div key={doc.originalIndex} className="p-3 grid grid-cols-12 gap-3 items-start group hover:bg-slate-50 dark:hover:bg-[#151b28] transition-colors">
                                <div className="col-span-12 md:col-span-4 space-y-1">
                                  <label className="text-[9px] text-slate-400 font-semibold uppercase">Evrak Adı</label>
                                  <input type="text" value={doc.name} onChange={e => updateDoc(doc.originalIndex, "name", e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-md text-xs font-semibold outline-none focus:border-blue-500" />
                                </div>
                                <div className="col-span-12 md:col-span-5 space-y-1">
                                  <label className="text-[9px] text-slate-400 font-semibold uppercase">Açıklama / Detay</label>
                                  <input type="text" value={doc.description || ""} onChange={e => updateDoc(doc.originalIndex, "description", e.target.value)} placeholder="Opsiyonel detay" className="w-full px-2 py-1.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-md text-xs outline-none focus:border-blue-500" />
                                </div>
                                <div className="col-span-6 md:col-span-2 space-y-1">
                                  <label className="text-[9px] text-slate-400 font-semibold uppercase">Kategori</label>
                                  <select value={doc.category} onChange={e => updateDoc(doc.originalIndex, "category", e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-md text-xs outline-none focus:border-blue-500">
                                    {Object.keys(DOCUMENT_CATEGORIES).map(k => (
                                      <option key={k} value={k}>{DOCUMENT_CATEGORIES[k as keyof typeof DOCUMENT_CATEGORIES]}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="col-span-6 md:col-span-1 flex items-center justify-between h-full pt-4">
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" checked={doc.required} onChange={e => updateDoc(doc.originalIndex, "required", e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                    <span className="text-[10px] text-slate-500">Zorunlu</span>
                                  </label>
                                  <button onClick={() => removeDoc(doc.originalIndex)} className="p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-500 rounded-md transition-all opacity-0 group-hover:opacity-100">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="lg:col-span-9 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] border-dashed rounded-2xl flex flex-col items-center justify-center p-12 text-center text-slate-500">
          <Globe className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
          <p className="font-semibold text-slate-900 dark:text-slate-300">Ülke Seçilmedi</p>
          <p className="text-xs">Detaylarını ve evrak kurallarını düzenlemek için sol panelden bir ülke seçin.</p>
        </div>
      )}
    </div>
  );
}
