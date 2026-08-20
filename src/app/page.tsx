import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, DatabaseZap, MailCheck, ShieldCheck } from "lucide-react";
import { PublicPage } from "@/components/PublicSiteChrome";

export const metadata: Metadata = {
  title: "Nobel Vize CRM | Güvenli Vize Operasyon Yönetimi",
  description: "Nobel Vize personelinin müşteri, başvuru, evrak, iletişim ve randevu süreçlerini güvenli biçimde yönettiği çalışma alanı.",
};

const features = [
  {
    icon: DatabaseZap,
    title: "Başvuru operasyonu",
    description: "Müşteri, başvuru, evrak, görev ve tahsilat takibini tek kontrollü çalışma alanında birleştirir.",
  },
  {
    icon: CalendarDays,
    title: "Google Takvim eşitlemesi",
    description: "Personelin açık onayıyla CRM randevularını kendi birincil Google Takvimi ile iki yönlü eşitler.",
  },
  {
    icon: MailCheck,
    title: "İzin kontrollü iletişim",
    description: "Onay ve ret tercihlerini gözeten e-posta kuyruğu ile teslim ve başarısızlık durumlarını izler.",
  },
  {
    icon: ShieldCheck,
    title: "Katmanlı güvenlik",
    description: "Yalnız davetli personel erişimi, rol yetkileri, MFA, şifreli bağlantı anahtarları ve denetim kayıtları kullanır.",
  },
];

export default function Home() {
  return (
    <PublicPage>
      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.22),transparent_36%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,0.13),transparent_38%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="mb-5 inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold text-blue-200">
                Nobel Vize personeli için güvenli operasyon platformu
              </p>
              <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Vize süreçlerini düzenli, izlenebilir ve güvenli yönetin.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                Nobel Vize CRM; yetkili personelin müşteri kayıtlarını, başvuruları, evrakları, randevuları, görevleri ve iletişim geçmişini tek yerde yönetmesini sağlar. Sistem müşterilere açık bir kayıt hizmeti değildir.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-950/40 transition hover:bg-blue-500">
                  Personel Girişi <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/privacy-policy" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5">
                  Verilerin nasıl kullanıldığını öğrenin
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Google veri kullanımı</p>
              <h2 className="mt-3 text-2xl font-bold text-white">Takvim bağlantısı isteğe bağlıdır.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Personel Google Takvim’i ayrıca bağlamayı seçerse uygulama yalnız CRM ile ilişkilendirilmiş randevu etkinliklerini birincil takvimde oluşturur, günceller, okur veya kaldırır. Google verileri reklam, satış, kredi değerlendirmesi ya da yapay zekâ modeli eğitimi için kullanılmaz.
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Bağlantı istenildiği zaman CRM içinden kaldırılabilir; saklanan erişim anahtarları silinir ve Google yetkisi iptal edilir.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20" aria-labelledby="features-heading">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Uygulama işlevleri</p>
            <h2 id="features-heading" className="mt-3 text-3xl font-bold text-white">Günlük operasyon için tek çalışma alanı</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <Icon className="h-6 w-6 text-blue-300" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-400">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 bg-white/[0.025]">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Destek ve veri talepleri</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
                Uygulama, hesap, kişisel veri veya Google Takvim bağlantısı hakkında bize e-posta ya da telefonla ulaşabilirsiniz.
              </p>
            </div>
            <div className="text-sm leading-7 text-slate-300 lg:text-right">
              <a className="block font-semibold text-blue-300 hover:text-blue-200" href="mailto:bilgi@nobelvize.com">bilgi@nobelvize.com</a>
              <a className="block hover:text-white" href="tel:+905334995750">+90 533 499 57 50</a>
              <p>Çankaya Mah. Farabi Sok. No:3/6, Çankaya / Ankara</p>
            </div>
          </div>
        </section>
      </main>
    </PublicPage>
  );
}
