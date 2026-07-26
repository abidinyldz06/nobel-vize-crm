BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(16);

SELECT has_table('public', 'backup_runs', 'backup run registry exists');
SELECT has_function('public', 'start_backup_run_v1', ARRAY['text', 'text', 'text'], 'backup start workflow exists');
SELECT has_function(
  'public',
  'complete_backup_run_v1',
  ARRAY['uuid', 'integer', 'bigint', 'bigint', 'bigint', 'text'],
  'backup completion workflow exists'
);
SELECT has_function('public', 'fail_backup_run_v1', ARRAY['uuid', 'text'], 'backup failure workflow exists');
SELECT has_function('public', 'verify_backup_run_v1', ARRAY['uuid', 'text'], 'backup verification workflow exists');
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.backup_runs', 'INSERT'),
  'authenticated users cannot directly insert backup runs'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.backup_runs', 'UPDATE'),
  'authenticated users cannot directly update backup runs'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.start_backup_run_v1(text,text,text)', 'EXECUTE'),
  'anonymous callers cannot start backup runs'
);

INSERT INTO auth.users (id, email, role, aud, email_confirmed_at)
VALUES (
  '29000000-0000-0000-0000-000000000002',
  'backup-admin@example.com',
  'authenticated',
  'authenticated',
  now()
);
INSERT INTO public.staff (id, user_id, full_name, email, role, is_active)
VALUES (
  '19000000-0000-0000-0000-000000000002',
  '29000000-0000-0000-0000-000000000002',
  'Backup Admin',
  'backup-admin@example.com',
  'admin',
  true
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"29000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

CREATE TEMP TABLE phase37_backup_run AS
SELECT public.start_backup_run_v1(
  'full',
  'manual',
  'nobel-vize-backup-v2-test.json'
) AS id;
GRANT SELECT ON phase37_backup_run TO authenticated;

SELECT results_eq(
  $$ SELECT status FROM public.backup_runs WHERE id = (SELECT id FROM phase37_backup_run) $$,
  $$ VALUES ('started'::TEXT) $$,
  'admin starts a tracked backup run'
);
SELECT results_eq(
  $$
    SELECT public.complete_backup_run_v1(
      (SELECT id FROM phase37_backup_run),
      24,
      120,
      3,
      4096,
      repeat('a', 64)
    )
  $$,
  $$ VALUES (true) $$,
  'admin completes a backup run with inventory and checksum'
);
SELECT results_eq(
  $$ SELECT status FROM public.backup_runs WHERE id = (SELECT id FROM phase37_backup_run) $$,
  $$ VALUES ('completed'::TEXT) $$,
  'completed backup awaits verification'
);
SELECT results_eq(
  $$
    SELECT public.verify_backup_run_v1(
      (SELECT id FROM phase37_backup_run),
      repeat('b', 64)
    )
  $$,
  $$ VALUES (false) $$,
  'mismatched checksum cannot verify a backup'
);
SELECT results_eq(
  $$
    SELECT public.verify_backup_run_v1(
      (SELECT id FROM phase37_backup_run),
      repeat('a', 64)
    )
  $$,
  $$ VALUES (true) $$,
  'matching checksum verifies a backup'
);
SELECT results_eq(
  $$
    SELECT database_table_count, database_row_count, storage_object_count, storage_bytes
    FROM public.backup_runs
    WHERE id = (SELECT id FROM phase37_backup_run)
  $$,
  $$ VALUES (24, 120::BIGINT, 3::BIGINT, 4096::BIGINT) $$,
  'verified backup keeps database and Storage inventory'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.backup_runs WHERE status = 'verified' AND verified_by_staff_id IS NOT NULL $$,
  $$ VALUES (1::BIGINT) $$,
  'verified backup records its admin verifier'
);

RESET ROLE;
SELECT ok(
  NOT has_table_privilege('anon', 'public.backup_runs', 'SELECT'),
  'anonymous callers have no backup history read privilege'
);

SELECT * FROM finish();
ROLLBACK;
