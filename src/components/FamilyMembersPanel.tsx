"use client"
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { Users, Plus, X, Loader2, Trash2 } from "lucide-react";

export default function FamilyMembersPanel({ customerId, initialMembers }: { customerId: string, initialMembers: any[] }) {
  const [members, setMembers] = useState(initialMembers || []);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [form, setForm] = useState({
    full_name: "",
    relationship: "Eş",
    passport_no: ""
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");

    const newMember = {
      customer_id: customerId,
      full_name: form.full_name,
      relationship: form.relationship,
      passport_no: form.passport_no || null
    };

    const { data, error } = await supabase
      .from('family_members')
      .insert([newMember])
      .select()
      .single();

    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    setMembers([data, ...members]);
    setShowForm(false);
    setForm({ full_name: "", relationship: "Eş", passport_no: "" });
    setSaving(false);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu kişiyi silmek istediğinize emin misiniz?")) return;
    
    setMembers(members.filter((m: any) => m.id !== id));
    await supabase.from('family_members').delete().eq('id', id);
    router.refresh();
  };

  return (
    <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg print:hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" /> Birlikte Seyahat Edenler
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {showForm ? "Kapat" : "Kişi Ekle"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="p-5 border-b border-slate-200 dark:border-[#1f2937] bg-indigo-600/5 space-y-3">
          {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Ad Soyad *</label>
            <input 
              required 
              value={form.full_name} 
              onChange={e => setForm({...form, full_name: e.target.value})} 
              placeholder="Örn: Ayşe Yılmaz"
              className="w-full px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm outline-none focus:border-indigo-500" 
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase">Yakınlık *</label>
              <select 
                value={form.relationship} 
                onChange={e => setForm({...form, relationship: e.target.value})} 
                className="w-full px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm outline-none focus:border-indigo-500"
              >
                <option value="Eş">Eş</option>
                <option value="Çocuk">Çocuk</option>
                <option value="Kardeş">Kardeş</option>
                <option value="Anne/Baba">Anne/Baba</option>
                <option value="Arkadaş">Arkadaş</option>
                <option value="Diğer">Diğer</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase">Pasaport No</label>
              <input 
                value={form.passport_no} 
                onChange={e => setForm({...form, passport_no: e.target.value})} 
                placeholder="İsteğe bağlı"
                className="w-full px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm outline-none focus:border-indigo-500" 
              />
            </div>
          </div>
          <button disabled={saving} type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 mt-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Ekle"}
          </button>
        </form>
      )}

      <div className="divide-y divide-slate-200 dark:divide-[#1f2937]">
        {members.length === 0 ? (
          <p className="p-5 text-center text-xs text-slate-500">Kayıtlı kişi yok.</p>
        ) : (
          members.map((m: any) => (
            <div key={m.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-colors group">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{m.full_name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  <span className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded">{m.relationship}</span>
                  {m.passport_no && <span className="ml-2">Pasaport: {m.passport_no}</span>}
                </p>
              </div>
              <button onClick={() => handleDelete(m.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
