BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(27);

SELECT has_table('public', 'privacy_action_queue', 'privacy approval queue exists');
SELECT has_table('public', 'privacy_audit_log', 'immutable privacy audit exists');
SELECT has_table('public', 'leads', 'lead lifecycle table exists');
SELECT has_table('public', 'lead_events', 'lead event history exists');
SELECT has_table('public', 'appointment_events', 'appointment event history exists');
SELECT has_function('public', 'queue_privacy_action_v1', ARRAY['uuid', 'uuid', 'text', 'text'], 'privacy queue workflow exists');
SELECT has_function('public', 'create_lead_v1', ARRAY['jsonb'], 'lead creation workflow exists');
SELECT has_function('public', 'list_appointment_conflicts_v1', ARRAY['uuid', 'timestamp with time zone', 'integer'], 'appointment conflict workflow exists');
SELECT ok(NOT has_function_privilege('anon', 'public.queue_privacy_action_v1(uuid,uuid,text,text)', 'EXECUTE'), 'anon cannot queue privacy actions');
SELECT ok(NOT has_function_privilege('authenticated', 'public.sync_lead_followup_tasks_v1()', 'EXECUTE'), 'staff cannot invoke lead task cron directly');

INSERT INTO auth.users (id, email, role, aud, email_confirmed_at) VALUES
  ('46490000-0000-0000-0000-000000000001', 'phase46-admin1@example.test', 'authenticated', 'authenticated', now()),
  ('46490000-0000-0000-0000-000000000002', 'phase46-admin2@example.test', 'authenticated', 'authenticated', now());
INSERT INTO public.staff (id, user_id, full_name, email, role, is_active) VALUES
  ('46490000-0000-0000-0000-000000000011', '46490000-0000-0000-0000-000000000001', 'Faz 4 Admin Bir', 'phase46-admin1@example.test', 'admin', true),
  ('46490000-0000-0000-0000-000000000012', '46490000-0000-0000-0000-000000000002', 'Faz 4 Admin İki', 'phase46-admin2@example.test', 'admin', true);

INSERT INTO public.customers (
  id, first_name, last_name, phone, assigned_staff_id, is_deleted, deleted_at, anonymized_at
) VALUES
  ('46490000-0000-0000-0000-000000000021', 'Takvim', 'Bir', '05004649001', '46490000-0000-0000-0000-000000000011', false, NULL, NULL),
  ('46490000-0000-0000-0000-000000000022', 'Takvim', 'İki', '05004649002', '46490000-0000-0000-0000-000000000011', false, NULL, NULL),
  ('46490000-0000-0000-0000-000000000023', 'Anonim', 'Aday', NULL, NULL, true, now() - interval '90 days', now() - interval '80 days');

INSERT INTO public.applications (
  id, customer_id, country, visa_type, status, assigned_staff_id,
  appointment_date, appointment_location, appointment_status
) VALUES
  ('46490000-0000-0000-0000-000000000031', '46490000-0000-0000-0000-000000000021', 'Fransa', 'turistik', 'randevu_alindi', '46490000-0000-0000-0000-000000000011', '2026-08-10T07:00:00Z', 'VFS Ankara', 'scheduled'),
  ('46490000-0000-0000-0000-000000000032', '46490000-0000-0000-0000-000000000022', 'Fransa', 'turistik', 'randevu_alindi', '46490000-0000-0000-0000-000000000011', '2026-08-10T07:30:00Z', 'VFS Ankara', 'scheduled');

INSERT INTO public.data_subject_requests (
  id, customer_id, request_type, requested_via, status, created_by_staff_id
) VALUES (
  '46490000-0000-0000-0000-000000000041',
  '46490000-0000-0000-0000-000000000023',
  'deletion', 'diger', 'approved', '46490000-0000-0000-0000-000000000011'
);

CREATE TEMP TABLE lead_result(id UUID);
CREATE TEMP TABLE privacy_result(id UUID);
GRANT SELECT, INSERT ON lead_result, privacy_result TO authenticated;
GRANT SELECT ON lead_result, privacy_result TO service_role;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"46490000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ INSERT INTO pg_temp.lead_result
     SELECT public.create_lead_v1('{
       "first_name":"Lead",
       "last_name":"Aday",
       "phone":"+90 (555) 464 90 00",
       "source":"web",
       "follow_up_due_at":"2026-07-01T09:00:00Z"
     }'::JSONB) $$,
  'admin creates a lead through the controlled workflow'
);
RESET ROLE;
SELECT is((SELECT phone_normalized FROM public.leads WHERE id = (SELECT id FROM lead_result)), '905554649000', 'lead phone is normalized');
SELECT is((SELECT count(*)::BIGINT FROM public.lead_events WHERE lead_id = (SELECT id FROM lead_result) AND event_type = 'created'), 1::BIGINT, 'lead creation is audited once');

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT is(public.sync_lead_followup_tasks_v1(), 1, 'lead SLA cron creates the overdue task');
SELECT is(public.sync_lead_followup_tasks_v1(), 0, 'lead SLA cron is idempotent');
RESET ROLE;
SELECT is((SELECT count(*)::BIGINT FROM public.tasks WHERE source_type = 'lead' AND source_id = (SELECT id FROM lead_result)), 1::BIGINT, 'one lead follow-up task persists');

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"46490000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ INSERT INTO pg_temp.privacy_result
     SELECT public.queue_privacy_action_v1(
       '46490000-0000-0000-0000-000000000023',
       '46490000-0000-0000-0000-000000000041',
       'purge',
       'Onaylı silme talebi ve saklama süresi tamamlandı'
     ) $$,
  'admin queues an eligible purge'
);
RESET ROLE;
SELECT is((SELECT required_approvals FROM public.privacy_action_queue WHERE id = (SELECT id FROM privacy_result)), 2, 'purge requires two approvals');

SET LOCAL ROLE authenticated;
SELECT is(public.approve_privacy_action_v1((SELECT id FROM pg_temp.privacy_result), 'Birinci yönetici onayı'), false, 'first admin approval is insufficient');
RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"46490000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT is(public.approve_privacy_action_v1((SELECT id FROM pg_temp.privacy_result), 'İkinci yönetici onayı'), true, 'second distinct admin completes approval');
RESET ROLE;
SELECT is((SELECT status FROM public.privacy_action_queue WHERE id = (SELECT id FROM privacy_result)), 'approved', 'privacy action enters approved state');

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.execute_privacy_action_v1((SELECT id FROM pg_temp.privacy_result)) $$,
  '22023',
  'verified_backup_after_approval_required',
  'execution is blocked until a post-approval verified backup exists'
);
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT throws_ok(
  $$ UPDATE public.privacy_audit_log SET reason = 'değiştirilemez' WHERE action_id = (SELECT id FROM pg_temp.privacy_result) $$,
  '42501',
  'privacy_audit_is_immutable',
  'privacy audit cannot be modified'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"46490000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::INTEGER FROM public.list_appointment_conflicts_v1(
    '46490000-0000-0000-0000-000000000031', '2026-08-10T07:15:00Z', 60
  )),
  1,
  'overlapping appointment is detected for the same consultant'
);
SELECT lives_ok(
  $$ SELECT public.set_appointment_status_v1(
    '46490000-0000-0000-0000-000000000031', 'completed', 'Randevu tamamlandı'
  ) $$,
  'authorized staff completes an appointment'
);
RESET ROLE;
SELECT is((SELECT appointment_status FROM public.applications WHERE id = '46490000-0000-0000-0000-000000000031'), 'completed', 'appointment status persists');
SELECT is((SELECT count(*)::BIGINT FROM public.appointment_events WHERE application_id = '46490000-0000-0000-0000-000000000031' AND event_type = 'completed'), 1::BIGINT, 'appointment completion is preserved in immutable history');

SELECT * FROM finish();
ROLLBACK;
