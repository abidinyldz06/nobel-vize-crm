import type { Metadata } from "next";
import { PublicPage } from "@/components/PublicSiteChrome";

export const metadata: Metadata = {
  title: "Kullanım Şartları | Nobel Vize CRM",
  description: "Nobel Vize CRM yetkili personel kullanım şartları.",
};

const sections = [
  {
    title: "1. Hizmetin kapsamı",
    body: "Nobel Vize CRM; müşteri, vize başvurusu, evrak, görev, randevu, iletişim ve tahsilat süreçlerinin yetkili personel tarafından yönetilmesine yardımcı olan şirket içi bir uygulamadır. CRM, konsolosluk veya resmî makam değildir; vize verilmesini, işlem süresini ya da başvurunun sonucunu garanti etmez.",
  },
  {
    title: "2. Yetkili kullanım",
    body: "Uygulama yalnız Nobel Vize tarafından davet edilmiş aktif personel içindir. Kullanıcı kendi hesabını ve MFA aracını korumalı, erişimini paylaşmamalı, şüpheli hareketi gecikmeden bildirmeli ve yalnız görev kapsamındaki kayıtlara erişmelidir. Yetkisiz erişim, veri dışa aktarma, güvenlik önlemlerini aşma veya sistemi kötüye kullanma yasaktır.",
  },
  {
    title: "3. Kayıtların doğruluğu ve sorumluluk",
    body: "Personel, girdiği veya güncellediği bilgilerin doğru, güncel ve görevle ilgili olmasından sorumludur. Ülke/vize kuralları kaynak ve kontrol tarihiyle sunulsa da resmî makamlar kuralları değiştirebilir; işlem öncesinde güncel resmî kaynak ayrıca doğrulanmalıdır.",
  },
  {
    title: "4. Google hizmetleri",
    body: "Google ile giriş yalnız mevcut personel hesabını doğrulamak için kullanılabilir. Google Takvim bağlantısı isteğe bağlı ve ayrı bir izin akışıdır. Kullanıcı, görünür açıklamayı kabul ederek kendi birincil takvimindeki CRM bağlantılı randevuların oluşturulmasına, okunmasına, güncellenmesine ve iptal edilmesine izin verir. Bağlantı CRM içinden veya Google Hesabı ayarlarından kaldırılabilir.",
  },
  {
    title: "5. Fikrî haklar ve içerik",
    body: "Uygulama, tasarım, marka ve sistem içerikleri üzerindeki haklar Nobel Vize’ye veya ilgili lisans sahiplerine aittir. Kullanıcılar uygulamayı kopyalayamaz, yeniden satamaz, tersine mühendislik yapamaz veya görev dışı amaçlarla kullanamaz.",
  },
  {
    title: "6. Hizmet sürekliliği",
    body: "Güvenlik, bakım, üçüncü taraf hizmet kesintisi veya mücbir sebepler nedeniyle hizmet geçici olarak sınırlandırılabilir. Makul güvenlik, yedekleme ve geri yükleme önlemleri uygulanır; ancak kesintisiz veya hatasız çalışma taahhüt edilmez.",
  },
  {
    title: "7. Hesabın sınırlandırılması",
    body: "İş ilişkisi, görev veya yetki sona erdiğinde; güvenlik riski, politika ihlali ya da hukuki zorunluluk bulunduğunda hesap askıya alınabilir veya kapatılabilir. Gerekli kayıtlar uygulanabilir saklama ve hukuki yükümlülükler çerçevesinde korunur veya silinir.",
  },
  {
    title: "8. Uygulanacak kurallar ve değişiklikler",
    body: "Bu şartlar Türkiye Cumhuriyeti mevzuatıyla birlikte uygulanır. Önemli değişiklikler bu sayfada yeni güncelleme tarihiyle yayımlanır; gerekli hallerde kullanıcılara ayrıca bildirim yapılır veya yeniden onay alınır.",
  },
];

export default function TermsPage() {
  return (
    <PublicPage>
      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Son güncelleme: 20 Ağustos 2026</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white">Kullanım Şartları</h1>
        <p className="mt-5 text-base leading-8 text-slate-300">
          Nobel Vize CRM’e erişerek bu şartlara, kurum içi güvenlik kurallarına ve görev kapsamınızdaki gizlilik yükümlülüklerine uymayı kabul edersiniz.
        </p>

        <div className="mt-12 space-y-9">
          {sections.map(section => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-xl font-bold text-white">{section.title}</h2>
              <p className="text-sm leading-7 text-slate-300">{section.body}</p>
            </section>
          ))}

          <section className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-6">
            <h2 className="text-xl font-bold text-white">9. İletişim</h2>
            <p className="mt-3 text-sm leading-7 text-blue-50">
              Bu şartlarla ilgili sorular için <a className="font-semibold underline underline-offset-4" href="mailto:bilgi@nobelvize.com">bilgi@nobelvize.com</a>, <a className="font-semibold underline underline-offset-4" href="tel:+905334995750">+90 533 499 57 50</a> veya Çankaya Mahallesi Farabi Sokak No:3/6, Çankaya / Ankara 06530 adresi kullanılabilir.
            </p>
          </section>
        </div>
      </main>
    </PublicPage>
  );
}
