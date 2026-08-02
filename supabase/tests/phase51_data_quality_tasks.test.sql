BEGIN;
SELECT plan(15);

SELECT has_function('public', 'sync_data_quality_tasks_v1', ARRAY[]::TEXT[], 'data quality task sync exists');
SELECT has_function('public', 'set_task_assignee_v1', ARRAY['uuid', 'uuid'], 'admin task reassignment workflow exists');
SELECT ok(
  has_function_privilege('authenticated', 'public.sync_data_quality_tasks_v1()', 'EXECUTE'),
  'authenticated staff can invoke the controlled data quality sync'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.sync_data_quality_tasks_v1()', 'EXECUTE'),
  'anon cannot invoke the data quality sync'
);

INSERT INTO auth.users (id, email, role, aud, email_confirmed_at)
VALUES
  ('51000000-0000-0000-0000-000000000001', 'phase51-admin@example.test', 'authenticated', 'authenticated', now()),
  ('51000000-0000-0000-0000-000000000002', 'phase51-consultant@example.test', 'authenticated', 'authenticated', now());

INSERT INTO public.staff (id, user_id, full_name, email, role, is_active)
VALUES
  ('51000000-0000-0000-0000-000000000011', '51000000-0000-0000-0000-000000000001', 'Phase 5.1 Admin', 'phase51-admin@example.test', 'admin', true),
  ('51000000-0000-0000-0000-000000000012', '51000000-0000-0000-0000-000000000002', 'Phase 5.1 Danışman', 'phase51-consultant@example.test', 'consultant', true);

INSERT INTO public.countries (id, name)
VALUES ('51000000-0000-0000-0000-000000000021', 'Test Ülkesi');

INSERT INTO public.customers (id, first_name, last_name, assigned_staff_id)
VALUES (
  '51000000-0000-0000-0000-000000000031',
  'Eksik',
  'Bilgi',
  '51000000-0000-0000-0000-000000000012'
);

INSERT INTO public.applications (
  id, customer_id, country, visa_type, status, assigned_staff_id
) VALUES (
  '51000000-0000-0000-0000-000000000041',
  '51000000-0000-0000-0000-000000000031',
  'Test Ülkesi',
  'turistik',
  'profil_analizi',
  '51000000-0000-0000-0000-000000000012'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ SELECT public.sync_data_quality_tasks_v1() $$,
  'admin syncs incomplete customer and application data into tasks'
);
SELECT is(
  (SELECT count(*)::BIGINT FROM public.tasks WHERE customer_id = '51000000-0000-0000-0000-000000000031' AND source_type = 'data_quality'),
  5::BIGINT,
  'contact, passport, country and profile gaps create five tasks'
);

RESET ROLE;
SELECT is(
  (SELECT count(*)::BIGINT FROM public.notifications WHERE task_id IN (
    SELECT id FROM public.tasks WHERE customer_id = '51000000-0000-0000-0000-000000000031' AND source_type = 'data_quality'
  )),
  5::BIGINT,
  'each new data quality task notifies the assigned consultant'
);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT public.set_task_assignee_v1(
    (SELECT id FROM public.tasks WHERE idempotency_key = 'data-quality:customer:51000000-0000-0000-0000-000000000031:contact'),
    '51000000-0000-0000-0000-000000000011'
  ) $$,
  'admin can reassign a data quality task'
);
SELECT is(
  (SELECT assigned_staff_id FROM public.tasks WHERE idempotency_key = 'data-quality:customer:51000000-0000-0000-0000-000000000031:contact'),
  '51000000-0000-0000-0000-000000000011'::UUID,
  'manual reassignment is retained during later syncs'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.set_task_assignee_v1(
    (SELECT id FROM public.tasks WHERE idempotency_key = 'data-quality:customer:51000000-0000-0000-0000-000000000031:contact'),
    '51000000-0000-0000-0000-000000000012'
  ) $$,
  '42501',
  'admin_required',
  'consultant cannot reassign a task'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT public.sync_data_quality_tasks_v1() $$,
  'repeated data quality sync is idempotent'
);
SELECT is(
  (SELECT count(*)::BIGINT FROM public.tasks WHERE customer_id = '51000000-0000-0000-0000-000000000031' AND source_type = 'data_quality'),
  5::BIGINT,
  'repeated sync does not duplicate tasks'
);

RESET ROLE;
UPDATE public.customers
SET phone = '05055555151', email = 'eksik.bilgi@example.test', passport_no = 'U5100001', passport_expiry = current_date + 365
WHERE id = '51000000-0000-0000-0000-000000000031';
UPDATE public.applications
SET country_id = '51000000-0000-0000-0000-000000000021',
    travel_method = 'ucak',
    accommodation = 'otel',
    occupation = 'calisan',
    with_children = false,
    nationality = 'tc'
WHERE id = '51000000-0000-0000-0000-000000000041';

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT public.sync_data_quality_tasks_v1() $$,
  'admin refreshes the queue after completing the data'
);
SELECT is(
  (SELECT count(*)::BIGINT FROM public.tasks WHERE customer_id = '51000000-0000-0000-0000-000000000031' AND source_type = 'data_quality' AND status = 'completed'),
  5::BIGINT,
  'resolved data automatically completes its related tasks'
);
SELECT is(
  (SELECT count(*)::BIGINT FROM public.tasks WHERE customer_id = '51000000-0000-0000-0000-000000000031' AND source_type = 'data_quality' AND status IN ('pending', 'in_progress')),
  0::BIGINT,
  'no open task remains after the data is complete'
);

SELECT * FROM finish();
ROLLBACK;
