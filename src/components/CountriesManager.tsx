"use client"
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Plus, Save, Trash2, Settings, Globe, Loader2, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { VISA_TYPE_LABELS, DOCUMENT_CATEGORIES } from "@/lib/visa-types";

type VisaRequirement = {
  id?: string;
  country_id: string;
  visa_type: string;
  documents: { name: string; required: boolean; category: string; description?: string }[];
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
  requirements: VisaRequirement[];
};

export default function CountriesManager({ initialCountries }: { initialCountries: Country[] }) {
  const [countries, setCountries] = useState<Country[]>(initialCountries);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(initialCountries[0] ?? null);
  const [activeTab, setActiveTab] = useState<string>("turistik");
  
  // Local state for the actively edited requirement
  // Initialize with the first country's requirement if available
  const [activeReq, setActiveReq] = useState<VisaRequirement | null>(() => {
    if (!initialCountries[0]) return null;
    const req = initialCountries[0].requirements.find(r => r.visa_type === "turistik");
    if (req) {
      let docs = req.documents;
      if (typeof docs === 'string') {
        try { docs = JSON.parse(docs); } catch (e) { docs = []; }
      }
      return { ...req, documents: Array.isArray(docs) ? docs : [] };
    }
    return {
      country_id: initialCountries[0].id,
      visa_type: "turistik",
      documents: [],
      processing_time: "",
      validity: "",
      max_stay: "",
      multiple_entry: true,
      notes: ""
    };
  });
  
  const [saving, setSaving] = useState(false);
  const [savingCountry, setSavingCountry] = useState(false);
  const router = useRouter();

  // Handle country selection and initialize active requirement
  const handleSelectCountry = (c: Country) => {
    setSelectedCountry(c);
    loadRequirement(c, "turistik");
    setActiveTab("turistik");
  };

  const handleTabChange = (type: string) => {
    setActiveTab(type);
    if (selectedCountry) {
      loadRequirement(selectedCountry, type);
    }
  };

  const loadRequirement = (country: Country, type: string) => {
    const existing = country.requirements.find(r => r.visa_type === type);
    if (existing) {
      const parsed = JSON.parse(JSON.stringify(existing));
      if (typeof parsed.documents === 'string') {
        try { parsed.documents = JSON.parse(parsed.documents); } catch(e) { parsed.documents = []; }
      }
      if (!Array.isArray(parsed.documents)) parsed.documents = [];
      setActiveReq(parsed);
    } else {
      setActiveReq({
        country_id: country.id,
        visa_type: type,
        documents: [],
        processing_time: "",
        validity: "",
        max_stay: "",
        multiple_entry: true,
        notes: ""
      });
    }
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

  const handleSaveRequirement = async () => {
    if (!activeReq || !selectedCountry) return;
    setSaving(true);

    const payload = {
      country_id: activeReq.country_id,
      visa_type: activeReq.visa_type,
      documents: activeReq.documents,
      processing_time: activeReq.processing_time || null,
      validity: activeReq.validity || null,
      max_stay: activeReq.max_stay || null,
      multiple_entry: activeReq.multiple_entry,
      notes: activeReq.notes || null,
    };

    let error;
    const supabase = createSupabaseBrowserClient();
    if (activeReq.id) {
      // Update
      const res = await supabase.from("country_visa_requirements").update(payload).eq("id", activeReq.id).select().single();
      error = res.error;
      if (!error && res.data) setActiveReq(res.data);
    } else {
      // Insert
      const res = await supabase.from("country_visa_requirements").insert([payload]).select().single();
      error = res.error;
      if (!error && res.data) setActiveReq(res.data);
    }

    if (!error) {
      // Update local state so tab switching doesn't lose it
      const updatedCountries = [...countries];
      const cIndex = updatedCountries.findIndex(c => c.id === selectedCountry.id);
      if (cIndex >= 0) {
        const reqIndex = updatedCountries[cIndex].requirements.findIndex(r => r.visa_type === activeReq.visa_type);
        if (reqIndex >= 0) {
          updatedCountries[cIndex].requirements[reqIndex] = activeReq as any;
        } else {
          updatedCountries[cIndex].requirements.push(activeReq as any);
        }
        setCountries(updatedCountries);
        setSelectedCountry(updatedCountries[cIndex]);
      }
      alert("Evrak listesi ve kurallar başarıyla kaydedildi.");
      router.refresh();
    } else {
      alert("Hata: " + error.message);
    }
    setSaving(false);
  };

  const addDoc = () => {
    if (!activeReq) return;
    setActiveReq({
      ...activeReq,
      documents: [...activeReq.documents, { name: "Yeni Evrak", required: true, category: "temel", description: "" }]
    });
  };

  const updateDoc = (index: number, field: string, value: any) => {
    if (!activeReq) return;
    const newDocs = [...activeReq.documents];
    newDocs[index] = { ...newDocs[index], [field]: value };
    setActiveReq({ ...activeReq, documents: newDocs });
  };

  const removeDoc = (index: number) => {
    if (!activeReq) return;
    setActiveReq({
      ...activeReq,
      documents: activeReq.documents.filter((_, i) => i !== index)
    });
  };

  // Group activeReq.documents by category for rendering
  const groupedDocs = activeReq?.documents.reduce((acc, doc, index) => {
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
                <p className="text-[10px] text-slate-500 mt-0.5">{c.requirements.length} Vize Türü</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Config Area */}
      {selectedCountry && activeReq ? (
        <div className="lg:col-span-9 flex flex-col gap-5">
          
          {/* Top: Country Core Settings */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl p-5 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" /> {selectedCountry.name} Ana Ayarları
              </h2>
              <button
                onClick={handleSaveCountry}
                disabled={savingCountry}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                {savingCountry ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Ülkeyi Kaydet
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Sistem</label>
                <input type="text" value={selectedCountry.visa_system || ""} onChange={e => setSelectedCountry({...selectedCountry, visa_system: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Randevu Sistemi</label>
                <input type="text" value={selectedCountry.appointment_system || ""} onChange={e => setSelectedCountry({...selectedCountry, appointment_system: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Vize Harcı</label>
                <input type="number" value={selectedCountry.base_fee_visa || ""} onChange={e => setSelectedCountry({...selectedCountry, base_fee_visa: Number(e.target.value)})} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Hizmet Bedeli</label>
                <input type="number" value={selectedCountry.base_fee_service || ""} onChange={e => setSelectedCountry({...selectedCountry, base_fee_service: Number(e.target.value)})} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs outline-none" />
              </div>
            </div>
          </div>

          {/* Visa Types Tabs */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl shadow-lg flex-1 flex flex-col overflow-hidden">
            
            {/* Tabs Header */}
            <div className="border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] overflow-x-auto custom-scrollbar flex">
              {Object.keys(VISA_TYPE_LABELS).map(type => {
                const hasData = selectedCountry.requirements.some(r => r.visa_type === type);
                return (
                  <button
                    key={type}
                    onClick={() => handleTabChange(type)}
                    className={`px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                      activeTab === type 
                        ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-[#0d1420]" 
                        : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    {VISA_TYPE_LABELS[type]} {hasData && <span className="ml-1 text-[10px] bg-blue-100 text-blue-600 px-1 rounded">Dolu</span>}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="p-5 flex-1 overflow-y-auto bg-slate-50/50 dark:bg-[#060d1a]/50">
              
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {VISA_TYPE_LABELS[activeTab]} Vizesi Gereksinimleri
                </h3>
                <button
                  onClick={handleSaveRequirement}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-blue-900/30"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {activeTab} Ayarlarını Kaydet
                </button>
              </div>

              {/* Requirement Meta Fields */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">İşlem Süresi</label>
                  <input type="text" placeholder="Örn: 10-15 İş Günü" value={activeReq.processing_time || ""} onChange={e => setActiveReq({...activeReq, processing_time: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Geçerlilik</label>
                  <input type="text" placeholder="Örn: 6 Ay" value={activeReq.validity || ""} onChange={e => setActiveReq({...activeReq, validity: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Maksimum Kalış</label>
                  <input type="text" placeholder="Örn: 90 Gün" value={activeReq.max_stay || ""} onChange={e => setActiveReq({...activeReq, max_stay: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none" />
                </div>
                <div className="space-y-1 flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-lg">
                    <input type="checkbox" checked={activeReq.multiple_entry} onChange={e => setActiveReq({...activeReq, multiple_entry: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Çoklu Giriş (Multiple)</span>
                  </label>
                </div>
              </div>

              {/* Documents Builder */}
              <div className="mb-4 flex justify-between items-end">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Evrak Listesi</h4>
                  <p className="text-[10px] text-slate-500">Müşterilerden istenecek belgeleri yönetin.</p>
                </div>
                <button
                  onClick={addDoc}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-lg transition-colors border border-emerald-600/20"
                >
                  <Plus className="w-3.5 h-3.5" /> Evrak Ekle
                </button>
              </div>

              {activeReq.documents.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] border-dashed rounded-xl">
                  <Info className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Bu vize türü için henüz evrak eklenmemiş.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.keys(DOCUMENT_CATEGORIES).map(catKey => {
                    const docsInCat = groupedDocs[catKey];
                    if (!docsInCat || docsInCat.length === 0) return null;

                    return (
                      <div key={catKey} className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-slate-100 dark:bg-[#1a2232] border-b border-slate-200 dark:border-[#1f2937]">
                          <h5 className="text-xs font-bold text-slate-700 dark:text-slate-200">{DOCUMENT_CATEGORIES[catKey]}</h5>
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
                                    <option key={k} value={k}>{DOCUMENT_CATEGORIES[k]}</option>
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
        </div>
      ) : (
        <div className="lg:col-span-9 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] border-dashed rounded-2xl flex flex-col items-center justify-center p-12 text-center text-slate-500">
          <Globe className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
          <p className="font-semibold text-slate-900 dark:text-slate-300">Ülke Seçilmedi</p>
          <p className="text-xs">Detaylarını ve evrak listesini düzenlemek için sol panelden bir ülke seçin.</p>
        </div>
      )}
    </div>
  );
}
