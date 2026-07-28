"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function MfaChallenge({
  factorId: initialFactorId,
  enrollmentRequired,
  onVerified,
}: {
  factorId?: string | null;
  enrollmentRequired?: boolean;
  onVerified?: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const enrollStarted = useRef(false);
  const [factorId, setFactorId] = useState(initialFactorId ?? null);
  const [uri, setUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(Boolean(enrollmentRequired));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enrollmentRequired || enrollStarted.current) return;
    enrollStarted.current = true;
    void (async () => {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Nobel Vize CRM",
      });
      if (enrollError) {
        setError("Doğrulayıcı kurulumu başlatılamadı.");
      } else {
        setFactorId(data.id);
        setUri(data.totp.uri);
        setSecret(data.totp.secret);
      }
      setLoading(false);
    })();
  }, [enrollmentRequired, supabase]);

  const verify = async () => {
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError("Doğrulama uygulamasındaki 6 haneli kodu girin.");
      return;
    }
    setLoading(true);
    setError("");
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (verifyError) {
      setError("Kod doğrulanamadı. Yeni kodla tekrar deneyin.");
      setLoading(false);
      return;
    }
    await supabase.rpc("record_own_security_event_v1", {
      p_event_type: enrollmentRequired ? "mfa_enrolled" : "mfa_verified",
      p_outcome: "success",
    });
    if (onVerified) onVerified();
    else window.location.assign("/dashboard");
  };

  return (
    <div className="space-y-4" data-testid="mfa-challenge">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-blue-500/10 p-2 text-blue-500"><ShieldCheck className="h-5 w-5" /></span>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">İki adımlı doğrulama</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {enrollmentRequired ? "Authenticator uygulamanızı bağlayın." : "Authenticator kodunuzu girin."}
          </p>
        </div>
      </div>
      {loading && !factorId ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
      ) : (
        <>
          {uri && (
            <div className="space-y-3 rounded-xl bg-white p-4 text-center">
              <QRCodeSVG value={uri} size={180} className="mx-auto" />
              {secret && <p className="break-all font-mono text-xs text-slate-600">Manuel kod: {secret}</p>}
            </div>
          )}
          <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            6 haneli kod
            <input
              aria-label="Doğrulama kodu"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={event => setCode(event.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-mono text-xl tracking-[0.4em] text-slate-900 outline-none focus:border-blue-500 dark:border-[#1f2937] dark:bg-[#060c18] dark:text-white"
            />
          </label>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button
            type="button"
            onClick={() => void verify()}
            disabled={loading || code.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Doğrula ve devam et
          </button>
        </>
      )}
    </div>
  );
}
