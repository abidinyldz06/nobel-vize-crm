BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(117);

SELECT has_table('public', 'country_visa_rules', 'canonical visa rules table exists');
SELECT has_function('public', 'create_customer_application_v1', ARRAY['jsonb'], 'atomic customer workflow exists');
SELECT has_function('public', 'update_application_status_v1', ARRAY['uuid', 'text', 'text', 'text'], 'atomic status workflow exists');
SELECT has_function('public', 'application_status_transition_allowed', ARRAY['text', 'text'], 'status transition rule exists');
SELECT has_function('public', 'bulk_update_application_status_v1', ARRAY['uuid[]', 'text', 'text'], 'atomic bulk status workflow exists');
SELECT has_function('public', 'set_application_appointment_v1', ARRAY['uuid', 'timestamp with time zone', 'text', 'text'], 'atomic appointment workflow exists');
SELECT has_function('public', 'update_customer_application_v1', ARRAY['uuid', 'uuid', 'jsonb'], 'atomic customer and application edit workflow exists');
SELECT has_table('public', 'tags', 'customer tag catalog exists');
SELECT has_table('public', 'customer_tags', 'customer tag relation exists');
SELECT has_function('public', 'set_customer_tags_v1', ARRAY['uuid', 'uuid[]'], 'controlled customer tag workflow exists');
SELECT has_function('public', 'add_customer_quick_note_v1', ARRAY['uuid', 'text'], 'atomic customer quick note workflow exists');
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.tags WHERE name IN ('VIP', 'Acil', 'Reddi Var', 'Premium') $$,
  $$ VALUES (4::BIGINT) $$,
  'four ready-to-use customer tags are seeded'
);
SELECT has_column('public', 'applications', 'country_id', 'applications reference the canonical country');
SELECT has_column('public', 'applications', 'travel_method', 'applications store travel method');
SELECT has_column('public', 'applications', 'accommodation', 'applications store accommodation');
SELECT has_column('public', 'applications', 'occupation', 'applications store occupation');
SELECT has_column('public', 'applications', 'with_children', 'applications store child status');
SELECT has_column('public', 'applications', 'nationality', 'applications store nationality');
SELECT has_function('public', 'restore_backup_v2', ARRAY['jsonb'], 'atomic restore exists');
SELECT ok(to_regclass('public.uq_staff_user_id') IS NOT NULL, 'staff auth user uniqueness is enforced');
SELECT ok(to_regclass('public.uq_country_visa_rules_match') IS NOT NULL, 'visa rule match uniqueness is enforced');
SELECT ok(to_regclass('public.tenants_single_company_idx') IS NOT NULL, 'single company row uniqueness is enforced');
SELECT has_column('public', 'customers', 'is_deleted', 'customers have a soft-delete flag');
SELECT has_column('public', 'customers', 'deleted_at', 'customers record archive time');
SELECT has_function('public', 'archive_customers_v1', ARRAY['uuid[]'], 'atomic customer archive exists');
SELECT has_function('public', 'restore_customers_v1', ARRAY['uuid[]'], 'atomic customer restore exists');
SELECT has_function('public', 'list_archived_customers_v1', ARRAY[]::TEXT[], 'admin archive listing exists');
SELECT has_function('public', 'purge_deleted_customers_v1', ARRAY['uuid[]'], 'controlled permanent delete exists');
SELECT has_table('public', 'tasks', 'staff task table exists');
SELECT has_table('public', 'notifications', 'recipient notification table exists');
SELECT has_function('public', 'create_task_v1', ARRAY['jsonb'], 'manual task workflow exists');
SELECT has_function('public', 'set_task_status_v1', ARRAY['uuid', 'text'], 'task status workflow exists');
SELECT has_function('public', 'sync_operational_tasks_v1', ARRAY[]::TEXT[], 'operational task generator exists');
SELECT has_function('public', 'mark_notification_read_v1', ARRAY['uuid'], 'single notification read workflow exists');
SELECT has_function('public', 'mark_all_notifications_read_v1', ARRAY[]::TEXT[], 'bulk notification read workflow exists');
SELECT ok(
  NOT has_function_privilege('anon', 'public.create_task_v1(jsonb)', 'EXECUTE'),
  'anon cannot create tasks'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.create_task_v1(jsonb)', 'EXECUTE'),
  'authenticated staff can create controlled tasks'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.tasks', 'INSERT'),
  'authenticated staff cannot bypass the task RPC with direct inserts'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.notifications', 'UPDATE'),
  'authenticated staff cannot bypass recipient-scoped notification read RPCs'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.tenants $$,
  $$ VALUES (1::BIGINT) $$,
  'one company settings row is seeded'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'subdomain'),
  'retired subdomain setting is removed'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'plan'),
  'retired SaaS plan setting is removed'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'primary_color'),
  'retired white-label color setting is removed'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'notify_email'),
  'unused email notification setting is removed'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'notify_whatsapp'),
  'unused WhatsApp notification setting is removed'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'notify_reminder'),
  'unused reminder setting is removed'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'notify_status_change'),
  'unused status notification setting is removed'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.create_customer_application_v1(jsonb)', 'EXECUTE'),
  'anon cannot execute customer workflow'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.create_customer_application_v1(jsonb)', 'EXECUTE'),
  'authenticated staff can execute customer workflow'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.restore_backup_v2(jsonb)', 'EXECUTE'),
  'anon cannot execute restore'
);
SELECT ok(
  NOT has_function_privilege('service_role', 'public.restore_backup_v2(jsonb)', 'EXECUTE'),
  'service role cannot bypass the admin restore gate'
);

INSERT INTO auth.users (id, email, role, aud, email_confirmed_at)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'admin@example.com',
  'authenticated',
  'authenticated',
  now()
);

INSERT INTO public.staff (id, user_id, full_name, email, role, is_active)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Test Admin',
  'admin@example.com',
  'admin',
  true
);

INSERT INTO public.countries (id, name, base_fee_service, active)
VALUES ('30000000-0000-0000-0000-000000000001', 'Almanya', 2500, true);

INSERT INTO public.country_visa_rules (
  id,
  country_id,
  visa_category,
  documents
) VALUES (
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'turistik',
  '[{"name":"Pasaport","category":"temel","required":true}]'::JSONB
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT results_eq(
  $$ SELECT public.current_staff_id() $$,
  $$ VALUES ('10000000-0000-0000-0000-000000000001'::UUID) $$,
  'authenticated auth user resolves to the linked active staff row'
);

SELECT lives_ok(
  $$
    SELECT public.create_customer_application_v1(
      '{
        "first_name":"Ayşe",
        "last_name":"Yılmaz",
        "phone":"05550000000",
        "email":"ayse@example.com",
        "country_id":"30000000-0000-0000-0000-000000000001",
        "visa_type":"turistik",
        "matched_rule_id":"40000000-0000-0000-0000-000000000001",
        "assigned_staff_id":"10000000-0000-0000-0000-000000000001",
        "consulate_fee":1000
      }'::JSONB
    )
  $$,
  'customer, application, document and activity log are created atomically'
);

SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.customers WHERE email = 'ayse@example.com' $$,
  $$ VALUES (1::BIGINT) $$,
  'one customer was created'
);
SELECT results_eq(
  $$ SELECT public.archive_customers_v1(ARRAY[(SELECT id FROM public.customers WHERE email = 'ayse@example.com')]::UUID[]) $$,
  $$ VALUES (1) $$,
  'admin archives a customer atomically'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.customers WHERE email = 'ayse@example.com' $$,
  $$ VALUES (0::BIGINT) $$,
  'archived customer is hidden by normal RLS reads'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.list_archived_customers_v1() WHERE email = 'ayse@example.com' $$,
  $$ VALUES (1::BIGINT) $$,
  'admin archive listing returns the archived customer'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE action = 'Müşteri silindi: Ayşe Yılmaz — Test Admin' $$,
  $$ VALUES (1::BIGINT) $$,
  'customer archive writes the required named audit entry'
);
SELECT results_eq(
  $$ SELECT public.restore_customers_v1(ARRAY[(SELECT id FROM public.list_archived_customers_v1() WHERE email = 'ayse@example.com')]::UUID[]) $$,
  $$ VALUES (1) $$,
  'admin restores an archived customer'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.customers WHERE email = 'ayse@example.com' $$,
  $$ VALUES (1::BIGINT) $$,
  'restored customer returns to normal RLS reads'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE action = 'Müşteri geri yüklendi: Ayşe Yılmaz — Test Admin' $$,
  $$ VALUES (1::BIGINT) $$,
  'customer restore writes a named audit entry'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.customers $$,
  $$ VALUES (1::BIGINT) $$,
  'linked admin can read customers through RLS'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.applications WHERE country = 'Almanya' $$,
  $$ VALUES (1::BIGINT) $$,
  'one application was created'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.documents WHERE document_type = 'Pasaport' $$,
  $$ VALUES (1::BIGINT) $$,
  'canonical rule produced its document'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE performed_by_staff_id = '10000000-0000-0000-0000-000000000001' AND action LIKE 'Yeni başvuru oluşturuldu:%' $$,
  $$ VALUES (1::BIGINT) $$,
  'activity actor is stored as a staff foreign key'
);

SELECT throws_ok(
  $$
    SELECT public.create_customer_application_v1(
      '{
        "first_name":"Hatalı",
        "last_name":"Ücret",
        "phone":"05550000001",
        "country_id":"30000000-0000-0000-0000-000000000001",
        "visa_type":"turistik",
        "service_fee":-1
      }'::JSONB
    )
  $$,
  '22023',
  'fees_must_be_nonnegative',
  'invalid fee aborts the whole workflow'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.customers WHERE phone = '05550000001' $$,
  $$ VALUES (0::BIGINT) $$,
  'failed workflow leaves no partial customer'
);

SELECT lives_ok(
  $$
    SELECT public.update_application_status_v1(
      (SELECT id FROM public.applications WHERE country = 'Almanya' LIMIT 1),
      'evrak_bekleniyor',
      NULL,
      'Test durum değişikliği'
    )
  $$,
  'application status and log update atomically'
);
SELECT results_eq(
  $$ SELECT status FROM public.applications WHERE country = 'Almanya' LIMIT 1 $$,
  $$ VALUES ('evrak_bekleniyor'::TEXT) $$,
  'application status changed'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE action = 'Test durum değişikliği' $$,
  $$ VALUES (1::BIGINT) $$,
  'status change created its activity log'
);
SELECT results_eq(
  $$ SELECT public.application_status_transition_allowed('evrak_bekleniyor', 'randevu_bekleniyor') $$,
  $$ VALUES (true) $$,
  'adjacent operational transition is allowed'
);
SELECT results_eq(
  $$ SELECT public.application_status_transition_allowed('evrak_bekleniyor', 'onaylandi') $$,
  $$ VALUES (false) $$,
  'skipping directly to approval is not allowed'
);
SELECT throws_ok(
  $$
    SELECT public.update_application_status_v1(
      (SELECT id FROM public.applications WHERE country = 'Almanya' LIMIT 1),
      'onaylandi',
      NULL,
      'Geçersiz atlama'
    )
  $$,
  '22023',
  'application_status_transition_not_allowed:evrak_bekleniyor->onaylandi',
  'invalid transition is rejected before update and audit'
);
SELECT results_eq(
  $$ SELECT status FROM public.applications WHERE country = 'Almanya' LIMIT 1 $$,
  $$ VALUES ('evrak_bekleniyor'::TEXT) $$,
  'rejected transition leaves status unchanged'
);
SELECT results_eq(
  $$
    SELECT public.bulk_update_application_status_v1(
      ARRAY[(SELECT id FROM public.applications WHERE country = 'Almanya' LIMIT 1)]::UUID[],
      'randevu_bekleniyor',
      'Toplu kontrollü geçiş'
    )
  $$,
  $$ VALUES (1) $$,
  'bulk status workflow updates an allowed set atomically'
);
SELECT results_eq(
  $$ SELECT status FROM public.applications WHERE country = 'Almanya' LIMIT 1 $$,
  $$ VALUES ('randevu_bekleniyor'::TEXT) $$,
  'bulk workflow stores the target status'
);
SELECT lives_ok(
  $$
    SELECT public.set_application_appointment_v1(
      (SELECT id FROM public.applications WHERE country = 'Almanya' LIMIT 1),
      now() + interval '10 days',
      'Ankara VFS',
      'VFS'
    )
  $$,
  'appointment and status update in one workflow'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.applications WHERE country = 'Almanya' AND status = 'randevu_alindi' AND appointment_location = 'Ankara VFS' AND appointment_date IS NOT NULL $$,
  $$ VALUES (1::BIGINT) $$,
  'appointment workflow stores date, location and controlled status'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE action LIKE 'Randevu eklendi: VFS — % (Ankara VFS)' $$,
  $$ VALUES (1::BIGINT) $$,
  'appointment workflow writes its audit entry'
);
SELECT lives_ok(
  $$
    SELECT public.update_customer_application_v1(
      application.customer_id,
      application.id,
      jsonb_build_object(
        'first_name', customer.first_name,
        'last_name', customer.last_name,
        'phone', customer.phone,
        'email', customer.email,
        'financial_status', customer.financial_status,
        'profile_score', customer.profile_score,
        'country_id', '30000000-0000-0000-0000-000000000001',
        'visa_type', 'turistik',
        'status', application.status,
        'travel_method', 'ucak',
        'accommodation', 'otel',
        'occupation', 'calisan',
        'with_children', false,
        'nationality', 'tc',
        'tag_ids', (SELECT jsonb_agg(id) FROM public.tags WHERE name IN ('VIP', 'Acil'))
      )
    )
    FROM public.applications AS application
    JOIN public.customers AS customer ON customer.id = application.customer_id
    WHERE application.country = 'Almanya'
    LIMIT 1
  $$,
  'customer and application profile update atomically'
);
SELECT results_eq(
  $$
    SELECT country_id::TEXT, travel_method, accommodation, occupation, with_children, nationality
    FROM public.applications
    WHERE country = 'Almanya'
    LIMIT 1
  $$,
  $$ VALUES ('30000000-0000-0000-0000-000000000001'::TEXT, 'ucak'::TEXT, 'otel'::TEXT, 'calisan'::TEXT, false, 'tc'::TEXT) $$,
  'application profile fields persist on the canonical application record'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE action = 'Müşteri ve başvuru bilgileri güncellendi' $$,
  $$ VALUES (1::BIGINT) $$,
  'customer and application edit writes an audit entry'
);
SELECT results_eq(
  $$
    SELECT count(*)::BIGINT
    FROM public.customer_tags
    WHERE customer_id = (SELECT customer_id FROM public.applications WHERE country = 'Almanya' LIMIT 1)
  $$,
  $$ VALUES (2::BIGINT) $$,
  'selected customer tags persist through the edit workflow'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE action = 'Müşteri etiketleri güncellendi (2 etiket)' $$,
  $$ VALUES (1::BIGINT) $$,
  'tag update writes its audit entry'
);
SELECT lives_ok(
  $$
    SELECT public.add_customer_quick_note_v1(
      (SELECT customer_id FROM public.applications WHERE country = 'Almanya' LIMIT 1),
      'Faz 3.4 hızlı not testi'
    )
  $$,
  'staff adds a quick note to the latest accessible application'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.notes WHERE content = 'Faz 3.4 hızlı not testi' $$,
  $$ VALUES (1::BIGINT) $$,
  'quick note persists on the application'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE action = 'Hızlı not eklendi' AND type = 'note' $$,
  $$ VALUES (1::BIGINT) $$,
  'quick note creates its audit entry'
);

RESET ROLE;
INSERT INTO auth.users (id, email, role, aud, email_confirmed_at)
VALUES (
  '20000000-0000-0000-0000-000000000002',
  'consultant@example.com',
  'authenticated',
  'authenticated',
  now()
);
INSERT INTO public.staff (id, user_id, full_name, email, role, is_active)
VALUES (
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  'Test Consultant',
  'consultant@example.com',
  'consultant',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.archive_customers_v1(ARRAY['10000000-0000-0000-0000-000000000099']::UUID[]) $$,
  '42501',
  'admin_required',
  'consultant cannot archive customers'
);

RESET ROLE;
UPDATE public.applications
SET appointment_date = now() + interval '36 hours'
WHERE country = 'Almanya';
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$
    SELECT public.create_task_v1(jsonb_build_object(
      'title', 'Danışman görevi',
      'description', 'Kişisel bildirim testi',
      'assigned_staff_id', '10000000-0000-0000-0000-000000000002',
      'due_at', now() + interval '1 day',
      'priority', 'high'
    ))
  $$,
  'admin can create a manual task for a consultant'
);
SELECT throws_ok(
  $$
    SELECT public.create_task_v1(jsonb_build_object(
      'title', 'Uyumsuz müşteri görevi',
      'assigned_staff_id', '10000000-0000-0000-0000-000000000002',
      'customer_id', (SELECT id FROM public.customers WHERE email = 'ayse@example.com'),
      'due_at', now() + interval '1 day'
    ))
  $$,
  '22023',
  'task_assignee_customer_mismatch',
  'task creation rejects a customer the assignee cannot access'
);
SELECT lives_ok(
  $$
    SELECT public.create_task_v1(jsonb_build_object(
      'title', 'Admin görevi',
      'assigned_staff_id', '10000000-0000-0000-0000-000000000001',
      'due_at', now() + interval '2 days'
    ))
  $$,
  'admin can create a personal manual task'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.tasks WHERE title IN ('Danışman görevi', 'Admin görevi') $$,
  $$ VALUES (1::BIGINT) $$,
  'consultant sees only assigned tasks through RLS'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.notifications WHERE title IN ('Yeni görev: Danışman görevi', 'Yeni görev: Admin görevi') $$,
  $$ VALUES (1::BIGINT) $$,
  'consultant sees only personal notifications through RLS'
);
SELECT results_eq(
  $$ SELECT public.mark_notification_read_v1((SELECT id FROM public.notifications WHERE title = 'Yeni görev: Danışman görevi')) $$,
  $$ VALUES (true) $$,
  'consultant marks an own notification as read'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.notifications WHERE title = 'Yeni görev: Danışman görevi' AND is_read = true AND read_at IS NOT NULL $$,
  $$ VALUES (1::BIGINT) $$,
  'notification read state and timestamp stay consistent'
);
SELECT throws_ok(
  $$
    SELECT public.create_task_v1(jsonb_build_object(
      'title', 'Yetkisiz atama',
      'assigned_staff_id', '10000000-0000-0000-0000-000000000001',
      'due_at', now() + interval '1 day'
    ))
  $$,
  '42501',
  'task_assignment_forbidden',
  'consultant cannot assign a task to another staff member'
);
SELECT results_eq(
  $$ SELECT public.set_task_status_v1((SELECT id FROM public.tasks WHERE title = 'Danışman görevi'), 'completed') $$,
  $$ VALUES (true) $$,
  'consultant completes an assigned task'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.tasks WHERE title = 'Danışman görevi' AND status = 'completed' AND completed_at IS NOT NULL $$,
  $$ VALUES (1::BIGINT) $$,
  'completed task stores a completion timestamp'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
INSERT INTO public.documents (id, application_id, document_type, category, is_required, status, requested_at)
VALUES (
  '60000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.applications WHERE country = 'Almanya' LIMIT 1),
  'Geciken Test Evrakı',
  'temel',
  true,
  'bekleniyor',
  now() - interval '8 days'
);
INSERT INTO public.payments (id, application_id, amount, status, currency, created_at)
VALUES (
  '70000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.applications WHERE country = 'Almanya' LIMIT 1),
  1250,
  'bekliyor',
  'TRY',
  now() - interval '4 days'
);
INSERT INTO public.customers (id, first_name, last_name, assigned_staff_id)
VALUES (
  '50000000-0000-0000-0000-000000000003',
  'Hareketsiz',
  'Başvuru',
  '10000000-0000-0000-0000-000000000001'
);
INSERT INTO public.applications (
  id, customer_id, country, status, visa_type, assigned_staff_id, created_at, updated_at
)
VALUES (
  '80000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000003',
  'Fransa',
  'evrak_bekleniyor',
  'turistik',
  '10000000-0000-0000-0000-000000000001',
  now() - interval '10 days',
  now() - interval '8 days'
);
SELECT results_eq(
  $$ SELECT public.sync_operational_tasks_v1() $$,
  $$ VALUES (4) $$,
  'operational sync creates appointment, document, payment and inactivity tasks'
);
SELECT results_eq(
  $$ SELECT public.sync_operational_tasks_v1() $$,
  $$ VALUES (0) $$,
  'operational sync is idempotent when source data is unchanged'
);
SELECT results_eq(
  $$ SELECT count(DISTINCT task_type)::BIGINT FROM public.tasks WHERE source_type <> 'manual' $$,
  $$ VALUES (4::BIGINT) $$,
  'all four automatic task types are present'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.notifications WHERE task_id IN (SELECT id FROM public.tasks WHERE source_type <> 'manual') $$,
  $$ VALUES (4::BIGINT) $$,
  'each automatic task creates exactly one personal notification'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
INSERT INTO public.customers (id, first_name, last_name, phone, email, assigned_staff_id)
VALUES (
  '50000000-0000-0000-0000-000000000002',
  'Kalıcı',
  'Silme',
  '05550000002',
  'purge@example.com',
  '10000000-0000-0000-0000-000000000001'
);
SELECT results_eq(
  $$ SELECT public.archive_customers_v1(ARRAY['50000000-0000-0000-0000-000000000002']::UUID[]) $$,
  $$ VALUES (1) $$,
  'purge candidate first moves to archive'
);
SELECT results_eq(
  $$ SELECT public.purge_deleted_customers_v1(ARRAY['50000000-0000-0000-0000-000000000002']::UUID[]) $$,
  $$ VALUES (0) $$,
  'customer cannot be permanently deleted before 30 days'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.list_archived_customers_v1() WHERE id = '50000000-0000-0000-0000-000000000002' $$,
  $$ VALUES (1::BIGINT) $$,
  'young archive record remains available'
);

RESET ROLE;
UPDATE public.customers
SET deleted_at = now() - interval '31 days'
WHERE id = '50000000-0000-0000-0000-000000000002';
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT results_eq(
  $$ SELECT public.purge_deleted_customers_v1(ARRAY['50000000-0000-0000-0000-000000000002']::UUID[]) $$,
  $$ VALUES (1) $$,
  'admin permanently deletes an archive record after 30 days'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE customer_id IS NULL AND action = 'Müşteri kalıcı silindi: Kalıcı Silme — Test Admin' $$,
  $$ VALUES (1::BIGINT) $$,
  'permanent delete leaves a non-cascading audit entry'
);

RESET ROLE;
CREATE TEMP TABLE phase1_backup_payload AS
SELECT jsonb_build_object(
  'format', 'nobel-vize-crm-backup',
  'version', '2.0',
  'exported_at', now(),
  'schema', 'phase1',
  'tables', jsonb_build_object(
    'tenants', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.tenants row),
    'staff', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.staff row),
    'tags', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.tags row),
    'countries', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.countries row),
    'country_visa_rules', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.country_visa_rules row),
    'customers', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.customers row),
    'customer_tags', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.customer_tags row),
    'applications', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.applications row),
    'documents', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.documents row),
    'notes', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.notes row),
    'payments', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.payments row),
    'activity_log', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.activity_log row),
    'communications', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.communications row),
    'tasks', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.tasks row),
    'notifications', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.notifications row),
    'visa_history', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.visa_history row),
    'family_members', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.family_members row),
    'webhook_events', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.webhook_events row)
  )
) AS payload;
GRANT SELECT ON phase1_backup_payload TO authenticated;

SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT public.restore_backup_v2(payload) FROM phase1_backup_payload $$,
  'valid v2 backup restores in one transaction'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.customers WHERE email = 'ayse@example.com' $$,
  $$ VALUES (1::BIGINT) $$,
  'restored customer remains available'
);
SELECT ok(
  (SELECT count(*) FROM public.tasks) > 0,
  'full v2 restore preserves tasks'
);
SELECT ok(
  (SELECT count(*) FROM public.notifications) > 0,
  'full v2 restore preserves personal notifications'
);
SELECT ok(
  (SELECT count(*) FROM public.customer_tags) > 0,
  'full v2 restore preserves customer tags'
);
SELECT lives_ok(
  $$
    SELECT public.restore_backup_v2(
      payload #- '{tables,tasks}' #- '{tables,notifications}' #- '{tables,tags}' #- '{tables,customer_tags}'
    )
    FROM phase1_backup_payload
  $$,
  'legacy v2 backup without phase 3.3 tables remains restorable'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.tasks $$,
  $$ VALUES (0::BIGINT) $$,
  'legacy v2 restore initializes tasks as empty'
);
SELECT throws_ok(
  $$
    SELECT public.restore_backup_v2(payload #- '{tables,customers}')
    FROM phase1_backup_payload
  $$,
  '22023',
  'backup_table_missing_or_not_array:customers',
  'invalid backup is rejected before destructive work'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.customers WHERE email = 'ayse@example.com' $$,
  $$ VALUES (1::BIGINT) $$,
  'failed restore leaves the existing customer intact'
);

RESET ROLE;
SELECT results_eq(
  $$ SELECT public FROM storage.buckets WHERE id = 'documents' $$,
  $$ VALUES (false) $$,
  'documents bucket remains private'
);

SELECT * FROM finish();
ROLLBACK;
