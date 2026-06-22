"use client"
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Phone, MessageCircle, Mail, MessageSquare, Users, Send, Loader2, Clock, AlertTriangle, ArrowUpRight, ArrowDownLeft } from "lucide-react";

type Communication = {
  id: string;
  type: string;
  direction: string;
  subject: string;
  content: string;
  created_at: string;
  performed_by?: string;
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  telefon: <Phone className="w-3.5 h-3.5" />,
  whatsapp: <MessageCircle className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  sms: <MessageSquare className="w-3.5 h-3.5" />,
  yuz_yuze: <Users className="w-3.5 h-3.5" />
};

const TYPE_LABELS: Record<string, string> = {
  telefon: "Telefon",
  whatsapp: "WhatsApp",
  email: "E-posta",
  sms: "SMS",
  yuz_yuze: "Yüz Yüze"
};

export default function CommunicationPanel({ customerId, applicationId, initialComms }: { customerId: string; applicationId: string; initialComms: Communication[] }) {
  const [comms, setComms] = useState<Communication[]>(initialComms);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [form, setForm] = useState({
    type: "telefon",
    direction: "giden",
    subject: "",
    content: ""
  });

  const handleAdd = async () => {
    if (!form.content.trim()) return;
    setSaving(true);
    setErrorMsg("");

    const { data: { user } } = await supabase.auth.getUser();
    let authorName = "Danışman";
    if (user?.id) {
      const { data: staffData } = await supabase.from('staff').select('full_name').eq('user_id', user.id).single();
      if (staffData?.full_name) authorName = staffData.full_name;
    }

    const { data, error } = await supabase
      .from("communications")
      .insert([{ 
        customer_id: customerId,
        application_id: applicationId,
        type: form.type,
        direction: form.direction,
        subject: form.subject.trim() || null,
        content: form.content.trim(), 
        performed_by: authorName 
      }])
      .select()
      .single();

    if (!error && data) {
      setComms(prev => [data, ...prev]);
      setForm({ type: "telefon", direction: "giden", subject: "", content: "" });
      setShowForm(false);
      
      // Activity Log Ekle
      await supabase.from("activity_log").insert([{
        application_id: applicationId,
        customer_id: customerId,
        action: `İletişim eklendi: ${TYPE_LABELS[form.type] || form.type} (${form.direction === 'giden' ? 'Giden' : 'Gelen'})`,
        performed_by: authorName,
      }]);

    } else {
      setErrorMsg(error?.message || "Bilinmeyen hata");
    }
    setSaving(false);
  };

  return (
    <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-purple-400" /> İletişim Geçmişi
        </h3>
        <button
          onClick={() => { setShowForm(!showForm); setErrorMsg(""); }}
          className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
        >
          {showForm ? "İptal" : "+ İletişim Ekle"}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="p-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50/50 dark:bg-[#0a101a]/50">
          {errorMsg && (
            <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] text-red-400 font-semibold">Eklenemedi</p>
                <p className="text-[10px] text-red-400/70 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3 mb-3">
            <select
              value={form.type}
              onChange={e => setForm({...form, type: e.target.value})}
              className="px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-purple-500"
            >
              <option value="telefon">Telefon</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-posta</option>
              <option value="sms">SMS</option>
              <option value="yuz_yuze">Yüz Yüze</option>
            </select>
            
            <select
              value={form.direction}
              onChange={e => setForm({...form, direction: e.target.value})}
              className="px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-purple-500"
            >
              <option value="giden">Giden (Biz ulaştık)</option>
              <option value="gelen">Gelen (Müşteri ulaştı)</option>
            </select>
          </div>
          
          <input
            type="text"
            value={form.subject}
            onChange={e => setForm({...form, subject: e.target.value})}
            placeholder="Konu (Opsiyonel)"
            className="w-full mb-3 px-4 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-purple-500 transition-all"
          />

          <textarea
            value={form.content}
            onChange={e => setForm({...form, content: e.target.value})}
            placeholder="İletişim detayı..."
            rows={3}
            className="w-full px-4 py-3 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleAdd}
              disabled={saving || !form.content.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-40 shadow-lg shadow-purple-900/30"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Kaydet
            </button>
          </div>
        </div>
      )}

      {/* Communications List */}
      <div className="max-h-64 overflow-y-auto divide-y divide-slate-200 dark:divide-[#1f2937]">
        {comms.length > 0 ? comms.map(comm => (
          <div key={comm.id} className="px-5 py-3.5 hover:bg-slate-100 dark:bg-[#1a2232] transition-colors flex gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${comm.direction === 'giden' ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {TYPE_ICONS[comm.type] || <MessageCircle className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {TYPE_LABELS[comm.type] || comm.type}
                </span>
                <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                  {comm.direction === 'giden' ? <ArrowUpRight className="w-3 h-3 text-purple-400" /> : <ArrowDownLeft className="w-3 h-3 text-emerald-400" />}
                  {comm.direction === 'giden' ? 'Giden' : 'Gelen'}
                </span>
                <span className="text-slate-600 text-[10px] flex items-center gap-1 ml-auto">
                  <Clock className="w-3 h-3" />
                  {new Date(comm.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
              {comm.subject && (
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">{comm.subject}</p>
              )}
              <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                {comm.content}
              </p>
              <div className="mt-1.5 flex justify-end">
                 <span className="text-[10px] font-medium text-slate-500">{comm.performed_by || "Danışman"}</span>
              </div>
            </div>
          </div>
        )) : (
          <div className="px-5 py-8 text-center">
            <MessageCircle className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Henüz iletişim kaydı bulunmuyor.</p>
          </div>
        )}
      </div>
    </div>
  );
}
