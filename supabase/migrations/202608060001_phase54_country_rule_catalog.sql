-- Faz 5.4: Kaynak izlenebilir ülke/vize evrak kataloğu.
-- Evrak kuralları birden fazla resmî veya ikincil kaynak taşıyabilir. Kural
-- yazımı yalnız yönetici RPC'si üzerinden yapılır ve her değişiklik audit
-- kaydına alınır.

BEGIN;

ALTER TABLE public.country_visa_rules
  ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS sources_last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sources_reviewed_by_staff_id UUID
    CONSTRAINT country_visa_rules_sources_reviewer_fk
    REFERENCES public.staff(id) ON DELETE SET NULL;

UPDATE public.country_visa_rules
SET sources = '[]'::JSONB
WHERE sources IS NULL;

ALTER TABLE public.country_visa_rules
  DROP CONSTRAINT IF EXISTS country_visa_rules_sources_array,
  ADD CONSTRAINT country_visa_rules_sources_array
    CHECK (sources IS NULL OR jsonb_typeof(sources) = 'array') NOT VALID;

ALTER TABLE public.country_visa_rules
  VALIDATE CONSTRAINT country_visa_rules_sources_array;

-- Doğrudan tarayıcı yazımını kapat. Service role migration/yedek akışları
-- etkilenmez; uygulama yöneticileri aşağıdaki güvenli fonksiyonları kullanır.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.country_visa_rules FROM authenticated;

CREATE OR REPLACE FUNCTION public.save_country_visa_rule_v1(
  p_rule_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::JSONB,
  p_confirm_sources BOOLEAN DEFAULT false
)
RETURNS public.country_visa_rules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT;
  country_name TEXT;
  existing_rule public.country_visa_rules%ROWTYPE;
  saved_rule public.country_visa_rules%ROWTYPE;
  country_id_value UUID;
  visa_category_value TEXT := btrim(COALESCE(p_payload->>'visa_category', ''));
  travel_method_value TEXT := NULLIF(btrim(COALESCE(p_payload->>'travel_method', '')), '');
  accommodation_value TEXT := NULLIF(btrim(COALESCE(p_payload->>'accommodation', '')), '');
  occupation_value TEXT := NULLIF(btrim(COALESCE(p_payload->>'occupation', '')), '');
  with_children_value BOOLEAN := NULLIF(p_payload->>'with_children', '')::BOOLEAN;
  nationality_value TEXT := NULLIF(btrim(COALESCE(p_payload->>'nationality', '')), '');
  documents_value JSONB := COALESCE(p_payload->'documents', '[]'::JSONB);
  processing_time_value TEXT := NULLIF(btrim(COALESCE(p_payload->>'processing_time', '')), '');
  validity_value TEXT := NULLIF(btrim(COALESCE(p_payload->>'validity', '')), '');
  max_stay_value TEXT := NULLIF(btrim(COALESCE(p_payload->>'max_stay', '')), '');
  multiple_entry_value BOOLEAN := COALESCE((p_payload->>'multiple_entry')::BOOLEAN, true);
  notes_value TEXT := NULLIF(btrim(COALESCE(p_payload->>'notes', '')), '');
  raw_sources JSONB := COALESCE(p_payload->'sources', '[]'::JSONB);
  normalized_sources JSONB := '[]'::JSONB;
  existing_sources_without_checks JSONB := '[]'::JSONB;
  source_item JSONB;
  source_title TEXT;
  source_url TEXT;
  source_kind TEXT;
  source_review_due_at DATE;
  content_unchanged BOOLEAN := false;
BEGIN
  IF actor_staff_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  SELECT staff.full_name
  INTO actor_name
  FROM public.staff AS staff
  WHERE staff.id = actor_staff_id
    AND staff.is_active = true;

  IF actor_name IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  country_id_value := NULLIF(p_payload->>'country_id', '')::UUID;
  IF country_id_value IS NULL THEN
    RAISE EXCEPTION 'country_required' USING ERRCODE = '22023';
  END IF;

  SELECT country.name
  INTO country_name
  FROM public.countries AS country
  WHERE country.id = country_id_value;

  IF country_name IS NULL THEN
    RAISE EXCEPTION 'country_not_found' USING ERRCODE = '23503';
  END IF;

  IF visa_category_value NOT IN ('turistik', 'is', 'ogrenci', 'aile_ziyareti', 'diger') THEN
    RAISE EXCEPTION 'invalid_visa_category' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(documents_value) <> 'array'
    OR jsonb_array_length(documents_value) > 100 THEN
    RAISE EXCEPTION 'invalid_rule_documents' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(documents_value) AS document_entry(value)
    WHERE jsonb_typeof(document_entry.value) <> 'object'
      OR btrim(COALESCE(document_entry.value->>'name', '')) = ''
      OR length(btrim(document_entry.value->>'name')) > 180
      OR btrim(COALESCE(document_entry.value->>'category', '')) = ''
      OR (
        document_entry.value ? 'required'
        AND jsonb_typeof(document_entry.value->'required') <> 'boolean'
      )
  ) THEN
    RAISE EXCEPTION 'invalid_rule_document_entry' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(raw_sources) <> 'array'
    OR jsonb_array_length(raw_sources) > 10 THEN
    RAISE EXCEPTION 'invalid_rule_sources' USING ERRCODE = '22023';
  END IF;

  FOR source_item IN SELECT value FROM jsonb_array_elements(raw_sources)
  LOOP
    IF jsonb_typeof(source_item) <> 'object' THEN
      RAISE EXCEPTION 'invalid_rule_source_entry' USING ERRCODE = '22023';
    END IF;

    source_title := btrim(COALESCE(source_item->>'title', ''));
    source_url := btrim(COALESCE(source_item->>'url', ''));
    source_kind := btrim(COALESCE(source_item->>'kind', ''));
    source_review_due_at := NULLIF(source_item->>'review_due_at', '')::DATE;

    IF source_title = '' OR length(source_title) > 240
      OR source_url !~ '^https://[^[:space:]]+$' OR length(source_url) > 2048
      OR source_kind NOT IN ('official', 'secondary') THEN
      RAISE EXCEPTION 'invalid_rule_source_entry' USING ERRCODE = '22023';
    END IF;

    normalized_sources := normalized_sources || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'title', source_title,
        'url', source_url,
        'kind', source_kind,
        'review_due_at', source_review_due_at
      ))
    );
  END LOOP;

  IF p_confirm_sources AND jsonb_array_length(normalized_sources) = 0 THEN
    RAISE EXCEPTION 'source_required_for_confirmation' USING ERRCODE = '22023';
  END IF;

  IF p_rule_id IS NOT NULL THEN
    SELECT rule.*
    INTO existing_rule
    FROM public.country_visa_rules AS rule
    WHERE rule.id = p_rule_id
    FOR UPDATE;

    IF existing_rule.id IS NULL THEN
      RAISE EXCEPTION 'rule_not_found' USING ERRCODE = 'P0002';
    END IF;

    SELECT COALESCE(jsonb_agg(source_entry.value - 'checked_at'), '[]'::JSONB)
    INTO existing_sources_without_checks
    FROM jsonb_array_elements(COALESCE(existing_rule.sources, '[]'::JSONB))
      AS source_entry(value);

    content_unchanged :=
      existing_rule.country_id = country_id_value
      AND existing_rule.visa_category = visa_category_value
      AND existing_rule.travel_method IS NOT DISTINCT FROM travel_method_value
      AND existing_rule.accommodation IS NOT DISTINCT FROM accommodation_value
      AND existing_rule.occupation IS NOT DISTINCT FROM occupation_value
      AND existing_rule.with_children IS NOT DISTINCT FROM with_children_value
      AND existing_rule.nationality IS NOT DISTINCT FROM nationality_value
      AND existing_rule.documents = documents_value
      AND existing_rule.processing_time IS NOT DISTINCT FROM processing_time_value
      AND existing_rule.validity IS NOT DISTINCT FROM validity_value
      AND existing_rule.max_stay IS NOT DISTINCT FROM max_stay_value
      AND existing_rule.multiple_entry = multiple_entry_value
      AND existing_rule.notes IS NOT DISTINCT FROM notes_value
      AND existing_sources_without_checks = normalized_sources;
  END IF;

  IF p_confirm_sources THEN
    SELECT COALESCE(
      jsonb_agg(source_entry.value || jsonb_build_object('checked_at', now())),
      '[]'::JSONB
    )
    INTO normalized_sources
    FROM jsonb_array_elements(normalized_sources) AS source_entry(value);
  ELSIF content_unchanged THEN
    normalized_sources := COALESCE(existing_rule.sources, '[]'::JSONB);
  END IF;

  IF p_rule_id IS NULL THEN
    INSERT INTO public.country_visa_rules (
      country_id, visa_category, travel_method, accommodation, occupation,
      with_children, nationality, documents, processing_time, validity,
      max_stay, multiple_entry, notes, sources,
      sources_last_reviewed_at, sources_reviewed_by_staff_id
    ) VALUES (
      country_id_value, visa_category_value, travel_method_value,
      accommodation_value, occupation_value, with_children_value,
      nationality_value, documents_value, processing_time_value,
      validity_value, max_stay_value, multiple_entry_value, notes_value,
      normalized_sources,
      CASE WHEN p_confirm_sources THEN now() ELSE NULL END,
      CASE WHEN p_confirm_sources THEN actor_staff_id ELSE NULL END
    )
    RETURNING * INTO saved_rule;
  ELSE
    UPDATE public.country_visa_rules AS rule
    SET country_id = country_id_value,
        visa_category = visa_category_value,
        travel_method = travel_method_value,
        accommodation = accommodation_value,
        occupation = occupation_value,
        with_children = with_children_value,
        nationality = nationality_value,
        documents = documents_value,
        processing_time = processing_time_value,
        validity = validity_value,
        max_stay = max_stay_value,
        multiple_entry = multiple_entry_value,
        notes = notes_value,
        sources = normalized_sources,
        sources_last_reviewed_at = CASE
          WHEN p_confirm_sources THEN now()
          WHEN content_unchanged THEN existing_rule.sources_last_reviewed_at
          ELSE NULL
        END,
        sources_reviewed_by_staff_id = CASE
          WHEN p_confirm_sources THEN actor_staff_id
          WHEN content_unchanged THEN existing_rule.sources_reviewed_by_staff_id
          ELSE NULL
        END
    WHERE rule.id = p_rule_id
    RETURNING * INTO saved_rule;
  END IF;

  INSERT INTO public.activity_log (
    action, performed_by, performed_by_staff_id, type
  ) VALUES (
    CASE WHEN p_confirm_sources
      THEN 'Ülke evrak kuralı kaynakları doğrulandı: '
      ELSE 'Ülke evrak kuralı güncellendi: '
    END || country_name || ' / ' || visa_category_value || ' — ' || actor_name,
    actor_name,
    actor_staff_id,
    'settings'
  );

  RETURN saved_rule;
END
$$;

CREATE OR REPLACE FUNCTION public.delete_country_visa_rule_v1(p_rule_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT;
  deleted_country_name TEXT;
  deleted_visa_category TEXT;
BEGIN
  IF actor_staff_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  SELECT staff.full_name
  INTO actor_name
  FROM public.staff AS staff
  WHERE staff.id = actor_staff_id
    AND staff.is_active = true;

  IF actor_name IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.country_visa_rules AS rule
  USING public.countries AS country
  WHERE rule.id = p_rule_id
    AND country.id = rule.country_id
  RETURNING country.name, rule.visa_category
  INTO deleted_country_name, deleted_visa_category;

  IF deleted_country_name IS NULL THEN
    RAISE EXCEPTION 'rule_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.activity_log (
    action, performed_by, performed_by_staff_id, type
  ) VALUES (
    'Ülke evrak kuralı silindi: ' || deleted_country_name || ' / '
      || deleted_visa_category || ' — ' || actor_name,
    actor_name,
    actor_staff_id,
    'settings'
  );

  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.save_country_visa_rule_v1(UUID, JSONB, BOOLEAN)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_country_visa_rule_v1(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_country_visa_rule_v1(UUID, JSONB, BOOLEAN)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_country_visa_rule_v1(UUID)
  TO authenticated;

-- İlk doğrulanmış paket: Türkiye'den Almanya'ya iş seyahati Schengen vizesi.
-- Resmî sayfadaki genel, meslek ve seyahat amacı belgeleri tek listede;
-- profile bağlı belgeler açıklamasıyla opsiyonel tutulur.
UPDATE public.country_visa_rules AS rule
SET documents = '[
    {"name":"Vize Başvuru Formu ve Beyanname","category":"temel","required":true,"description":"Eksiksiz doldurulmuş ve şahsen imzalanmış"},
    {"name":"Pasaport","category":"temel","required":true,"description":"En az 2 boş sayfa; son 10 yılda düzenlenmiş; dönüşten sonra en az 3 ay geçerli"},
    {"name":"Biyometrik Fotoğraf (1 Adet)","category":"temel","required":true,"description":"35x45 mm, son 6 ay içinde çekilmiş"},
    {"name":"Geçerli ve Önceki Vize Fotokopileri","category":"temel","required":false,"description":"Varsa Schengen, AB, Birleşik Krallık, ABD ve Kanada vizeleri ile ilgili pasaport sayfaları"},
    {"name":"Seyahat Sağlık Sigortası","category":"seyahat","required":true,"description":"En az 30.000 € teminatlı ve planlanan ilk kalışın tamamını kapsayan poliçe"},
    {"name":"Ulaşım Rezervasyonu veya Seyahat Planı","category":"seyahat","required":true,"description":"Uçuş, diğer ulaşım rezervasyonu veya seyahat planını kanıtlayan belge"},
    {"name":"Konaklama Kanıtı","category":"seyahat","required":true,"description":"Otel rezervasyonu/ödemesi veya diğer konaklama belgesi"},
    {"name":"Tam Tekmil Vukuatlı Nüfus Kayıt Örneği","category":"kimlik","required":true,"description":"E-Devlet üzerinden barkod/QR kodlu"},
    {"name":"Son 3 Aylık Banka Hesap Özetleri","category":"finansal","required":true,"description":"Planlanan seyahat masraflarını karşılayacak maddi imkân kanıtı"},
    {"name":"Son 3 Aylık Maaş veya Emekli Maaşı Kanıtı","category":"finansal","required":false,"description":"Çalışma veya emeklilik durumuna göre"},
    {"name":"Almanya Şirket Davet Yazısı","category":"mesleki","required":true,"description":"Davet eden şirket, seyahat amacı/süresi ve masraf garantisi bilgilerini içermeli"},
    {"name":"Davet Eden Alman Şirketin Sicil Kayıt Sureti","category":"mesleki","required":true,"description":"6 aydan eski olmamalı"},
    {"name":"Türkiye İşveren Görev ve İzin Yazısı","category":"mesleki","required":false,"description":"İşçi, ücretli çalışan veya memur ise resmî sayfadaki tüm bilgileri içeren asıl belge"},
    {"name":"SGK İşe Giriş Bildirgesi ve Hizmet Dökümü","category":"mesleki","required":false,"description":"İşçi veya ücretli çalışan ise E-Devlet barkod/QR kodlu"},
    {"name":"Ziraat Odası Çiftçilik Belgesi","category":"mesleki","required":false,"description":"Çiftçi ise"},
    {"name":"Ticaret veya Sanayi Odası Sicil Kayıt Sureti","category":"mesleki","required":false,"description":"Firma sahibi/serbest meslek sahibi ise, 6 aydan eski olmamalı"},
    {"name":"Ticaret Sicil Gazetesi","category":"mesleki","required":false,"description":"Firma sahibi/serbest meslek sahibi ise"},
    {"name":"Vergi Levhası","category":"mesleki","required":false,"description":"Firma sahibi/serbest meslek sahibi ise"},
    {"name":"Güncel Öğrenci Belgesi","category":"mesleki","required":false,"description":"Başvuru sahibi öğrenci ise"},
    {"name":"Türkiye Yasal İkamet Belgesi","category":"kimlik","required":false,"description":"Türk vatandaşı değilse, planlanan Schengen çıkışından sonra en az 3 ay geçerli"},
    {"name":"Fuar Katılım veya Giriş Belgesi","category":"mesleki","required":false,"description":"Seyahat amacı fuar ise"},
    {"name":"Federal İş Ajansı Bildirim Belgesi","category":"mesleki","required":false,"description":"Makine/donanım/yazılım montaj, bakım veya onarım faaliyeti varsa"}
  ]'::JSONB,
    processing_time = 'Genellikle 15 gün; özel durumlarda 45 güne kadar',
    validity = 'Karara göre 1-5 yıl',
    max_stay = '180 günde en fazla 90 gün',
    notes = 'Türkiye’den Almanya’ya iş seyahati Schengen vizesi. Kişisel duruma göre ek belge istenebilir.',
    sources = '[
      {
        "title":"Almanya Dışişleri Bakanlığı — İş Seyahati Vizesi",
        "url":"https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768816-2768816",
        "kind":"official",
        "checked_at":"2026-08-06T09:00:00+03:00",
        "review_due_at":"2026-11-04"
      },
      {
        "title":"Almanya Dışişleri Bakanlığı — Schengen Vizesi Genel Bilgiler",
        "url":"https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768812-2768812",
        "kind":"official",
        "checked_at":"2026-08-06T09:00:00+03:00",
        "review_due_at":"2026-11-04"
      },
      {
        "title":"3GEN Vize — Almanya Vizesi",
        "url":"https://3genvize.com/ulkeler/almanya-vizesi/",
        "kind":"secondary",
        "checked_at":"2026-08-06T09:00:00+03:00",
        "review_due_at":"2026-11-04"
      }
    ]'::JSONB,
    sources_last_reviewed_at = '2026-08-06T09:00:00+03:00',
    sources_reviewed_by_staff_id = NULL
FROM public.countries AS country
WHERE country.id = rule.country_id
  AND country.name = 'Almanya'
  AND rule.visa_category = 'is'
  AND rule.travel_method IS NULL
  AND rule.accommodation IS NULL
  AND rule.occupation IS NULL
  AND rule.with_children IS NULL
  AND rule.nationality IS NULL;

-- Fransa listeleri profile göre Visa Assistant tarafından üretildiğinden,
-- mevcut içerik doğrulanmış sayılmaz. Resmî ve ikincil referanslar inceleme
-- kuyruğuna eklenir; checked_at özellikle boş bırakılır.
UPDATE public.country_visa_rules AS rule
SET sources = CASE rule.visa_category
      WHEN 'turistik' THEN '[
        {"title":"France-Visas — Tourist stay of less than 3 months","url":"https://france-visas.gouv.fr/en/web/france-visas/sejour-touristique-de-moins-de-3-mois","kind":"official","review_due_at":"2026-09-05"},
        {"title":"France-Visas — Visa Assistant","url":"https://france-visas.gouv.fr/en/web/france-visas/assistant-visa","kind":"official","review_due_at":"2026-09-05"},
        {"title":"3GEN Vize — Fransa Vizesi","url":"https://3genvize.com/ulkeler/fransa-vizesi/","kind":"secondary","review_due_at":"2026-09-05"}
      ]'::JSONB
      WHEN 'ogrenci' THEN '[
        {"title":"France-Visas — Student","url":"https://www.france-visas.gouv.fr/en/etudiant","kind":"official","review_due_at":"2026-09-05"},
        {"title":"France-Visas — Visa Assistant","url":"https://france-visas.gouv.fr/en/web/france-visas/assistant-visa","kind":"official","review_due_at":"2026-09-05"},
        {"title":"3GEN Vize — Fransa Vizesi","url":"https://3genvize.com/ulkeler/fransa-vizesi/","kind":"secondary","review_due_at":"2026-09-05"}
      ]'::JSONB
      ELSE rule.sources
    END,
    sources_last_reviewed_at = NULL,
    sources_reviewed_by_staff_id = NULL
FROM public.countries AS country
WHERE country.id = rule.country_id
  AND country.name = 'Fransa'
  AND rule.visa_category IN ('turistik', 'ogrenci')
  AND rule.travel_method IS NULL
  AND rule.accommodation IS NULL
  AND rule.occupation IS NULL
  AND rule.with_children IS NULL
  AND rule.nationality IS NULL;

COMMIT;
