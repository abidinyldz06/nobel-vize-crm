BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(19);

SELECT has_column('public', 'country_visa_rules', 'sources', 'rule source catalog exists');
SELECT has_column(
  'public', 'country_visa_rules', 'sources_reviewed_by_staff_id',
  'source reviewer is retained'
);
SELECT has_function(
  'public', 'save_country_visa_rule_v1', ARRAY['uuid', 'jsonb', 'boolean'],
  'controlled rule save workflow exists'
);
SELECT has_function(
  'public', 'delete_country_visa_rule_v1', ARRAY['uuid'],
  'controlled rule delete workflow exists'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.save_country_visa_rule_v1(uuid, jsonb, boolean)',
    'EXECUTE'
  ),
  'authenticated staff can call the guarded rule workflow'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.save_country_visa_rule_v1(uuid, jsonb, boolean)',
    'EXECUTE'
  ),
  'anonymous users cannot call the guarded rule workflow'
);

INSERT INTO auth.users (id, email, role, aud, email_confirmed_at)
VALUES
  ('54000000-0000-0000-0000-000000000001', 'phase54-admin@example.test', 'authenticated', 'authenticated', now()),
  ('54000000-0000-0000-0000-000000000002', 'phase54-consultant@example.test', 'authenticated', 'authenticated', now());

INSERT INTO public.staff (id, user_id, full_name, email, role, is_active)
VALUES
  ('54000000-0000-0000-0000-000000000011', '54000000-0000-0000-0000-000000000001', 'Faz 5.4 Yönetici', 'phase54-admin@example.test', 'admin', true),
  ('54000000-0000-0000-0000-000000000012', '54000000-0000-0000-0000-000000000002', 'Faz 5.4 Danışman', 'phase54-consultant@example.test', 'consultant', true);

INSERT INTO public.countries (id, name, active)
VALUES ('54000000-0000-0000-0000-000000000021', 'Faz 5.4 Ülkesi', true);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"54000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    SELECT public.save_country_visa_rule_v1(
      NULL,
      '{
        "country_id":"54000000-0000-0000-0000-000000000021",
        "visa_category":"turistik",
        "documents":[{"name":"Pasaport","category":"temel","required":true}],
        "sources":[{
          "title":"Resmî Kaynak",
          "url":"https://example.test/official",
          "kind":"official",
          "review_due_at":"2026-11-04"
        }]
      }'::JSONB,
      true
    )
  $$,
  'admin can save and confirm a sourced visa rule'
);
SELECT is(
  (SELECT sources->0->>'kind' FROM public.country_visa_rules
    WHERE country_id = '54000000-0000-0000-0000-000000000021'),
  'official',
  'source kind is retained'
);
SELECT ok(
  (SELECT sources->0 ? 'checked_at' FROM public.country_visa_rules
    WHERE country_id = '54000000-0000-0000-0000-000000000021'),
  'confirmed source receives a server-side check time'
);
SELECT is(
  (SELECT sources_reviewed_by_staff_id FROM public.country_visa_rules
    WHERE country_id = '54000000-0000-0000-0000-000000000021'),
  '54000000-0000-0000-0000-000000000011'::UUID,
  'confirming admin is retained'
);
SELECT is(
  (SELECT count(*)::BIGINT FROM public.activity_log
    WHERE type = 'settings'
      AND action = 'Ülke evrak kuralı kaynakları doğrulandı: Faz 5.4 Ülkesi / turistik — Faz 5.4 Yönetici'),
  1::BIGINT,
  'confirmed rule save is audited'
);
SELECT throws_ok(
  $$ UPDATE public.country_visa_rules SET notes = 'Doğrudan yazım' $$,
  '42501',
  'permission denied for table country_visa_rules',
  'direct browser update cannot bypass the guarded workflow'
);
SELECT lives_ok(
  $$
    SELECT public.save_country_visa_rule_v1(
      (SELECT id FROM public.country_visa_rules
        WHERE country_id = '54000000-0000-0000-0000-000000000021'),
      '{
        "country_id":"54000000-0000-0000-0000-000000000021",
        "visa_category":"turistik",
        "documents":[
          {"name":"Pasaport","category":"temel","required":true},
          {"name":"Fotoğraf","category":"temel","required":true}
        ],
        "sources":[{
          "title":"Resmî Kaynak",
          "url":"https://example.test/official",
          "kind":"official",
          "review_due_at":"2026-11-04"
        }]
      }'::JSONB,
      false
    )
  $$,
  'admin can save changed content without falsely confirming it'
);
SELECT ok(
  (SELECT NOT (sources->0 ? 'checked_at')
    FROM public.country_visa_rules
    WHERE country_id = '54000000-0000-0000-0000-000000000021'),
  'content change clears the previous source confirmation'
);
SELECT throws_ok(
  $$
    SELECT public.save_country_visa_rule_v1(
      (SELECT id FROM public.country_visa_rules
        WHERE country_id = '54000000-0000-0000-0000-000000000021'),
      '{
        "country_id":"54000000-0000-0000-0000-000000000021",
        "visa_category":"turistik",
        "documents":[{"name":"Pasaport","category":"temel","required":true}],
        "sources":[{"title":"Güvensiz","url":"http://example.test","kind":"official"}]
      }'::JSONB,
      true
    )
  $$,
  '22023',
  'invalid_rule_source_entry',
  'non-HTTPS source is rejected'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"54000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$
    SELECT public.save_country_visa_rule_v1(
      NULL,
      '{"country_id":"54000000-0000-0000-0000-000000000021","visa_category":"is","documents":[],"sources":[]}'::JSONB,
      false
    )
  $$,
  '42501',
  'admin_required',
  'consultant cannot change the rule catalog'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"54000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$
    SELECT public.delete_country_visa_rule_v1(
      (SELECT id FROM public.country_visa_rules
        WHERE country_id = '54000000-0000-0000-0000-000000000021')
    )
  $$,
  'admin can delete a rule through the guarded workflow'
);
SELECT is(
  (SELECT count(*)::BIGINT FROM public.country_visa_rules
    WHERE country_id = '54000000-0000-0000-0000-000000000021'),
  0::BIGINT,
  'guarded delete removes the selected rule'
);
SELECT is(
  (SELECT count(*)::BIGINT FROM public.activity_log
    WHERE type = 'settings'
      AND action = 'Ülke evrak kuralı silindi: Faz 5.4 Ülkesi / turistik — Faz 5.4 Yönetici'),
  1::BIGINT,
  'guarded delete is audited'
);

SELECT * FROM finish();
ROLLBACK;
