BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(7);

SELECT hasnt_column(
  'public',
  'customers',
  'profile_score',
  'customers no longer expose a profile score'
);

SELECT results_eq(
  $$
    SELECT count(*)::BIGINT
    FROM pg_constraint
    WHERE conrelid = 'public.customers'::regclass
      AND conname = 'customers_profile_score_valid'
  $$,
  $$ VALUES (0::BIGINT) $$,
  'profile score constraint is removed'
);

SELECT results_eq(
  $$
    SELECT count(*)::BIGINT
    FROM pg_proc AS routine
    JOIN pg_namespace AS namespace ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname = 'public'
      AND routine.proname IN (
        'create_customer_application_v1',
        'update_customer_application_v1',
        'anonymize_customer_v1'
      )
      AND pg_get_functiondef(routine.oid) ILIKE '%profile_score%'
  $$,
  $$ VALUES (0::BIGINT) $$,
  'current customer workflows do not read or write the removed score'
);

SELECT results_eq(
  $$
    SELECT first_name
    FROM jsonb_populate_recordset(
      NULL::public.customers,
      '[{"first_name":"Legacy","profile_score":85}]'::JSONB
    )
  $$,
  $$ VALUES ('Legacy'::TEXT) $$,
  'legacy backup rows ignore the removed extra field'
);

SELECT has_function(
  'public',
  'create_customer_application_v1',
  ARRAY['jsonb'],
  'customer creation workflow remains available'
);

SELECT has_function(
  'public',
  'update_customer_application_v1',
  ARRAY['uuid', 'uuid', 'jsonb'],
  'customer update workflow remains available'
);

SELECT has_function(
  'public',
  'anonymize_customer_v1',
  ARRAY['uuid', 'uuid'],
  'customer anonymization workflow remains available'
);

SELECT * FROM finish();
ROLLBACK;
