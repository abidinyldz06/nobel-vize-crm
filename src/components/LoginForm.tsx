"use client"
import { useState } from "react"
import { loginAction } from "@/app/actions/auth"
import { Globe, Mail, Lock, ArrowRight, Shield, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"

export default function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [isResetMode, setIsResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetMessage, setResetMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await loginAction(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetEmail) return
    
    setLoading(true)
    setResetMessage(null)
    
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setResetMessage({ type: 'error', text: "E-posta gönderilemedi" })
    } else {
      setResetMessage({ type: 'success', text: "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi" })
      setResetEmail("")
    }
    setLoading(false)
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#060c18]">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#0d1f4a]/60 via-[#060c18] to-[#060c18]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-800/10 rounded-full blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }}
        />
      </div>

      <div className="z-10 w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-800 flex items-center justify-center shadow-xl shadow-blue-900/60">
              <Globe className="text-slate-900 dark:text-white w-6 h-6" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Nobel Vize CRM</h1>
              <p className="text-[11px] text-blue-400 font-medium uppercase tracking-widest">Visa Management System</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Hoş Geldiniz</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Vize başvurularınızı yönetin</p>
        </div>

        {/* Card */}
        {isResetMode ? (
          <form onSubmit={handleResetPassword} className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1e2d45] rounded-2xl p-7 shadow-2xl shadow-black/60">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Şifre Sıfırlama</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Sisteme kayıtlı e-posta adresinizi girin, size bir sıfırlama bağlantısı göndereceğiz.</p>
            
            {resetMessage && (
              <div className={`mb-4 p-3 rounded-xl border flex items-center gap-2 text-sm ${resetMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-500 dark:text-red-400'}`}>
                {resetMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {resetMessage.text}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">E-posta Adresi</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    disabled={loading}
                    placeholder="ornek@nobelvize.com"
                    className="w-full pl-10 pr-4 py-3 bg-[#060c18] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/40 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Bağlantı Gönder'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsResetMode(false); setResetMessage(null); }}
                  className="w-full py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Giriş Ekranına Dön
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form action={handleSubmit} className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1e2d45] rounded-2xl p-7 shadow-2xl shadow-black/60">
          
          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">E-posta Adresi</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="ornek@nobelvize.com"
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 bg-[#060c18] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Şifre</label>
                <button type="button" onClick={() => setIsResetMode(true)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Şifremi Unuttum</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 bg-[#060c18] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="remember" className="w-4 h-4 rounded accent-blue-600" />
              <label htmlFor="remember" className="text-sm text-slate-500 dark:text-slate-400">Beni Hatırla</label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/40 hover:shadow-blue-900/60 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  <>
                    Giriş Yap
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
        )}

        {/* Footer */}
        <div className="mt-6 text-center flex items-center justify-center gap-2 text-slate-600 text-xs">
          <Shield className="w-3.5 h-3.5" />
          <span>KVKK Uyumlu Güvenli Bağlantı</span>
        </div>
        <p className="text-center text-slate-700 text-xs mt-2">© {new Date().getFullYear()} Nobel Vize. Tüm hakları saklıdır.</p>
      </div>
    </main>
  )
}
