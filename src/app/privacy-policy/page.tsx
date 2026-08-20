import type { Metadata } from "next";
import { PublicPage } from "@/components/PublicSiteChrome";

export const metadata: Metadata = {
  title: "Gizlilik Politikası | Nobel Vize CRM",
  description: "Nobel Vize CRM kişisel veri ve Google kullanıcı verisi işleme açıklaması.",
};

const sectionClass = "space-y-3";
const headingClass = "text-xl font-bold text-white";
const textClass = "text-sm leading-7 text-slate-300";

export default function PrivacyPolicyPage() {
  return (
    <PublicPage>
      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Son güncelleme: 20 Ağustos 2026</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white">Gizlilik Politikası ve Google Kullanıcı Verisi Açıklaması</h1>
        <p className="mt-5 text-base leading-8 text-slate-300">
          Bu politika, Nobel Vize CRM’in yetkili personel hesaplarıyla, operasyon kayıtlarıyla ve isteğe bağlı Google Takvim bağlantısıyla ilişkili verileri nasıl işlediğini açıklar. CRM yalnız davet edilmiş Nobel Vize personelinin kullanımına yöneliktir.
        </p>

        <div className="mt-12 space-y-10">
          <section className={sectionClass}>
            <h2 className={headingClass}>1. Veri sorumlusu ve iletişim</h2>
            <div className={textClass}>
              <p>Veri sorumlusu: Nobel Vize</p>
              <p>Adres: Çankaya Mahallesi Farabi Sokak No:3/6, Çankaya / Ankara 06530</p>
              <p>E-posta: <a className="text-blue-300 underline-offset-4 hover:underline" href="mailto:bilgi@nobelvize.com">bilgi@nobelvize.com</a></p>
              <p>Telefon: <a className="text-blue-300 underline-offset-4 hover:underline" href="tel:+905334995750">+90 533 499 57 50</a></p>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>2. İşlenen veri kategorileri</h2>
            <ul className={`${textClass} list-disc space-y-2 pl-5`}>
              <li>Personel kimlik ve hesap verileri: ad-soyad, iş e-postası, kullanıcı kimliği, rol, hesap durumu ve MFA durumu.</li>
              <li>Güvenlik ve işlem kayıtları: oturum, başarısız giriş, yetkili işlem, hata ve denetim kayıtları.</li>
              <li>CRM operasyon verileri: müşteri ve başvuru kayıtları, evrak bilgileri, görevler, randevular, iletişim tercihleri ve tahsilat takibi.</li>
              <li>Google ile giriş verileri: Google hesabının temel kimlik, e-posta ve profil bilgileri. Bu giriş yalnız mevcut aktif personel kaydıyla eşleştirme için kullanılır.</li>
              <li>Google Takvim verileri: personelin ayrıca bağlantı kurması halinde birincil takvimde CRM tarafından ilişkilendirilen etkinliğin kimliği, durumu, başlama/bitiş zamanı, konumu ve uygulamaya özel gizli bağlantı alanları.</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>3. Google Takvim erişimi nasıl kullanılır?</h2>
            <div className={`${textClass} space-y-3`}>
              <p>
                Google Takvim bağlantısı Google ile girişten ayrıdır ve isteğe bağlıdır. Personel, Randevular ekranındaki açık açıklamadan sonra “Google Takvim’i bağla” seçeneğini kendisi kullanır. CRM, yalnız personelin sahibi olduğu birincil takvimde CRM randevularını oluşturmak, bağlı etkinliklerin zaman/konum değişikliklerini CRM’e almak ve iptal edilen bağlı randevuyu kaldırmak için etkinlik okuma-yazma izni ister.
              </p>
              <p>
                CRM, bağlantısız veya uygulama tarafından ilişkilendirilmemiş takvim etkinliklerini kendi veritabanına kaydetmez. Bağlantı anahtarları AES-256-GCM ile şifrelenmiş olarak sunucu tarafında saklanır; tarayıcıya veya normal personel veritabanı yetkilerine açılmaz.
              </p>
              <p className="rounded-xl border border-blue-400/20 bg-blue-400/10 p-4 text-blue-100">
                Google Workspace API’lerinden alınan bilgilerin kullanımı, Google API Services User Data Policy’nin Limited Use gereklilikleri dahil olmak üzere ilgili Google kullanıcı verisi politikalarına uyar.
              </p>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>4. Kullanım amaçları ve hukuki dayanak</h2>
            <p className={textClass}>
              Veriler; yetkili personel hesabını doğrulamak, vize danışmanlığı operasyonlarını yürütmek, randevu ve görevleri yönetmek, izinli iletişimi gerçekleştirmek, sistem güvenliğini sağlamak, hataları araştırmak ve hukuki yükümlülükleri yerine getirmek için işlenir. İşleme; uygulanabildiği ölçüde sözleşmenin kurulması/ifası, hukuki yükümlülük, hakkın tesisi-kullanılması-korunması, meşru menfaat ve açık rıza şartlarına dayanır. Açık rıza gerektiren bir işlemde rıza, diğer işleme şartlarıyla birleştirilmez.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>5. Paylaşım ve hizmet sağlayıcılar</h2>
            <div className={`${textClass} space-y-3`}>
              <p>Veriler satılmaz; reklam, yeniden hedefleme, kredi değerlendirmesi veya genel amaçlı yapay zekâ modeli eğitimi için kullanılmaz.</p>
              <p>Hizmetin çalışması için gerekli ölçüde Supabase (kimlik doğrulama, veritabanı ve özel dosya depolama), Vercel (uygulama barındırma), Resend (izinli e-posta teslimi) ve Google (isteğe bağlı giriş ve Takvim bağlantısı) gibi hizmet sağlayıcılar kullanılabilir. Bu sağlayıcılar yalnız hizmetin sunulması, güvenlik veya hukuki zorunluluk kapsamındaki amaçlarla veriye erişebilir.</p>
              <p>Sağlayıcıların küresel altyapısı nedeniyle uygulanabilir aktarım kuralları ve hukuki güvenceler çerçevesinde yurt dışında işleme gerçekleşebilir.</p>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>6. Saklama, güvenlik ve silme</h2>
            <div className={`${textClass} space-y-3`}>
              <p>Veriler yalnız amaç ve yasal yükümlülük için gerekli süre boyunca; CRM’de tanımlı saklama, arşiv ve kontrollü anonimleştirme kurallarına göre tutulur. Güvenlik kayıtları, uyuşmazlık ve mevzuat süreleri ayrıca dikkate alınır.</p>
              <p>Google Takvim bağlantısını kaldırmak için yetkili personel Randevular ekranındaki bağlantıyı kaldır düğmesini kullanabilir. Bu işlem şifreli erişim/yenileme anahtarlarını ve bağlı etkinlik eşleme kayıtlarını CRM’den siler, ayrıca Google OAuth yetkisini programlı olarak iptal etmeyi dener. Kullanıcı Google Hesabı’nın üçüncü taraf erişim ayarlarından da yetkiyi kaldırabilir.</p>
              <p>Erişim kontrolleri, MFA, aktarım sırasında HTTPS, şifreli anahtar saklama, özel dosya alanları, denetim kayıtları ve düzenli güvenlik testleri uygulanır.</p>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>7. İnsan erişimi ve Google verisi</h2>
            <p className={textClass}>
              Google kullanıcı verileri personel tarafından yalnız uygulamanın görünür randevu eşitleme işlevini sunmak için kullanılır. Belirli bir destek talebinde kullanıcının açık onayı, güvenlik/istismar araştırması veya hukuki zorunluluk bulunmadıkça teknik ekip tarafından insan gözüyle okunmaz. Toplulaştırılmış ve kimliksiz güvenlik/operasyon ölçümleri uygulanabilir mevzuata uygun biçimde kullanılabilir.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>8. KVKK kapsamındaki haklar</h2>
            <p className={textClass}>
              İlgili kişiler 6698 sayılı Kanun’un 11. maddesi kapsamındaki; verisinin işlenip işlenmediğini öğrenme, bilgi talep etme, amacına uygun kullanımı öğrenme, aktarılan tarafları bilme, düzeltme, silme/yok etme, bu işlemlerin aktarılan taraflara bildirilmesini isteme, otomatik analiz sonucuna itiraz ve zararın giderilmesini talep etme haklarını kullanabilir. Başvurular kimlik doğrulamasına elverişli bilgiyle <a className="text-blue-300 underline-offset-4 hover:underline" href="mailto:bilgi@nobelvize.com">bilgi@nobelvize.com</a> adresine veya yukarıdaki posta adresine iletilebilir.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>9. Zorunlu çerezler ve değişiklikler</h2>
            <p className={textClass}>
              CRM yalnız oturum, güvenlik, tema ve OAuth akışının çalışması için gerekli çerezleri kullanır; reklam amaçlı izleme çerezi kullanmaz. Veri kullanımı değişirse bu politika güncellenir, tarih yenilenir ve gerekli durumlarda kullanıcıdan yeni onay alınır.
            </p>
          </section>
        </div>
      </main>
    </PublicPage>
  );
}
