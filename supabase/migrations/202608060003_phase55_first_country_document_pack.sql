-- Faz 5.5.2-5.5.3: ilk ülke/evrak omurga paketi.
-- Almanya, Fransa ve İtalya için dört ana kategori genel listeleri ile
-- meslek, çocuk ve yabancı uyruk profil eklerini kaynak statüsü korunarak
-- oluşturur. Mevcut başka profil kurallarını silmez.

BEGIN;

-- Temiz kurulumda içerik paketi boşta kalmasın. Production'da aynı adlı
-- ülkeler varsa dokunulmaz; yalnız eksik ana ülke kaydı oluşturulur.
INSERT INTO public.countries (name, visa_system, active)
SELECT desired.name, 'Schengen', true
FROM (VALUES ('Almanya'), ('Fransa'), ('İtalya')) AS desired(name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.countries AS country
  WHERE country.name = desired.name
);

CREATE TEMP TABLE phase55_desired_general_rules (
  country_name TEXT NOT NULL,
  visa_category TEXT NOT NULL,
  documents JSONB NOT NULL,
  processing_time TEXT,
  validity TEXT,
  max_stay TEXT,
  notes TEXT,
  sources JSONB NOT NULL,
  sources_last_reviewed_at TIMESTAMPTZ
) ON COMMIT DROP;

DO $$
DECLARE
  reviewed_at CONSTANT TIMESTAMPTZ := '2026-08-06T12:00:00+03:00';
  review_due CONSTANT TEXT := '2026-11-04';
  schengen_base JSONB := '[
    {"name":"Vize Başvuru Formu","category":"temel","required":true,"description":"Eksiksiz doldurulmuş ve imzalanmış güncel form"},
    {"name":"Pasaport","category":"temel","required":true,"description":"Son 10 yılda düzenlenmiş, boş sayfası bulunan ve planlanan dönüşten sonra yeterli geçerliliği olan pasaport"},
    {"name":"Biyometrik Fotoğraf","category":"temel","required":true,"description":"Güncel Schengen fotoğraf ölçülerine uygun"},
    {"name":"Kimlik Fotokopisi","category":"kimlik","required":true},
    {"name":"Tam Tekmil Vukuatlı Nüfus Kayıt Örneği","category":"kimlik","required":true,"description":"E-Devlet üzerinden barkodlu/QR kodlu"},
    {"name":"Seyahat Sağlık Sigortası","category":"seyahat","required":true,"description":"Schengen bölgesinde geçerli, seyahat süresini kapsayan ve en az 30.000 € teminatlı"},
    {"name":"Ulaşım Rezervasyonu veya Seyahat Planı","category":"seyahat","required":true},
    {"name":"Konaklama Kanıtı","category":"seyahat","required":true,"description":"Otel rezervasyonu, davet/konaklama belgesi veya eşdeğer kanıt"},
    {"name":"Son 3 Aylık Banka Hesap Dökümü","category":"finansal","required":true,"description":"Seyahat masraflarını karşılayabilecek güncel hareket ve bakiye"},
    {"name":"Önceki Vizeler ve Pasaport Sayfaları","category":"temel","required":false,"description":"Varsa önceki Schengen ve diğer ülke vizeleri"}
  ]'::JSONB;
  italy_base JSONB := schengen_base || '[
    {"name":"Tarihçeli Yerleşim Yeri Belgesi","category":"kimlik","required":true},
    {"name":"Başvuru Amacını Açıklayan Dilekçe","category":"temel","required":true}
  ]'::JSONB;
  germany_sources_tourism JSONB := jsonb_build_array(
    jsonb_build_object('title','Almanya Dışişleri Bakanlığı — Turistik Amaçlı Vize','url','https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768822-2768822','kind','official','checked_at',reviewed_at,'review_due_at',review_due),
    jsonb_build_object('title','Almanya Dışişleri Bakanlığı — Schengen Vizesi Genel Bilgiler','url','https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768812-2768812','kind','official','checked_at',reviewed_at,'review_due_at',review_due),
    jsonb_build_object('title','3GEN Vize — Almanya Vizesi','url','https://3genvize.com/ulkeler/almanya-vizesi/','kind','secondary','checked_at',reviewed_at,'review_due_at',review_due)
  );
  germany_sources_business JSONB := jsonb_build_array(
    jsonb_build_object('title','Almanya Dışişleri Bakanlığı — İş Seyahati Vizesi','url','https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768816-2768816','kind','official','checked_at',reviewed_at,'review_due_at',review_due),
    jsonb_build_object('title','Almanya Dışişleri Bakanlığı — Schengen Vizesi Genel Bilgiler','url','https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768812-2768812','kind','official','checked_at',reviewed_at,'review_due_at',review_due),
    jsonb_build_object('title','3GEN Vize — Almanya Vizesi','url','https://3genvize.com/ulkeler/almanya-vizesi/','kind','secondary','checked_at',reviewed_at,'review_due_at',review_due)
  );
  germany_sources_student JSONB := jsonb_build_array(
    jsonb_build_object('title','Almanya Dışişleri Bakanlığı — Öğrenci Gezileri İçin Vize','url','https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768826-2768826','kind','official','checked_at',reviewed_at,'review_due_at',review_due),
    jsonb_build_object('title','Almanya Dışişleri Bakanlığı — Schengen Vizesi Genel Bilgiler','url','https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768812-2768812','kind','official','checked_at',reviewed_at,'review_due_at',review_due)
  );
  germany_sources_family JSONB := jsonb_build_array(
    jsonb_build_object('title','Almanya Dışişleri Bakanlığı — Ziyaret Amaçlı Vize','url','https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768820-2768820','kind','official','checked_at',reviewed_at,'review_due_at',review_due),
    jsonb_build_object('title','Almanya Dışişleri Bakanlığı — Schengen Vizesi Genel Bilgiler','url','https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768812-2768812','kind','official','checked_at',reviewed_at,'review_due_at',review_due),
    jsonb_build_object('title','3GEN Vize — Almanya Vizesi','url','https://3genvize.com/ulkeler/almanya-vizesi/','kind','secondary','checked_at',reviewed_at,'review_due_at',review_due)
  );
  france_sources_tourism JSONB := '[
    {"title":"France-Visas — Tourism and private stay","url":"https://www.france-visas.gouv.fr/en/tourisme-et-sejour-prive","kind":"official","review_due_at":"2026-09-05"},
    {"title":"France-Visas — Visa Assistant","url":"https://france-visas.gouv.fr/en/web/france-visas/assistant-visa","kind":"official","review_due_at":"2026-09-05"},
    {"title":"3GEN Vize — Fransa Vizesi","url":"https://3genvize.com/ulkeler/fransa-vizesi/","kind":"secondary","review_due_at":"2026-09-05"}
  ]'::JSONB;
  france_sources_business JSONB := '[
    {"title":"France-Visas — Professional purpose","url":"https://france-visas.gouv.fr/en/web/france-visas/motif-professionnel","kind":"official","review_due_at":"2026-09-05"},
    {"title":"France-Visas — Visa Assistant","url":"https://france-visas.gouv.fr/en/web/france-visas/assistant-visa","kind":"official","review_due_at":"2026-09-05"},
    {"title":"3GEN Vize — Fransa Vizesi","url":"https://3genvize.com/ulkeler/fransa-vizesi/","kind":"secondary","review_due_at":"2026-09-05"}
  ]'::JSONB;
  france_sources_student JSONB := '[
    {"title":"France-Visas — Student","url":"https://www.france-visas.gouv.fr/en/etudiant","kind":"official","review_due_at":"2026-09-05"},
    {"title":"France-Visas — Visa Assistant","url":"https://france-visas.gouv.fr/en/web/france-visas/assistant-visa","kind":"official","review_due_at":"2026-09-05"},
    {"title":"3GEN Vize — Fransa Vizesi","url":"https://3genvize.com/ulkeler/fransa-vizesi/","kind":"secondary","review_due_at":"2026-09-05"}
  ]'::JSONB;
  france_sources_family JSONB := '[
    {"title":"France-Visas — Tourism and private stay","url":"https://www.france-visas.gouv.fr/en/tourisme-et-sejour-prive","kind":"official","review_due_at":"2026-09-05"},
    {"title":"France-Visas — Family purpose","url":"https://france-visas.gouv.fr/en/web/france-visas/motif-familial","kind":"official","review_due_at":"2026-09-05"},
    {"title":"France-Visas — Visa Assistant","url":"https://france-visas.gouv.fr/en/web/france-visas/assistant-visa","kind":"official","review_due_at":"2026-09-05"},
    {"title":"3GEN Vize — Fransa Vizesi","url":"https://3genvize.com/ulkeler/fransa-vizesi/","kind":"secondary","review_due_at":"2026-09-05"}
  ]'::JSONB;
  italy_sources_tourism JSONB := jsonb_build_array(
    jsonb_build_object('title','İtalya İstanbul Başkonsolosluğu — Tourism, Family and Friends','url','https://consistanbul.esteri.it/wp-content/uploads/2026/05/10_Tourism.pdf','kind','official','checked_at',reviewed_at,'review_due_at',review_due),
    jsonb_build_object('title','3GEN Vize — İtalya Vizesi','url','https://3genvize.com/ulkeler/italya-vizesi/','kind','secondary','checked_at',reviewed_at,'review_due_at',review_due)
  );
  italy_sources_business JSONB := '[
    {"title":"İtalya İstanbul Başkonsolosluğu — Vize Formları ve Belgeler","url":"https://consistanbul.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/modelli-e-modulistica/","kind":"official","review_due_at":"2026-09-05"},
    {"title":"3GEN Vize — İtalya Vizesi","url":"https://3genvize.com/ulkeler/italya-vizesi/","kind":"secondary","review_due_at":"2026-09-05"}
  ]'::JSONB;
  italy_sources_student JSONB := jsonb_build_array(
    jsonb_build_object('title','İtalya İstanbul Başkonsolosluğu — Generic Study Checklist','url','https://consistanbul.esteri.it/wp-content/uploads/2024/05/STUDIO_GEN-C_20.05.2024.pdf','kind','official','checked_at',reviewed_at,'review_due_at',review_due),
    jsonb_build_object('title','İtalya İstanbul Başkonsolosluğu — Study in Italy','url','https://consistanbul.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/studiare-in-italia/universita/','kind','official','checked_at',reviewed_at,'review_due_at',review_due),
    jsonb_build_object('title','3GEN Vize — İtalya Vizesi','url','https://3genvize.com/ulkeler/italya-vizesi/','kind','secondary','checked_at',reviewed_at,'review_due_at',review_due)
  );
BEGIN
  INSERT INTO phase55_desired_general_rules VALUES
    ('Almanya','turistik',schengen_base || '[
      {"name":"Turistik Gezi Planı","category":"seyahat","required":true,"description":"Seyahat amacı, rota ve planlanan tarihleri açıklayan belge"}
    ]'::JSONB,'Genellikle 15 gün; özel durumlarda 45 güne kadar','Karara göre 1-5 yıl','180 günde en fazla 90 gün','Türkiye’den Almanya’ya kısa süreli turistik Schengen başvurusu.',germany_sources_tourism,reviewed_at),
    ('Almanya','is',schengen_base || '[
      {"name":"Almanya Şirket Davet Yazısı","category":"mesleki","required":true,"description":"Seyahat amacı/süresi, davet edilen kişi ve masrafları içermeli"},
      {"name":"Davet Eden Alman Şirketin Sicil Kayıt Sureti","category":"mesleki","required":true,"description":"Güncel şirket kayıt belgesi"},
      {"name":"İş Seyahati Görev Yazısı","category":"mesleki","required":true,"description":"Türkiye’deki işveren veya şirket tarafından seyahat amacı ve masrafları açıklayan yazı"}
    ]'::JSONB,'Genellikle 15 gün; özel durumlarda 45 güne kadar','Karara göre 1-5 yıl','180 günde en fazla 90 gün','Türkiye’den Almanya’ya kısa süreli iş seyahati Schengen başvurusu.',germany_sources_business,reviewed_at),
    ('Almanya','ogrenci',schengen_base || '[
      {"name":"Okul Gezi Yazısı ve Katılımcı Listesi","category":"egitim","required":true,"description":"Kısa süreli öğrenci gezisinin amacı, tarihleri ve katılımcıları"},
      {"name":"Güncel Öğrenci Belgesi","category":"egitim","required":true},
      {"name":"Almanya Okul Daveti","category":"egitim","required":false,"description":"Gezi kardeş okul davetiyle yapılıyorsa ayrıntılı davet ve katılımcı listesi"},
      {"name":"Masrafları Karşılayan Kişinin Finansal Belgeleri","category":"finansal","required":true}
    ]'::JSONB,'Genellikle 15 gün; özel durumlarda 45 güne kadar','Kısa süreli Schengen','180 günde en fazla 90 gün','Yalnız 90 güne kadar öğrenci/okul gezisi içindir; üniversite ve uzun süreli eğitim ulusal vize sürecidir.',germany_sources_student,reviewed_at),
    ('Almanya','aile_ziyareti',schengen_base || '[
      {"name":"Almanya Davet veya Taahhüt Belgesi","category":"davet","required":true,"description":"Davet eden kişi, adres, ziyaret süresi ve masraf durumunu içermeli"},
      {"name":"Davet Eden Kişinin Kimlik ve İkamet Belgesi","category":"davet","required":true},
      {"name":"Akrabalık veya Yakınlık Kanıtı","category":"aile","required":true}
    ]'::JSONB,'Genellikle 15 gün; özel durumlarda 45 güne kadar','Karara göre 1-5 yıl','180 günde en fazla 90 gün','Yerleşme amacı taşımayan kısa süreli aile/arkadaş ziyareti başvurusu.',germany_sources_family,reviewed_at),

    ('Fransa','turistik',schengen_base || '[
      {"name":"Turistik Gezi Planı","category":"seyahat","required":true},
      {"name":"Şahsi Vize Talep Dilekçesi","category":"temel","required":true}
    ]'::JSONB,'Başvuru profiline ve merkezin yoğunluğuna göre','Karara göre','180 günde en fazla 90 gün','Kesin liste France-Visas Assistant sonucuyla doğrulanmalıdır; bu kayıt resmî kategori ve ikincil karşılaştırma taslağıdır.',france_sources_tourism,NULL),
    ('Fransa','is',schengen_base || '[
      {"name":"Fransa Şirket Davet Yazısı","category":"mesleki","required":true},
      {"name":"İş Seyahati Görev ve Masraf Yazısı","category":"mesleki","required":true},
      {"name":"Fuar veya Etkinlik Katılım Belgesi","category":"mesleki","required":false}
    ]'::JSONB,'Başvuru profiline ve merkezin yoğunluğuna göre','Karara göre','180 günde en fazla 90 gün','Kesin liste France-Visas Assistant sonucuyla doğrulanmalıdır; bu kayıt resmî kategori ve ikincil karşılaştırma taslağıdır.',france_sources_business,NULL),
    ('Fransa','ogrenci',schengen_base || '[
      {"name":"Okul veya Üniversite Kabul Belgesi","category":"egitim","required":true},
      {"name":"Campus France veya Études en France Belgesi","category":"egitim","required":false,"description":"Başvuru programı gerektiriyorsa"},
      {"name":"Eğitim ve Konaklama Planı","category":"egitim","required":true},
      {"name":"Eğitim Masrafları Finansman Kanıtı","category":"finansal","required":true}
    ]'::JSONB,'Başvuru profiline ve eğitim süresine göre','Kısa veya uzun süreli eğitim türüne göre','Programa göre','Kesin liste ve vize süresi France-Visas Assistant sonucuyla doğrulanmalıdır.',france_sources_student,NULL),
    ('Fransa','aile_ziyareti',schengen_base || '[
      {"name":"Belediye Onaylı Konaklama Belgesi veya Davet","category":"davet","required":true,"description":"Başvuru profiline göre attestation d’accueil veya eşdeğer belge"},
      {"name":"Davet Eden Kişinin Kimlik ve Adres Belgesi","category":"davet","required":true},
      {"name":"Akrabalık veya Yakınlık Kanıtı","category":"aile","required":true}
    ]'::JSONB,'Başvuru profiline ve merkezin yoğunluğuna göre','Karara göre','180 günde en fazla 90 gün','Yerleşme amacı taşımayan ziyaret içindir; kesin liste France-Visas Assistant sonucuyla doğrulanmalıdır.',france_sources_family,NULL),

    ('İtalya','turistik',italy_base || '[
      {"name":"Turistik Gezi Planı","category":"seyahat","required":true},
      {"name":"Masrafları Karşılayan Kişinin Belgeleri","category":"finansal","required":false,"description":"Başvuru sahibi finansal olarak bağımlıysa sponsor taahhüdü, kimliği, finansal belgeleri ve akrabalık kanıtı"}
    ]'::JSONB,'Genellikle 15 gün; özel durumlarda uzayabilir','Karara göre','180 günde en fazla 90 gün','İstanbul Başkonsolosluğu 2026 turizm kontrol listesine göre kısa süreli başvuru.',italy_sources_tourism,reviewed_at),
    ('İtalya','is',italy_base || '[
      {"name":"İtalya Şirket Davet Yazısı","category":"mesleki","required":true},
      {"name":"Davet Eden Şirketin Oda Kayıt Belgesi","category":"mesleki","required":true},
      {"name":"İş Seyahati Görev ve Masraf Yazısı","category":"mesleki","required":true},
      {"name":"Fuar veya Etkinlik Katılım Belgesi","category":"mesleki","required":false}
    ]'::JSONB,'Başvuru merkezi yoğunluğuna göre','Karara göre','180 günde en fazla 90 gün','Güncel doğrudan ticari kontrol listesi doğrulanana kadar ikincil karşılaştırma taslağıdır.',italy_sources_business,NULL),
    ('İtalya','ogrenci',italy_base || '[
      {"name":"Kurs veya Eğitim Kurumu Kabul Belgesi","category":"egitim","required":true,"description":"Kayıt, etkinlik türü ve başlangıç/bitiş tarihlerini içermeli"},
      {"name":"Universitaly Ön Kayıt Özeti","category":"egitim","required":false,"description":"Üniversite başvurusunda gerekiyorsa"},
      {"name":"Eğitim Masrafları Finansman Kanıtı","category":"finansal","required":true},
      {"name":"Mevcut Eğitim veya Meslek Durumu Belgesi","category":"egitim","required":true}
    ]'::JSONB,'Eğitim türü ve başvuru dönemine göre','Eğitim türüne göre','Programa göre','Genel eğitim kontrol listesi; üniversite başvurularında güncel Universitaly süreci ayrıca izlenmelidir.',italy_sources_student,reviewed_at),
    ('İtalya','aile_ziyareti',italy_base || '[
      {"name":"Davet ve Konaklama Beyanı","category":"davet","required":true},
      {"name":"Davet Eden Kişinin Kimlik veya Oturum Belgesi","category":"davet","required":true},
      {"name":"Akrabalık veya Yakınlık Kanıtı","category":"aile","required":true},
      {"name":"Masrafları Karşılayan Kişinin Belgeleri","category":"finansal","required":false,"description":"Başvuru sahibi finansal olarak bağımlıysa"}
    ]'::JSONB,'Genellikle 15 gün; özel durumlarda uzayabilir','Karara göre','180 günde en fazla 90 gün','Yerleşme/aile birleşimi değil, kısa süreli aile veya arkadaş ziyareti içindir.',italy_sources_tourism,reviewed_at);
END
$$;

-- 12 genel kuralı yerinde güncelle; eksik genel kural varsa oluştur.
UPDATE public.country_visa_rules AS rule
SET documents = desired.documents,
    processing_time = desired.processing_time,
    validity = desired.validity,
    max_stay = desired.max_stay,
    notes = desired.notes,
    sources = desired.sources,
    sources_last_reviewed_at = desired.sources_last_reviewed_at,
    sources_reviewed_by_staff_id = NULL
FROM phase55_desired_general_rules AS desired
JOIN public.countries AS country ON country.name = desired.country_name
WHERE rule.country_id = country.id
  AND rule.visa_category = desired.visa_category
  AND rule.travel_method IS NULL
  AND rule.accommodation IS NULL
  AND rule.occupation IS NULL
  AND rule.with_children IS NULL
  AND rule.nationality IS NULL;

INSERT INTO public.country_visa_rules (
  country_id, visa_category, documents, processing_time, validity, max_stay,
  multiple_entry, notes, sources, sources_last_reviewed_at
)
SELECT
  country.id, desired.visa_category, desired.documents,
  desired.processing_time, desired.validity, desired.max_stay,
  true, desired.notes, desired.sources, desired.sources_last_reviewed_at
FROM phase55_desired_general_rules AS desired
JOIN public.countries AS country ON country.name = desired.country_name
WHERE NOT EXISTS (
  SELECT 1
  FROM public.country_visa_rules AS rule
  WHERE rule.country_id = country.id
    AND rule.visa_category = desired.visa_category
    AND rule.travel_method IS NULL
    AND rule.accommodation IS NULL
    AND rule.occupation IS NULL
    AND rule.with_children IS NULL
    AND rule.nationality IS NULL
);

CREATE TEMP TABLE phase55_overlay_definitions (
  country_name TEXT NOT NULL,
  occupation TEXT,
  with_children BOOLEAN,
  nationality TEXT,
  documents JSONB NOT NULL,
  label TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO phase55_overlay_definitions VALUES
  ('Almanya','calisan',NULL,NULL,'[
    {"name":"İşveren Görev ve İzin Yazısı","category":"mesleki","required":true},
    {"name":"SGK İşe Giriş Bildirgesi ve Hizmet Dökümü","category":"mesleki","required":true},
    {"name":"Son 3 Aylık Maaş Bordrosu","category":"finansal","required":true}
  ]','çalışan'),
  ('Almanya','memur',NULL,NULL,'[
    {"name":"Kurum Görev ve İzin Yazısı","category":"mesleki","required":true},
    {"name":"Kamu Görev Belgesi","category":"mesleki","required":true},
    {"name":"Son 3 Aylık Maaş Bordrosu","category":"finansal","required":true}
  ]','memur'),
  ('Almanya','emekli',NULL,NULL,'[
    {"name":"Emeklilik Belgesi","category":"mesleki","required":true},
    {"name":"Son 3 Aylık Emekli Maaşı Dökümü","category":"finansal","required":true}
  ]','emekli'),
  ('Almanya','ogrenci',NULL,NULL,'[
    {"name":"Güncel Öğrenci Belgesi","category":"egitim","required":true},
    {"name":"Sponsor Dilekçesi ve Finansal Belgeleri","category":"finansal","required":true}
  ]','öğrenci profili'),
  ('Almanya','sirket_sahibi',NULL,NULL,'[
    {"name":"Ticaret veya Sanayi Odası Sicil Kayıt Sureti","category":"mesleki","required":true},
    {"name":"Ticaret Sicil Gazetesi","category":"mesleki","required":true},
    {"name":"Vergi Levhası","category":"mesleki","required":true}
  ]','şirket sahibi'),
  ('Almanya','issiz',NULL,NULL,'[
    {"name":"Sponsor Dilekçesi ve Finansal Belgeleri","category":"finansal","required":true},
    {"name":"Sponsorla Yakınlık Kanıtı","category":"aile","required":true}
  ]','çalışmayan'),
  ('Almanya',NULL,true,NULL,'[
    {"name":"Çocuklar İçin Muvafakatname veya Velayet Kararı","category":"aile","required":true},
    {"name":"Çocukların Öğrenci Belgeleri","category":"egitim","required":false}
  ]','çocuklu seyahat'),
  ('Almanya',NULL,NULL,'diger','[
    {"name":"Türkiye Yasal İkamet Belgesi","category":"kimlik","required":true,"description":"Planlanan Schengen çıkışından sonra en az 3 ay geçerli"}
  ]','Türk vatandaşı olmayan'),

  ('Fransa','calisan',NULL,NULL,'[
    {"name":"İşveren Görev ve İzin Yazısı","category":"mesleki","required":true},
    {"name":"SGK İşe Giriş Bildirgesi ve Hizmet Dökümü","category":"mesleki","required":true},
    {"name":"Son 3 Aylık Maaş Bordrosu","category":"finansal","required":true}
  ]','çalışan'),
  ('Fransa','memur',NULL,NULL,'[
    {"name":"Kurum Görev ve İzin Yazısı","category":"mesleki","required":true},
    {"name":"Kamu Görev Belgesi","category":"mesleki","required":true},
    {"name":"Son 3 Aylık Maaş Bordrosu","category":"finansal","required":true}
  ]','memur'),
  ('Fransa','emekli',NULL,NULL,'[
    {"name":"Emeklilik Belgesi","category":"mesleki","required":true},
    {"name":"Son 3 Aylık Emekli Maaşı Dökümü","category":"finansal","required":true}
  ]','emekli'),
  ('Fransa','ogrenci',NULL,NULL,'[
    {"name":"Güncel Öğrenci Belgesi","category":"egitim","required":true},
    {"name":"Sponsor Dilekçesi ve Finansal Belgeleri","category":"finansal","required":true}
  ]','öğrenci profili'),
  ('Fransa','sirket_sahibi',NULL,NULL,'[
    {"name":"Faaliyet veya Oda Sicil Belgesi","category":"mesleki","required":true},
    {"name":"Ticaret Sicil Gazetesi","category":"mesleki","required":true},
    {"name":"Vergi Levhası","category":"mesleki","required":true},
    {"name":"İmza Sirküleri","category":"mesleki","required":true}
  ]','şirket sahibi'),
  ('Fransa','issiz',NULL,NULL,'[
    {"name":"Sponsor Dilekçesi ve Finansal Belgeleri","category":"finansal","required":true},
    {"name":"Sponsorla Yakınlık Kanıtı","category":"aile","required":true}
  ]','çalışmayan'),
  ('Fransa',NULL,true,NULL,'[
    {"name":"Çocuklar İçin Muvafakatname veya Velayet Kararı","category":"aile","required":true},
    {"name":"Çocukların Öğrenci Belgeleri","category":"egitim","required":false}
  ]','çocuklu seyahat'),
  ('Fransa',NULL,NULL,'diger','[
    {"name":"Türkiye Yasal İkamet Belgesi","category":"kimlik","required":true}
  ]','Türk vatandaşı olmayan'),

  ('İtalya','calisan',NULL,NULL,'[
    {"name":"İşveren Görev ve İzin Yazısı","category":"mesleki","required":true},
    {"name":"SGK İşe Giriş Bildirgesi ve Hizmet Dökümü","category":"mesleki","required":true},
    {"name":"Son 3 Aylık Maaş Bordrosu","category":"finansal","required":true}
  ]','çalışan'),
  ('İtalya','memur',NULL,NULL,'[
    {"name":"Kurum Görev ve İzin Yazısı","category":"mesleki","required":true},
    {"name":"Kamu Görev Belgesi","category":"mesleki","required":true},
    {"name":"Son 3 Aylık Maaş Bordrosu","category":"finansal","required":true}
  ]','memur'),
  ('İtalya','emekli',NULL,NULL,'[
    {"name":"Emeklilik Belgesi","category":"mesleki","required":true},
    {"name":"Son 3 Aylık Emekli Maaşı Dökümü","category":"finansal","required":true}
  ]','emekli'),
  ('İtalya','ogrenci',NULL,NULL,'[
    {"name":"Güncel Öğrenci Belgesi","category":"egitim","required":true},
    {"name":"Sponsor Dilekçesi ve Finansal Belgeleri","category":"finansal","required":true}
  ]','öğrenci profili'),
  ('İtalya','sirket_sahibi',NULL,NULL,'[
    {"name":"Faaliyet veya Oda Sicil Belgesi","category":"mesleki","required":true},
    {"name":"Ticaret Sicil Gazetesi","category":"mesleki","required":true},
    {"name":"Vergi Levhası","category":"mesleki","required":true}
  ]','şirket sahibi'),
  ('İtalya','issiz',NULL,NULL,'[
    {"name":"Sponsor Dilekçesi ve Finansal Belgeleri","category":"finansal","required":true},
    {"name":"Sponsorla Yakınlık Kanıtı","category":"aile","required":true}
  ]','çalışmayan'),
  ('İtalya',NULL,true,NULL,'[
    {"name":"Çocuklar İçin Muvafakatname veya Velayet Kararı","category":"aile","required":true},
    {"name":"Çocukların Öğrenci Belgeleri","category":"egitim","required":false}
  ]','çocuklu seyahat'),
  ('İtalya',NULL,NULL,'diger','[
    {"name":"Türkiye Oturum İzni","category":"kimlik","required":true}
  ]','Türk vatandaşı olmayan');

CREATE TEMP TABLE phase55_desired_overlays ON COMMIT DROP AS
SELECT
  general.country_name,
  general.visa_category,
  overlay.occupation,
  overlay.with_children,
  overlay.nationality,
  overlay.documents,
  'Faz 5.5 profil eki: ' || overlay.label || '. Genel listeyle birlikte uygulanır. '
    || CASE WHEN general.sources_last_reviewed_at IS NULL
      THEN 'Kesin profil listesi resmî araç/kontrol listesiyle doğrulanmayı bekliyor.'
      ELSE 'Bağlı genel kuralın resmî kaynağıyla doğrulandı.' END AS notes,
  general.sources,
  general.sources_last_reviewed_at
FROM phase55_desired_general_rules AS general
JOIN phase55_overlay_definitions AS overlay
  ON overlay.country_name = general.country_name
WHERE NOT (
  general.country_name = 'Almanya'
  AND general.visa_category = 'ogrenci'
  AND overlay.occupation IS NOT NULL
  AND overlay.occupation <> 'ogrenci'
);

UPDATE public.country_visa_rules AS rule
SET documents = desired.documents,
    notes = desired.notes,
    sources = desired.sources,
    sources_last_reviewed_at = desired.sources_last_reviewed_at,
    sources_reviewed_by_staff_id = NULL
FROM phase55_desired_overlays AS desired
JOIN public.countries AS country ON country.name = desired.country_name
WHERE rule.country_id = country.id
  AND rule.visa_category = desired.visa_category
  AND rule.travel_method IS NULL
  AND rule.accommodation IS NULL
  AND rule.occupation IS NOT DISTINCT FROM desired.occupation
  AND rule.with_children IS NOT DISTINCT FROM desired.with_children
  AND rule.nationality IS NOT DISTINCT FROM desired.nationality;

INSERT INTO public.country_visa_rules (
  country_id, visa_category, occupation, with_children, nationality,
  documents, multiple_entry, notes, sources, sources_last_reviewed_at
)
SELECT
  country.id, desired.visa_category, desired.occupation,
  desired.with_children, desired.nationality, desired.documents,
  true, desired.notes, desired.sources, desired.sources_last_reviewed_at
FROM phase55_desired_overlays AS desired
JOIN public.countries AS country ON country.name = desired.country_name
WHERE NOT EXISTS (
  SELECT 1
  FROM public.country_visa_rules AS rule
  WHERE rule.country_id = country.id
    AND rule.visa_category = desired.visa_category
    AND rule.travel_method IS NULL
    AND rule.accommodation IS NULL
    AND rule.occupation IS NOT DISTINCT FROM desired.occupation
    AND rule.with_children IS NOT DISTINCT FROM desired.with_children
    AND rule.nationality IS NOT DISTINCT FROM desired.nationality
);

COMMIT;
