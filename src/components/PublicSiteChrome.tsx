import Link from "next/link";
import { Globe2, LogIn } from "lucide-react";

export function PublicHeader() {
  return (
    <header className="border-b border-white/10 bg-[#07101f]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3 text-white" aria-label="Nobel Vize CRM ana sayfa">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-800 shadow-lg shadow-blue-950/50">
            <Globe2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-tight sm:text-base">Nobel Vize CRM</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">Personel çalışma alanı</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Genel sayfalar">
          <Link href="/privacy-policy" className="hidden rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white sm:block">
            Gizlilik
          </Link>
          <Link href="/terms" className="hidden rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white sm:block">
            Kullanım Şartları
          </Link>
          <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500">
            <LogIn className="h-4 w-4" aria-hidden="true" /> Personel Girişi
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#050b16]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-7 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} Nobel Vize. Tüm hakları saklıdır.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy-policy" className="hover:text-white">Gizlilik Politikası</Link>
          <Link href="/terms" className="hover:text-white">Kullanım Şartları</Link>
          <a href="mailto:bilgi@nobelvize.com" className="hover:text-white">bilgi@nobelvize.com</a>
        </div>
      </div>
    </footer>
  );
}

export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07101f] text-slate-100">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
