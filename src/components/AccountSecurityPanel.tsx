"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Laptop, Loader2, LogOut, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import MfaChallenge from "@/components/MfaChallenge";

type SessionSummary = {
  id: string;
  created_at: string;
  updated_at: string;
  user_agent: string;
  is_current: boolean;
};

export default function AccountSecurityPanel({ mfaRequired }: { mfaRequired: boolean }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const [{ data: factors }, { data: sessionData }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.rpc("list_current_user_sessions_v1"),
    ]);
    setFactorId(factors?.totp.find(factor => factor.status === "verified")?.id ?? null);
    setSessions(Array.isArray(sessionData) ? sessionData as unknown as SessionSummary[] : []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  const removeFactor = async () => {
    if (!factorId || mfaRequired) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      setMessage("Doğrulayıcı kaldırılamadı.");
      return;
    }
    await supabase.rpc("record_own_security_event_v1", {
      p_event_type: "mfa_unenrolled",
      p_outcome: "success",
    });
    setMessage("Doğrulayıcı kaldırıldı.");
    await refresh();
  };

  const closeOtherSessions = async () => {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) {
      setMessage("Diğer oturumlar kapatılamadı.");
      return;
    }
    await supabase.rpc("record_own_security_event_v1", {
      p_event_type: "other_sessions_revoked",
      p_outcome: "success",
    });
    setMessage("Diğer cihazlardaki oturumlar kapatıldı.");
    await refresh();
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-5">
      {message && <p role="status" className="rounded-xl bg-blue-500/10 p-3 text-xs text-blue-600 dark:text-blue-300">{message}</p>}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#1f2937] dark:bg-[#0d1420]">
        <div className="mb-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-500" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Authenticator doğrulaması</h2>
            <p className="text-xs text-slate-500">{mfaRequired ? "Bu hesap için zorunludur." : "Hesabınızı ek doğrulamayla koruyabilirsiniz."}</p>
          </div>
        </div>
        {enrolling ? (
          <MfaChallenge enrollmentRequired onVerified={() => { setEnrolling(false); void refresh(); }} />
        ) : factorId ? (
          <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 p-4">
            <span className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><Smartphone className="h-4 w-4" /> Etkin</span>
            <button
              type="button"
              onClick={() => void removeFactor()}
              disabled={mfaRequired}
              title={mfaRequired ? "Zorunlu MFA politikası nedeniyle kaldırılamaz." : undefined}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Kaldır
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setEnrolling(true)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
            Authenticator bağla
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#1f2937] dark:bg-[#0d1420]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Laptop className="h-4 w-4 text-purple-500" /> Aktif oturumlar</h2>
            <p className="mt-1 text-xs text-slate-500">Cihaz bilgileri Auth oturum kayıtlarından gelir.</p>
          </div>
          <button type="button" onClick={() => void closeOtherSessions()} className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600">
            <LogOut className="h-3.5 w-3.5" /> Diğerlerini kapat
          </button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-[#1f2937]">
          {sessions.map(session => (
            <div key={session.id} className="py-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate font-medium text-slate-700 dark:text-slate-200">{session.user_agent}</p>
                {session.is_current && <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">Bu cihaz</span>}
              </div>
              <p className="mt-1 text-slate-500">Son etkinlik: {new Date(session.updated_at).toLocaleString("tr-TR")}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
