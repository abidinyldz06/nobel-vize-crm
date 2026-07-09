"use client"
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Plus, Save, Trash2, Settings, Globe, Loader2, Info, FileText, Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import { VISA_TYPE_LABELS, DOCUMENT_CATEGORIES } from "@/lib/visa-types";

// Dropdown options
const TRAVEL_METHODS = { "null": "Tümü", ucak: "Uçak", tur_paketi: "Tur Paketi", gemi: "Gemi", kendi_araci: "Kendi Aracı" };
const ACCOMMODATIONS = { "null": "Tümü", otel: "Otel", aile_arkadas: "Aile/Arkadaş Yanı", diger: "Diğer" };
const OCCUPATIONS = { "null": "Tümü", calisan: "Çalışan", memur: "Memur", emekli: "Emekli", ogrenci: "Öğrenci", issiz: "İşsiz", sirket_sahibi: "Şirket Sahibi" };
const WITH_CHILDREN = { "null": "Farketmez", "true": "Evet", "false": "Hayır" };
const NATIONALITIES = { "null": "Farketmez", tc: "TC Vatandaşı", diger: "Diğer" };

type VisaRule = {
  id?: string;
  country_id: string;
  visa_category: string;
  travel_method: string | null;
  accommodation: string | null;
  occupation: string | null;
  with_children: boolean | null;
  nationality: string | null;
  documents: any[];
  processing_time: string;
  validity: string;
  max_stay: string;
  multiple_entry: boolean;
  notes: string;
};

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

export default function CountriesManager({ initialCountries }: { initialCountries: Country[] }) {
  const [countries, setCountries] = useState<Country[]>(initialCountries);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(initialCountries[0] ?? null);
  const [mode, setMode] = useState<"genel" | "kurallar">("genel");
  const [savingCountry, setSavingCountry] = useState(false);
  const router = useRouter();

  // Rule Editor state
  const [editingRule, setEditingRule] = useState<VisaRule | null>(null);
  const [savingRule, setSavingRule] = useState(false);

  const handleSelectCountry = (c: Country) => {
    setSelectedCountry(c);
    setMode("genel");
    setEditingRule(null);
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
        base_fee_visa: selectedCountry.base_fee_visa || null,
        base_fee_service: selectedCountry.base_fee_service || null,
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
      notes: ""
    });
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
    };

    let error;
    const supabase = createSupabaseBrowserClient();
    if (editingRule.id) {
      const res = await supabase.from("country_visa_rules").update(payload).eq("id", editingRule.id).select().single();
      error = res.error;
      if (!error && res.data) {
        setEditingRule(null);
        updateLocalRule(res.data);
      }
    } else {
      const res = await supabase.from("country_visa_rules").insert([payload]).select().single();
      error = res.error;
      if (!error && res.data) {
        setEditingRule(null);
        updateLocalRule(res.data, true);
      }
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
    const { error } = await supabase.from("country_visa_rules").delete().eq("id", id);
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

  const updateDoc = (index: number, field: string, value: any) => {
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

  const groupedDocs = editingRule?.documents?.reduce((acc, doc, index) => {
    const cat = doc.category || 'diger';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push({ ...doc, originalIndex: index });
    return acc;
  }, {} as Record<string, any[]>) || {};

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
            <button onClick={() => { setMode("genel"); setEditingRule(null); }} className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${mode === "genel" ? "bg-white dark:bg-[#1f2937] shadow text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
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
                        <th className="p-3 font-semibold rounded-tr-lg text-right">Aksiyon</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1f2937]">
                      {selectedCountry.rules.map(rule => (
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
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditingRule(rule)} className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-md transition-colors">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteRule(rule.id!)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
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
                  <button onClick={() => setEditingRule(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-[#1f2937] rounded-lg transition-colors">
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
                            {docsInCat.map((doc: any) => (
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
