"use client"
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { MessageSquare, Send, Loader2, User, Clock, AlertTriangle } from "lucide-react";

type Note = {
  id: string;
  content: string;
  created_at: string;
  author?: string;
};

export default function NotesPanel({ applicationId, initialNotes }: { applicationId: string; initialNotes: Note[] }) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    setErrorMsg("");

    const { data: { user } } = await supabase.auth.getUser();
    let authorName = "Danışman";
    if (user?.id) {
      const { data: staffData } = await supabase.from('staff').select('full_name').eq('user_id', user.id).single();
      if (staffData?.full_name) authorName = staffData.full_name;
    }

    const { data, error } = await supabase
      .from("notes")
      .insert([{ application_id: applicationId, content: newNote.trim(), author: authorName }])
      .select()
      .single();

    if (!error && data) {
      setNotes(prev => [data, ...prev]);
      setNewNote("");
    } else {
      setErrorMsg(error?.message || "Bilinmeyen hata");
    }
    setSaving(false);
  };

  return (
    <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-400" /> Danışman Notları
        </h3>
      </div>

      {/* Add Note */}
      <div className="p-4 border-b border-slate-200 dark:border-[#1f2937]">
        {errorMsg && (
          <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] text-red-400 font-semibold">Not eklenemedi</p>
              <p className="text-[10px] text-red-400/70 mt-0.5">
                {errorMsg.includes('security policy')
                  ? 'Supabase RLS hatası — fix_rls_and_countries.sql dosyasını Supabase SQL Editor\'de çalıştırın.'
                  : errorMsg}
              </p>
            </div>
          </div>
        )}
        <textarea
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAdd(); }}
          placeholder="Not ekleyin... (Ctrl+Enter ile gönderin)"
          rows={3}
          className="w-full px-4 py-3 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleAdd}
            disabled={saving || !newNote.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-40 shadow-lg shadow-blue-900/30"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Not Ekle
          </button>
        </div>
      </div>

      {/* Notes List */}
      <div className="max-h-64 overflow-y-auto divide-y divide-slate-200 dark:divide-[#1f2937]">
        {notes.length > 0 ? notes.map(note => (
          <div key={note.id} className="px-5 py-3.5 hover:bg-slate-100 dark:bg-[#1a2232] transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-5 h-5 rounded-full bg-blue-600/20 flex items-center justify-center">
                <User className="w-3 h-3 text-blue-400" />
              </div>
              <span className="text-xs font-medium text-blue-400">{note.author || "Danışman"}</span>
              <span className="text-slate-600 text-xs flex items-center gap-1 ml-auto">
                <Clock className="w-3 h-3" />
                {new Date(note.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{note.content}</p>
          </div>
        )) : (
          <div className="px-5 py-8 text-center text-slate-600 text-xs">Henüz not yok. İlk notu siz ekleyin.</div>
        )}
      </div>
    </div>
  );
}
