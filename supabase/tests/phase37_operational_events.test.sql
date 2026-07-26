BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(18);

SELECT has_table('public', 'operational_events', 'operational event registry exists');
SELECT has_function(
  'public',
  'record_operational_event_v1',
  ARRAY['text', 'text', 'text', 'uuid', 'text', 'text'],
  'controlled operational event recorder exists'
);
SELECT has_function(
  'public',
  'resolve_operational_event_v1',
  ARRAY['uuid'],
  'admin resolution workflow exists'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.record_operational_event_v1(text,text,text,uuid,text,text)',
    'EXECUTE'
  ),
  'service role can record server-side operational events'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.record_operational_event_v1(text,text,text,uuid,text,text)',
    'EXECUTE'
  ),
  'anonymous callers cannot record operational events'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.operational_events', 'INSERT'),
  'authenticated users cannot directly insert operational events'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.operational_events', 'UPDATE'),
  'authenticated users cannot directly update operational events'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.operational_events', 'DELETE'),
  'authenticated users cannot directly delete operational events'
);
SELECT ok(
  (
    SELECT count(*) = 1
      AND bool_and(policyname = 'operational_events_admin_read')
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'operational_events'
  ),
  'operational events expose only the admin read policy'
);
SELECT results_eq(
  $$
    SELECT count(*)::BIGINT
    FROM pg_constraint
    WHERE conname = 'operational_events_resolved_by_staff_fk'
      AND conrelid = 'public.operational_events'::regclass
      AND confrelid = 'public.staff'::regclass
  $$,
  $$ VALUES (1::BIGINT) $$,
  'resolved actor references staff'
);

INSERT INTO auth.users (id, email, role, aud, email_confirmed_at)
VALUES (
  '29000000-0000-0000-0000-000000000001',
  'phase37-admin@example.com',
  'authenticated',
  'authenticated',
  now()
);

INSERT INTO public.staff (id, user_id, full_name, email, role, is_active)
VALUES (
  '19000000-0000-0000-0000-000000000001',
  '29000000-0000-0000-0000-000000000001',
  'Phase 37 Admin',
  'phase37-admin@example.com',
  'admin',
  true
);

SELECT set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);
SET LOCAL ROLE service_role;

SELECT lives_ok(
  $$
    SELECT public.record_operational_event_v1(
      'health.readiness.failed',
      'critical',
      'health',
      '39000000-0000-0000-0000-000000000001',
      '/api/health/ready',
      'storage_timeout'
    )
  $$,
  'service role records a safe operational event'
);
SELECT lives_ok(
  $$
    SELECT public.record_operational_event_v1(
      'health.readiness.failed',
      'critical',
      'health',
      '39000000-0000-0000-0000-000000000002',
      '/api/health/ready',
      'storage_timeout'
    )
  $$,
  'repeated operational event is accepted'
);
SELECT results_eq(
  $$
    SELECT count(*)::BIGINT
    FROM public.operational_events
    WHERE event_key = 'health.readiness.failed'
      AND error_code = 'storage_timeout'
  $$,
  $$ VALUES (1::BIGINT) $$,
  'repeated event fingerprints are deduplicated'
);
SELECT results_eq(
  $$
    SELECT occurrence_count
    FROM public.operational_events
    WHERE event_key = 'health.readiness.failed'
      AND error_code = 'storage_timeout'
  $$,
  $$ VALUES (2) $$,
  'deduplicated events increment their occurrence count'
);
SELECT results_eq(
  $$
    SELECT count(*)::BIGINT
    FROM public.notifications
    WHERE type = 'operation'
      AND recipient_staff_id = '19000000-0000-0000-0000-000000000001'
  $$,
  $$ VALUES (1::BIGINT) $$,
  'new operational events notify active admins once'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"29000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.operational_events WHERE status = 'open' $$,
  $$ VALUES (1::BIGINT) $$,
  'admin can read open operational events through RLS'
);
SELECT results_eq(
  $$
    SELECT public.resolve_operational_event_v1(
      (SELECT id FROM public.operational_events WHERE status = 'open' LIMIT 1)
    )
  $$,
  $$ VALUES (true) $$,
  'admin resolves an open operational event'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.operational_events WHERE status = 'resolved' $$,
  $$ VALUES (1::BIGINT) $$,
  'resolved operational event keeps its history'
);

SELECT * FROM finish();
ROLLBACK;
