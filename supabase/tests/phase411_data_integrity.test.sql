BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(10);

SELECT has_function(
  'public',
  'create_customer_application_v1',
  ARRAY['jsonb'],
  'guarded customer workflow remains public'
);
SELECT has_function(
  'public',
  'create_customer_application_v1_core',
  ARRAY['jsonb'],
  'original atomic workflow is retained as a private core'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.create_customer_application_v1(jsonb)', 'EXECUTE'),
  'authenticated staff can execute the guarded workflow'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.create_customer_application_v1_core(jsonb)', 'EXECUTE'),
  'authenticated staff cannot bypass duplicate and matching guards'
);

INSERT INTO auth.users (id, email, role, aud, email_confirmed_at)
VALUES (
  '24110000-0000-0000-0000-000000000001',
  'phase411@example.com',
  'authenticated',
  'authenticated',
  now()
);

INSERT INTO public.staff (id, user_id, full_name, email, role, is_active)
VALUES (
  '24110000-0000-0000-0000-000000000002',
  '24110000-0000-0000-0000-000000000001',
  'Faz 4.1.1 Admin',
  'phase411@example.com',
  'admin',
  true
);

INSERT INTO public.countries (id, name, active)
VALUES ('24110000-0000-0000-0000-000000000003', 'Faz 4.1.1 Ülkesi', true);

INSERT INTO public.country_visa_rules (
  id, country_id, visa_category, travel_method, documents, created_at
) VALUES
  (
    '24110000-0000-0000-0000-000000000004',
    '24110000-0000-0000-0000-000000000003',
    'turistik',
    NULL,
    '[{"name":"Genel Evrak","category":"temel","required":true}]'::JSONB,
    '2026-01-01T00:00:00Z'
  ),
  (
    '24110000-0000-0000-0000-000000000005',
    '24110000-0000-0000-0000-000000000003',
    'turistik',
    'ucak',
    '[{"name":"Uçak Evrakı","category":"seyahat","required":true}]'::JSONB,
    '2026-01-02T00:00:00Z'
  );

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"24110000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    SELECT public.create_customer_application_v1(
      '{
        "first_name":"Boş",
        "last_name":"Seçim",
        "phone":"0555 411 00 01",
        "passport_no":"P 411 001",
        "country_id":"24110000-0000-0000-0000-000000000003",
        "visa_type":"turistik"
      }'::JSONB
    )
  $$,
  'empty profile fields do not reject available rules'
);
SELECT results_eq(
  $$
    SELECT document.document_type
    FROM public.documents AS document
    JOIN public.applications AS application ON application.id = document.application_id
    JOIN public.customers AS customer ON customer.id = application.customer_id
    WHERE customer.passport_no = 'P 411 001'
  $$,
  $$ VALUES ('Genel Evrak'::TEXT) $$,
  'blank selection deterministically prefers the general fallback'
);

SELECT throws_ok(
  $$
    SELECT public.create_customer_application_v1(
      '{
        "first_name":"Mükerrer",
        "last_name":"Kayıt",
        "phone":"05554110001",
        "country_id":"24110000-0000-0000-0000-000000000003"
      }'::JSONB
    )
  $$,
  '23505',
  'possible_duplicate_customer',
  'normalized phone blocks an accidental duplicate'
);

SELECT lives_ok(
  $$
    SELECT public.create_customer_application_v1(
      '{
        "first_name":"Onaylı",
        "last_name":"Mükerrer",
        "phone":"05554110001",
        "country_id":"24110000-0000-0000-0000-000000000003",
        "allow_duplicate_customer":true
      }'::JSONB
    )
  $$,
  'explicit duplicate confirmation permits a genuinely separate customer'
);

SELECT lives_ok(
  $$
    SELECT public.create_customer_application_v1(
      '{
        "first_name":"Profil",
        "last_name":"Dolu",
        "phone":"05554110002",
        "country_id":"24110000-0000-0000-0000-000000000003",
        "travel_method":"ucak",
        "accommodation":"otel",
        "occupation":"calisan",
        "with_children":false,
        "nationality":"tc"
      }'::JSONB
    )
  $$,
  'selected profile values are accepted atomically'
);
SELECT results_eq(
  $$
    SELECT
      application.travel_method,
      application.accommodation,
      application.occupation,
      application.with_children,
      application.nationality,
      document.document_type
    FROM public.applications AS application
    JOIN public.customers AS customer ON customer.id = application.customer_id
    JOIN public.documents AS document ON document.application_id = application.id
    WHERE customer.phone = '05554110002'
    ORDER BY document.document_type
  $$,
  $$ VALUES
    ('ucak'::TEXT, 'otel'::TEXT, 'calisan'::TEXT, false, 'tc'::TEXT, 'Genel Evrak'::TEXT),
    ('ucak'::TEXT, 'otel'::TEXT, 'calisan'::TEXT, false, 'tc'::TEXT, 'Uçak Evrakı'::TEXT)
  $$,
  'profile values persist and merge general plus exact rules'
);

SELECT * FROM finish();
ROLLBACK;
