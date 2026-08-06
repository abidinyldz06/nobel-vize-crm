BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(19);

SELECT has_column(
  'public', 'applications', 'matched_rule_ids',
  'application retains every catalog rule used for its document snapshot'
);
SELECT has_function(
  'public',
  'resolve_country_visa_documents_v1',
  ARRAY['uuid', 'text', 'text', 'text', 'text', 'boolean', 'text'],
  'layered document resolver exists'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.resolve_country_visa_documents_v1(uuid, text, text, text, text, boolean, text)',
    'EXECUTE'
  ),
  'authenticated staff can preview a layered catalog result'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.resolve_country_visa_documents_v1(uuid, text, text, text, text, boolean, text)',
    'EXECUTE'
  ),
  'anonymous users cannot resolve the internal catalog'
);

INSERT INTO auth.users (id, email, role, aud, email_confirmed_at)
VALUES (
  '55000000-0000-0000-0000-000000000001',
  'phase55-admin@example.test',
  'authenticated',
  'authenticated',
  now()
);

INSERT INTO public.staff (id, user_id, full_name, email, role, is_active)
VALUES (
  '55000000-0000-0000-0000-000000000011',
  '55000000-0000-0000-0000-000000000001',
  'Faz 5.5 Yönetici',
  'phase55-admin@example.test',
  'admin',
  true
);

INSERT INTO public.countries (id, name, active)
VALUES
  ('55000000-0000-0000-0000-000000000021', 'Faz 5.5 Katman Ülkesi', true),
  ('55000000-0000-0000-0000-000000000022', 'Faz 5.5 Eski Ülke', true);

INSERT INTO public.country_visa_rules (
  id, country_id, visa_category, occupation, with_children, travel_method,
  documents
) VALUES
  (
    '55000000-0000-0000-0000-000000000031',
    '55000000-0000-0000-0000-000000000021',
    'turistik', NULL, NULL, NULL,
    '[
      {"name":"Pasaport","category":"temel","required":true,"description":"Genel açıklama"},
      {"name":"Fotoğraf","category":"temel","required":true}
    ]'::JSONB
  ),
  (
    '55000000-0000-0000-0000-000000000032',
    '55000000-0000-0000-0000-000000000021',
    'turistik', 'ogrenci', NULL, NULL,
    '[
      {"name":" pasaport ","category":"temel","required":false,"description":"Öğrenci profili açıklaması"},
      {"name":"Öğrenci Belgesi","category":"mesleki","required":true}
    ]'::JSONB
  ),
  (
    '55000000-0000-0000-0000-000000000033',
    '55000000-0000-0000-0000-000000000021',
    'turistik', NULL, true, NULL,
    '[{"name":"Muvafakatname","category":"aile","required":true}]'::JSONB
  ),
  (
    '55000000-0000-0000-0000-000000000034',
    '55000000-0000-0000-0000-000000000021',
    'turistik', NULL, NULL, 'ucak',
    '[{"name":"Uçuş Rezervasyonu","category":"seyahat","required":true}]'::JSONB
  ),
  (
    '55000000-0000-0000-0000-000000000035',
    '55000000-0000-0000-0000-000000000022',
    'turistik', NULL, NULL, 'ucak',
    '[{"name":"Eski Tek Liste","category":"diger","required":true}]'::JSONB
  );

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"55000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT is(
  jsonb_array_length(
    public.resolve_country_visa_documents_v1(
      '55000000-0000-0000-0000-000000000021',
      'turistik', NULL, NULL, 'ogrenci', true, NULL
    )->'rule_ids'
  ),
  3,
  'general, occupation and children rules form one profile chain'
);
SELECT is(
  public.resolve_country_visa_documents_v1(
    '55000000-0000-0000-0000-000000000021',
    'turistik', NULL, NULL, 'ogrenci', true, NULL
  )->>'primary_rule_id',
  '55000000-0000-0000-0000-000000000031',
  'the general rule remains the primary rule'
);
SELECT is(
  jsonb_array_length(
    public.resolve_country_visa_documents_v1(
      '55000000-0000-0000-0000-000000000021',
      'turistik', NULL, NULL, 'ogrenci', true, NULL
    )->'documents'
  ),
  4,
  'layered rules produce four unique documents'
);
SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM jsonb_array_elements(
      public.resolve_country_visa_documents_v1(
        '55000000-0000-0000-0000-000000000021',
        'turistik', NULL, NULL, 'ogrenci', true, NULL
      )->'documents'
    ) AS document
    WHERE lower(btrim(document->>'name')) = 'pasaport'
  ),
  1,
  'duplicate document names are merged'
);
SELECT ok(
  (
    SELECT (document->>'required')::BOOLEAN
    FROM jsonb_array_elements(
      public.resolve_country_visa_documents_v1(
        '55000000-0000-0000-0000-000000000021',
        'turistik', NULL, NULL, 'ogrenci', true, NULL
      )->'documents'
    ) AS document
    WHERE lower(btrim(document->>'name')) = 'pasaport'
  ),
  'an optional overlay cannot weaken a required general document'
);
SELECT is(
  (
    SELECT document->>'description'
    FROM jsonb_array_elements(
      public.resolve_country_visa_documents_v1(
        '55000000-0000-0000-0000-000000000021',
        'turistik', NULL, NULL, 'ogrenci', true, NULL
      )->'documents'
    ) AS document
    WHERE lower(btrim(document->>'name')) = 'pasaport'
  ),
  'Öğrenci profili açıklaması',
  'the more specific overlay may improve a document description'
);
SELECT is(
  jsonb_array_length(
    public.resolve_country_visa_documents_v1(
      '55000000-0000-0000-0000-000000000021',
      'turistik', NULL, NULL, NULL, NULL, NULL
    )->'rule_ids'
  ),
  1,
  'blank profile fields do not activate overlays when a general rule exists'
);
SELECT is(
  jsonb_array_length(
    public.resolve_country_visa_documents_v1(
      '55000000-0000-0000-0000-000000000022',
      'turistik', NULL, NULL, NULL, NULL, NULL
    )->'rule_ids'
  ),
  1,
  'legacy catalogs without a general rule retain their only list as fallback'
);

SELECT lives_ok(
  $$
    SELECT public.create_customer_application_v1(
      '{
        "first_name":"Faz",
        "last_name":"5.5 Katman Testi",
        "country_id":"55000000-0000-0000-0000-000000000021",
        "visa_type":"turistik",
        "occupation":"ogrenci",
        "with_children":"false",
        "allow_duplicate_customer":true
      }'::JSONB
    )
  $$,
  'customer creation uses the layered server-side resolver'
);
SELECT is(
  (
    SELECT cardinality(application.matched_rule_ids)
    FROM public.applications AS application
    JOIN public.customers AS customer ON customer.id = application.customer_id
    WHERE customer.last_name = '5.5 Katman Testi'
  ),
  2,
  'new application stores the general and student rule ids'
);
SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.documents AS document
    JOIN public.applications AS application ON application.id = document.application_id
    JOIN public.customers AS customer ON customer.id = application.customer_id
    WHERE customer.last_name = '5.5 Katman Testi'
  ),
  3,
  'new application receives the merged unique document snapshot'
);

SELECT lives_ok(
  $$
    SELECT public.update_customer_application_v1(
      (SELECT id FROM public.customers WHERE last_name = '5.5 Katman Testi'),
      (
        SELECT application.id
        FROM public.applications AS application
        JOIN public.customers AS customer ON customer.id = application.customer_id
        WHERE customer.last_name = '5.5 Katman Testi'
      ),
      '{
        "first_name":"Faz",
        "last_name":"5.5 Katman Testi",
        "country_id":"55000000-0000-0000-0000-000000000021",
        "visa_type":"turistik",
        "status":"profil_analizi",
        "occupation":"ogrenci",
        "with_children":"true"
      }'::JSONB
    )
  $$,
  'profile edit synchronizes newly required catalog documents'
);
SELECT is(
  (
    SELECT cardinality(application.matched_rule_ids)
    FROM public.applications AS application
    JOIN public.customers AS customer ON customer.id = application.customer_id
    WHERE customer.last_name = '5.5 Katman Testi'
  ),
  3,
  'edited application stores every newly matched rule id'
);
SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.documents AS document
    JOIN public.applications AS application ON application.id = document.application_id
    JOIN public.customers AS customer ON customer.id = application.customer_id
    WHERE customer.last_name = '5.5 Katman Testi'
  ),
  4,
  'profile edit adds only the missing document'
);
SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.documents AS document
    JOIN public.applications AS application ON application.id = document.application_id
    JOIN public.customers AS customer ON customer.id = application.customer_id
    WHERE customer.last_name = '5.5 Katman Testi'
      AND document.document_type = 'Muvafakatname'
  ),
  1,
  'new profile overlay document is inserted exactly once'
);

SELECT * FROM finish();
ROLLBACK;
