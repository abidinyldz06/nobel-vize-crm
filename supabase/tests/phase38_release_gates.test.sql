BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(9);

SELECT results_eq(
  $$
    SELECT count(*)::BIGINT
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind = 'r'
      AND NOT relation.relrowsecurity
  $$,
  $$ VALUES (0::BIGINT) $$,
  'every public application table has RLS enabled'
);

SELECT results_eq(
  $$
    SELECT count(*)::BIGINT
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'PUBLIC')
  $$,
  $$ VALUES (0::BIGINT) $$,
  'anonymous and PUBLIC roles have no public table privileges'
);

SELECT results_eq(
  $$
    SELECT count(*)::BIGINT
    FROM information_schema.role_routine_grants
    WHERE specific_schema = 'public'
      AND grantee IN ('anon', 'PUBLIC')
  $$,
  $$ VALUES (0::BIGINT) $$,
  'anonymous and PUBLIC roles have no public function execution privileges'
);

SELECT results_eq(
  $$
    SELECT count(*)::BIGINT
    FROM pg_proc AS routine
    JOIN pg_namespace AS namespace ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname = 'public'
      AND routine.prosecdef
      AND NOT COALESCE(routine.proconfig, ARRAY[]::TEXT[]) @> ARRAY['search_path=""']
  $$,
  $$ VALUES (0::BIGINT) $$,
  'every SECURITY DEFINER function pins an empty search path'
);

SELECT results_eq(
  $$
    SELECT count(*)::BIGINT
    FROM public.staff
    WHERE is_active AND user_id IS NULL
  $$,
  $$ VALUES (0::BIGINT) $$,
  'active staff cannot lose the Auth user link'
);

SELECT results_eq(
  $$
    SELECT count(*)::BIGINT
    FROM pg_constraint
    WHERE conrelid = 'public.staff'::regclass
      AND conname = 'staff_active_requires_auth_link'
      AND convalidated
  $$,
  $$ VALUES (1::BIGINT) $$,
  'active staff Auth-link constraint is validated'
);

SELECT results_eq(
  $$
    SELECT count(*)::BIGINT
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'staff'
      AND indexname = 'uq_staff_user_id'
  $$,
  $$ VALUES (1::BIGINT) $$,
  'one Auth user can map to only one staff record'
);

SELECT trigger_is(
  'public',
  'activity_log',
  'activity_log_set_actor',
  'public',
  'set_activity_actor',
  'audit actor trigger remains attached'
);

SELECT results_eq(
  $$
    SELECT count(*)::BIGINT
    FROM public.activity_log
    WHERE NULLIF(btrim(action), '') IS NULL
      OR NULLIF(btrim(performed_by), '') IS NULL
  $$,
  $$ VALUES (0::BIGINT) $$,
  'existing audit records keep action and actor labels'
);

SELECT * FROM finish();
ROLLBACK;
