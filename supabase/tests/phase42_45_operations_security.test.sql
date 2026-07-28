BEGIN;
SELECT plan(41);

SELECT has_table('public', 'scheduled_job_runs', 'scheduled job history exists');
SELECT has_table('public', 'security_events', 'security audit history exists');
SELECT has_table('public', 'communication_preferences', 'channel permission table exists');
SELECT has_table('public', 'message_outbox', 'message outbox exists');
SELECT has_function('public', 'run_scheduled_operations_v1', ARRAY['text'], 'scheduled operation runner exists');
SELECT has_function('public', 'check_login_rate_limit_v1', ARRAY['text'], 'login limit check exists');
SELECT has_function('public', 'record_login_attempt_v1', ARRAY['text', 'boolean', 'uuid', 'uuid'], 'login attempt recorder exists');
SELECT has_function('public', 'list_current_user_sessions_v1', ARRAY[]::TEXT[], 'session list workflow exists');
SELECT has_function('public', 'set_communication_preference_v1', ARRAY['jsonb'], 'communication permission workflow exists');
SELECT has_function('public', 'enqueue_message_v1', ARRAY['jsonb'], 'message enqueue workflow exists');
SELECT has_function('public', 'apply_message_delivery_event_v1', ARRAY['uuid', 'text', 'text', 'text'], 'provider delivery workflow exists');

SELECT ok(NOT has_table_privilege('anon', 'public.scheduled_job_runs', 'SELECT'), 'anon cannot read scheduled runs');
SELECT ok(NOT has_table_privilege('authenticated', 'public.scheduled_job_runs', 'INSERT'), 'staff cannot forge scheduled runs');
SELECT ok(NOT has_table_privilege('authenticated', 'public.security_events', 'INSERT'), 'staff cannot forge security audit');
SELECT ok(NOT has_table_privilege('authenticated', 'public.message_outbox', 'INSERT'), 'staff cannot bypass enqueue workflow');
SELECT ok(NOT has_function_privilege('authenticated', 'public.run_scheduled_operations_v1(text)', 'EXECUTE'), 'staff cannot invoke service cron runner');
SELECT ok(has_function_privilege('service_role', 'public.run_scheduled_operations_v1(text)', 'EXECUTE'), 'service role invokes cron runner');
SELECT ok(NOT has_function_privilege('anon', 'public.enqueue_message_v1(jsonb)', 'EXECUTE'), 'anon cannot enqueue messages');
SELECT ok(has_function_privilege('authenticated', 'public.enqueue_message_v1(jsonb)', 'EXECUTE'), 'staff uses controlled enqueue workflow');
SELECT ok(NOT has_function_privilege('authenticated', 'public.apply_message_delivery_event_v1(uuid,text,text,text)', 'EXECUTE'), 'staff cannot forge provider delivery');

INSERT INTO auth.users (id, email, role, aud, email_confirmed_at)
VALUES ('42000000-0000-0000-0000-000000000001', 'phase42-admin@example.test', 'authenticated', 'authenticated', now());
INSERT INTO public.staff (id, user_id, full_name, email, role, is_active)
VALUES ('42000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000001', 'Phase 42 Admin', 'phase42-admin@example.test', 'admin', true);
INSERT INTO public.customers (
  id, first_name, last_name, phone, passport_expiry, assigned_staff_id
) VALUES (
  '42000000-0000-0000-0000-000000000003', 'Cron', 'Müşteri', '05000004242',
  current_date + 20, '42000000-0000-0000-0000-000000000002'
);

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
CREATE TEMP TABLE first_operation_run AS
SELECT public.run_scheduled_operations_v1('2026-07-28T09:00:00Z') AS result;
CREATE TEMP TABLE second_operation_run AS
SELECT public.run_scheduled_operations_v1('2026-07-28T09:00:00Z') AS result;
RESET ROLE;

SELECT is((SELECT result->>'status' FROM first_operation_run), 'succeeded', 'first cron window succeeds');
SELECT is((SELECT result->>'status' FROM second_operation_run), 'skipped', 'same cron window is idempotently skipped');
SELECT is(
  (SELECT count(*)::BIGINT FROM public.tasks WHERE idempotency_key = 'passport:42000000-0000-0000-0000-000000000003:' || (current_date + 20)::TEXT),
  1::BIGINT,
  'passport task is created once'
);
SELECT is(
  (SELECT count(*)::BIGINT FROM public.notifications WHERE task_id IN (
    SELECT id FROM public.tasks WHERE customer_id = '42000000-0000-0000-0000-000000000003'
  )),
  1::BIGINT,
  'scheduled task creates one personal notification'
);
SELECT is(
  (SELECT status FROM public.scheduled_job_runs WHERE job_name = 'operations' AND window_key = '2026-07-28T09:00:00Z'),
  'succeeded',
  'successful cron history is persisted'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"42000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2","session_id":"42000000-0000-0000-0000-000000000099"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT public.set_communication_preference_v1('{"customer_id":"42000000-0000-0000-0000-000000000003","channel":"email","purpose":"transactional","allowed":true,"evidence_note":"Müşteri yazılı olarak izin verdi"}'::JSONB) $$,
  'assigned admin records explicit channel permission'
);
SELECT lives_ok(
  $$ SELECT public.enqueue_message_v1('{"customer_id":"42000000-0000-0000-0000-000000000003","channel":"email","purpose":"transactional","recipient":"cron@example.test","body":"Randevu bilginiz","idempotency_key":"phase45:message:1"}'::JSONB) $$,
  'permissioned transactional message is enqueued'
);
SELECT is(
  public.enqueue_message_v1('{"customer_id":"42000000-0000-0000-0000-000000000003","channel":"email","purpose":"transactional","recipient":"cron@example.test","body":"Randevu bilginiz","idempotency_key":"phase45:message:1"}'::JSONB),
  (SELECT id FROM public.message_outbox WHERE idempotency_key = 'phase45:message:1'),
  'repeated idempotency key returns existing outbox row'
);
SELECT throws_ok(
  $$ SELECT public.enqueue_message_v1('{"customer_id":"42000000-0000-0000-0000-000000000003","channel":"whatsapp","purpose":"transactional","recipient":"905000004242","body":"Randevu bilginiz","idempotency_key":"phase45:message:2"}'::JSONB) $$,
  '42501',
  'communication_permission_required',
  'missing channel permission blocks provider delivery'
);
RESET ROLE;

SELECT is((SELECT count(*)::BIGINT FROM public.message_outbox WHERE idempotency_key = 'phase45:message:1'), 1::BIGINT, 'outbox idempotency prevents duplicates');
SELECT is((SELECT count(*)::BIGINT FROM public.communications WHERE customer_id = '42000000-0000-0000-0000-000000000003' AND status = 'hazirlandi'), 1::BIGINT, 'outbox owns one communication record');
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT lives_ok(
  $$ SELECT public.apply_message_delivery_event_v1((SELECT id FROM public.message_outbox WHERE idempotency_key = 'phase45:message:1'), 'accepted', 'provider-test-1', NULL) $$,
  'provider acceptance event is recorded'
);
SELECT is(
  (SELECT communication.status FROM public.communications communication JOIN public.message_outbox outbox ON outbox.communication_id = communication.id WHERE outbox.idempotency_key = 'phase45:message:1'),
  'hazirlandi',
  'provider acceptance is not misrepresented as delivery'
);
SELECT lives_ok(
  $$ SELECT public.apply_message_delivery_event_v1((SELECT id FROM public.message_outbox WHERE idempotency_key = 'phase45:message:1'), 'delivered', 'provider-test-1', NULL) $$,
  'provider delivery event is recorded'
);
SELECT is(
  (SELECT communication.status FROM public.communications communication JOIN public.message_outbox outbox ON outbox.communication_id = communication.id WHERE outbox.idempotency_key = 'phase45:message:1'),
  'gonderildi',
  'communication is marked sent only after provider delivery'
);
RESET ROLE;
SELECT ok((SELECT admin_mfa_required FROM public.tenants LIMIT 1), 'admin MFA policy defaults to required');
SELECT ok(NOT (SELECT consultant_mfa_required FROM public.tenants LIMIT 1), 'consultant MFA policy defaults to optional');
SELECT col_is_unique('public', 'message_outbox', 'idempotency_key', 'message idempotency key is unique');
SELECT col_is_unique('public', 'scheduled_job_runs', ARRAY['job_name', 'window_key'], 'job window is unique');

INSERT INTO public.operational_events (
  event_key, severity, source, status, summary
) VALUES (
  'backup.stale', 'warning', 'backup', 'open', 'Service-owned backup warning'
);
SELECT lives_ok(
  $$ UPDATE public.operational_events
     SET status = 'resolved', resolved_at = now(), resolved_by_staff_id = NULL
     WHERE summary = 'Service-owned backup warning' $$,
  'service-owned operational event can resolve without a staff identity'
);
SELECT is(
  (SELECT status FROM public.operational_events WHERE summary = 'Service-owned backup warning'),
  'resolved',
  'service-owned operational event persists as resolved'
);

SELECT * FROM finish();
ROLLBACK;
