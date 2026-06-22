"use client"
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Save, Trash2, Settings, Globe, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Country = {
  id: string;
  name: string;
  visa_system: string;
  base_fee: number;
  document_checklist: string[];
  appCount: number;
  docCount: number;
};

export default function CountriesManager({ initialCountries }: { initialCountries: Country[] }) {
  const [countries, setCountries] = useState<Country[]>(initialCountries);
  const [selected, setSelected] = useState<Country | null>(initialCountries[0] ?? null);
  const [saving, setSaving] = useState(false);
  const [newDocInput, setNewDocInput] = useState("");
  const router = useRouter();

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("countries")
      .update({
        name: selected.name,
        visa_system: selected.visa_system,
        base_fee: selected.base_fee,
        document_checklist: selected.document_checklist,
      })
      .eq("id", selected.id);

    if (!error) {
      setCountries(prev => prev.map(c => c.id === selected.id ? selected : c));
      router.refresh();
    } else {
      alert("Kaydetme hatası: " + error.message);
    }
    setSaving(false);
  };

  const addDoc = () => {
    if (!newDocInput.trim() || !selected) return;
    setSelected({ ...selected, document_checklist: [...selected.document_checklist, newDocInput.trim()] });
    setNewDocInput("");
  };

  const removeDoc = (idx: number) => {
    if (!selected) return;
    setSelected({ ...selected, document_checklist: selected.document_checklist.filter((_, i) => i !== idx) });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Country List */}
      <div className="lg:col-span-4 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl p-4 flex flex-col gap-2 shadow-lg">
        <h3 className="font-semibold mb-2 px-2 text-slate-900 dark:text-white flex items-center gap-2 text-sm">
          <Globe className="w-4 h-4 text-blue-400" /> Aktif Ülkeler
        </h3>
        <div className="space-y-1">
          {countries.map(c => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                selected?.id === c.id ? "bg-blue-600/10 border border-blue-500/30 text-slate-900 dark:text-white shadow-[0_0_10px_rgba(59,130,246,0.1)]" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:bg-[#1a2232] border border-transparent"
              }`}
            >
              <div>
                <p className="font-semibold text-sm">{c.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.visa_system}</p>
              </div>
              <div className="text-right space-y-1">
                <span className="block text-[10px] font-medium px-2 py-0.5 bg-slate-200 dark:bg-[#1f2937] text-slate-500 dark:text-slate-400 rounded-md">{c.docCount} Evrak</span>
                <span className="block text-[10px] text-slate-500">{c.appCount} Başvuru</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Config Panel */}
      {selected ? (
        <div className="lg:col-span-8 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-500 dark:text-slate-400" /> {selected.name} Yapılandırması
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ülke Adı</label>
              <input
                type="text"
                value={selected.name}
                onChange={e => setSelected({ ...selected, name: e.target.value })}
                className="w-full px-4 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vize Sistemi</label>
              <input
                type="text"
                value={selected.visa_system || ""}
                onChange={e => setSelected({ ...selected, visa_system: e.target.value })}
                className="w-full px-4 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Temel Ücret (₺)</label>
              <input
                type="number"
                value={selected.base_fee || ""}
                onChange={e => setSelected({ ...selected, base_fee: Number(e.target.value) })}
                className="w-full px-4 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Evrak Listesi</h3>
            <span className="text-xs text-slate-500">{selected.document_checklist.length} evrak</span>
          </div>

          <div className="space-y-2 mb-4">
            {selected.document_checklist.map((doc, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] group hover:border-slate-300 dark:border-[#2d3f55] transition-colors">
                <span className="text-sm text-slate-700 dark:text-slate-300">{doc}</span>
                <button onClick={() => removeDoc(i)} className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {selected.document_checklist.length === 0 && (
              <div className="text-center py-6 text-sm text-slate-500 border border-dashed border-slate-200 dark:border-[#1f2937] rounded-xl">Listede evrak yok.</div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newDocInput}
              onChange={e => setNewDocInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addDoc()}
              placeholder="Yeni evrak adı..."
              className="flex-1 px-4 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            <button
              onClick={addDoc}
              className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-[#1f2937] hover:bg-[#2d3f55] text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" /> Ekle
            </button>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-200 dark:border-[#1f2937] flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
            </button>
          </div>
        </div>
      ) : (
        <div className="lg:col-span-8 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl p-8 flex items-center justify-center text-slate-500 text-sm shadow-lg">
          Düzenlemek için sol taraftan bir ülke seçin.
        </div>
      )}
    </div>
  );
}
