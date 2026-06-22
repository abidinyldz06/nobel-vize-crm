"use client"
import { useState } from "react"
import { changePassword } from "@/app/actions/profile"
import { KeyRound, Shield, CheckCircle2, AlertCircle } from "lucide-react"

export default function ProfilePage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData(e.currentTarget)
    const result = await changePassword(formData)

    if (result.error) {
      setError(result.error)
    } else if (result.success) {
      setSuccess(result.success)
      ;(e.target as HTMLFormElement).reset()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-7">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-400" /> Profil ve Şifre
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Hesap güvenliğinizi sağlamak için şifrenizi güncelleyebilirsiniz.</p>
        </div>

        <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-400" /> Şifre Değiştir
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-500 font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-500 font-medium">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Yeni Şifre</label>
              <input
                type="password"
                name="newPassword"
                required
                minLength={6}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060c18] border border-slate-200 dark:border-[#1f2937] rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-900 dark:text-white transition-all"
                placeholder="En az 6 karakter"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Yeni Şifre (Tekrar)</label>
              <input
                type="password"
                name="confirmPassword"
                required
                minLength={6}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060c18] border border-slate-200 dark:border-[#1f2937] rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-900 dark:text-white transition-all"
                placeholder="Şifrenizi tekrar girin"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30"
              >
                {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
