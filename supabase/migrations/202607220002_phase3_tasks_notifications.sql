-- Faz 3.3: personel bazli gorevler ve gercek, alici bazli bildirimler.

BEGIN;

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'manual',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  due_at TIMESTAMPTZ NOT NULL,
  assigned_staff_id UUID NOT NULL
    CONSTRAINT tasks_assigned_staff_fk REFERENCES public.staff(id) ON DELETE RESTRICT,
  created_by_staff_id UUID
    CONSTRAINT tasks_created_by_staff_fk REFERENCES public.staff(id) ON DELETE SET NULL,
  customer_id UUID
    CONSTRAINT tasks_customer_fk REFERENCES public.customers(id) ON DELETE CASCADE,
  application_id UUID
    CONSTRAINT tasks_application_fk REFERENCES public.applications(id) ON DELETE CASCADE,
  idempotency_key TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tasks_title_length CHECK (length(trim(title)) BETWEEN 1 AND 160),
  CONSTRAINT tasks_description_length CHECK (description IS NULL OR length(description) <= 2000),
  CONSTRAINT tasks_type_valid CHECK (task_type IN ('manual', 'appointment', 'document', 'payment', 'inactivity')),
  CONSTRAINT tasks_source_valid CHECK (source_type IN ('manual', 'appointment', 'document', 'payment', 'inactivity')),
  CONSTRAINT tasks_status_valid CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT tasks_priority_valid CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT tasks_completion_consistent CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  ),
  CONSTRAINT tasks_automatic_key_required CHECK (
    source_type = 'manual' OR idempotency_key IS NOT NULL
  )
);

CREATE UNIQUE INDEX tasks_idempotency_key_unique
  ON public.tasks(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX tasks_assignee_due_idx
  ON public.tasks(assigned_staff_id, status, due_at);
CREATE INDEX tasks_customer_created_idx
  ON public.tasks(customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;
CREATE INDEX tasks_application_created_idx
  ON public.tasks(application_id, created_at DESC)
  WHERE application_id IS NOT NULL;

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_staff_id UUID NOT NULL
    CONSTRAINT notifications_recipient_staff_fk REFERENCES public.staff(id) ON DELETE CASCADE,
  task_id UUID
    CONSTRAINT notifications_task_fk REFERENCES public.tasks(id) ON DELETE CASCADE,
  customer_id UUID
    CONSTRAINT notifications_customer_fk REFERENCES public.customers(id) ON DELETE CASCADE,
  application_id UUID
    CONSTRAINT notifications_application_fk REFERENCES public.applications(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'task',
  title TEXT NOT NULL,
  message TEXT,
  href TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notifications_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT notifications_read_consistent CHECK (
    (is_read = false AND read_at IS NULL)
    OR (is_read = true AND read_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX notifications_idempotency_key_unique
  ON public.notifications(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX notifications_recipient_unread_idx
  ON public.notifications(recipient_staff_id, created_at DESC)
  WHERE is_read = false;
CREATE INDEX notifications_recipient_created_idx
  ON public.notifications(recipient_staff_id, created_at DESC);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_read_assigned ON public.tasks
  FOR SELECT TO authenticated
  USING (
    (public.is_admin() OR assigned_staff_id = public.current_staff_id())
    AND (customer_id IS NULL OR public.can_access_customer(customer_id))
  );

CREATE POLICY notifications_read_own ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_staff_id = public.current_staff_id());

REVOKE ALL ON TABLE public.tasks, public.notifications FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.tasks, public.notifications FROM authenticated;
GRANT SELECT ON TABLE public.tasks, public.notifications TO authenticated;
GRANT ALL ON TABLE public.tasks, public.notifications TO service_role;

CREATE TRIGGER tasks_set_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.notify_task_assignment_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('app.restore_mode', true) = 'on' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_staff_id,
    task_id,
    customer_id,
    application_id,
    type,
    title,
    message,
    href,
    idempotency_key
  )
  VALUES (
    NEW.assigned_staff_id,
    NEW.id,
    NEW.customer_id,
    NEW.application_id,
    NEW.task_type,
    'Yeni görev: ' || NEW.title,
    NEW.description,
    '/tasks?task=' || NEW.id::TEXT,
    'task-assigned:' || NEW.id::TEXT || ':' || NEW.assigned_staff_id::TEXT
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  RETURN NEW;
END
$$;

CREATE TRIGGER tasks_notify_assignment
AFTER INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment_v1();

CREATE OR REPLACE FUNCTION public.create_task_v1(p_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  target_staff_id UUID;
  target_staff_role TEXT;
  payload_customer_id UUID := NULLIF(p_payload->>'customer_id', '')::UUID;
  payload_application_id UUID := NULLIF(p_payload->>'application_id', '')::UUID;
  new_task_id UUID;
  due_value TIMESTAMPTZ;
BEGIN
  IF actor_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  target_staff_id := NULLIF(p_payload->>'assigned_staff_id', '')::UUID;
  IF target_staff_id IS NULL THEN
    target_staff_id := actor_staff_id;
  END IF;

  IF NOT public.is_admin() AND target_staff_id <> actor_staff_id THEN
    RAISE EXCEPTION 'task_assignment_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT staff.role
  INTO target_staff_role
  FROM public.staff AS staff
  WHERE staff.id = target_staff_id AND staff.is_active = true;

  IF target_staff_role IS NULL THEN
    RAISE EXCEPTION 'active_assignee_required' USING ERRCODE = '22023';
  END IF;

  IF payload_customer_id IS NOT NULL
    AND NOT public.can_access_customer(payload_customer_id) THEN
    RAISE EXCEPTION 'customer_access_forbidden' USING ERRCODE = '42501';
  END IF;

  IF payload_customer_id IS NOT NULL
    AND target_staff_role <> 'admin'
    AND NOT EXISTS (
      SELECT 1
      FROM public.customers AS customer
      WHERE customer.id = payload_customer_id
        AND customer.is_deleted = false
        AND customer.assigned_staff_id = target_staff_id
    ) THEN
    RAISE EXCEPTION 'task_assignee_customer_mismatch' USING ERRCODE = '22023';
  END IF;

  IF payload_application_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.applications AS application
      JOIN public.customers AS customer ON customer.id = application.customer_id
      WHERE application.id = payload_application_id
        AND customer.is_deleted = false
        AND (
          public.is_admin()
          OR application.assigned_staff_id = actor_staff_id
          OR customer.assigned_staff_id = actor_staff_id
        )
    ) THEN
    RAISE EXCEPTION 'application_access_forbidden' USING ERRCODE = '42501';
  END IF;

  IF payload_application_id IS NOT NULL
    AND target_staff_role <> 'admin'
    AND NOT EXISTS (
      SELECT 1
      FROM public.applications AS application
      JOIN public.customers AS customer ON customer.id = application.customer_id
      WHERE application.id = payload_application_id
        AND customer.is_deleted = false
        AND (
          application.assigned_staff_id = target_staff_id
          OR customer.assigned_staff_id = target_staff_id
        )
    ) THEN
    RAISE EXCEPTION 'task_assignee_application_mismatch' USING ERRCODE = '22023';
  END IF;

  due_value := NULLIF(p_payload->>'due_at', '')::TIMESTAMPTZ;
  IF due_value IS NULL THEN
    RAISE EXCEPTION 'due_at_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tasks (
    title,
    description,
    task_type,
    source_type,
    status,
    priority,
    due_at,
    assigned_staff_id,
    created_by_staff_id,
    customer_id,
    application_id
  )
  VALUES (
    trim(COALESCE(p_payload->>'title', '')),
    NULLIF(trim(COALESCE(p_payload->>'description', '')), ''),
    'manual',
    'manual',
    'pending',
    COALESCE(NULLIF(p_payload->>'priority', ''), 'normal'),
    due_value,
    target_staff_id,
    actor_staff_id,
    payload_customer_id,
    payload_application_id
  )
  RETURNING id INTO new_task_id;

  RETURN new_task_id;
END
$$;

CREATE OR REPLACE FUNCTION public.set_task_status_v1(p_task_id UUID, p_status TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF public.current_staff_id() IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('pending', 'in_progress', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_task_status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tasks AS task
  SET status = p_status,
      completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE NULL END
  WHERE task.id = p_task_id
    AND (
      public.is_admin()
      OR task.assigned_staff_id = public.current_staff_id()
    )
    AND (task.customer_id IS NULL OR public.can_access_customer(task.customer_id));

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_read_v1(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF public.current_staff_id() IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.notifications AS notification
  SET is_read = true,
      read_at = COALESCE(notification.read_at, now())
  WHERE notification.id = p_notification_id
    AND notification.recipient_staff_id = public.current_staff_id();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read_v1()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF public.current_staff_id() IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.notifications AS notification
  SET is_read = true,
      read_at = COALESCE(notification.read_at, now())
  WHERE notification.recipient_staff_id = public.current_staff_id()
    AND notification.is_read = false;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END
$$;

CREATE OR REPLACE FUNCTION public.sync_operational_tasks_v1()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  inserted_count INTEGER := 0;
  step_count INTEGER := 0;
BEGIN
  IF actor_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  -- Yaklasan randevular: randevudan 24 saat once yapilacak gorev.
  INSERT INTO public.tasks (
    title, description, task_type, source_type, source_id, priority, due_at,
    assigned_staff_id, customer_id, application_id, idempotency_key
  )
  SELECT
    'Yaklaşan randevu: ' || customer.first_name || ' ' || customer.last_name,
    application.country || ' randevusu ' || to_char(application.appointment_date AT TIME ZONE 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI'),
    'appointment', 'appointment', application.id, 'urgent',
    application.appointment_date - interval '24 hours',
    assignee.id, customer.id, application.id,
    'appointment:' || application.id::TEXT || ':' || extract(epoch FROM application.appointment_date)::BIGINT::TEXT
  FROM public.applications AS application
  JOIN public.customers AS customer ON customer.id = application.customer_id AND customer.is_deleted = false
  JOIN public.staff AS assignee
    ON assignee.id = COALESCE(application.assigned_staff_id, customer.assigned_staff_id)
   AND assignee.is_active = true
  WHERE application.appointment_date > now()
    AND application.appointment_date <= now() + interval '48 hours'
    AND (public.is_admin() OR assignee.id = actor_staff_id)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS step_count = ROW_COUNT;
  inserted_count := inserted_count + step_count;

  -- Uc gunden uzun suredir bekleyen zorunlu evraklar.
  INSERT INTO public.tasks (
    title, description, task_type, source_type, source_id, priority, due_at,
    assigned_staff_id, customer_id, application_id, idempotency_key
  )
  SELECT
    'Geciken evrak: ' || document.document_type,
    customer.first_name || ' ' || customer.last_name || ' — ' || application.country,
    'document', 'document', document.id,
    CASE WHEN document.requested_at <= now() - interval '7 days' THEN 'urgent' ELSE 'high' END,
    document.requested_at + interval '3 days',
    assignee.id, customer.id, application.id,
    'document:' || document.id::TEXT || ':overdue'
  FROM public.documents AS document
  JOIN public.applications AS application ON application.id = document.application_id
  JOIN public.customers AS customer ON customer.id = application.customer_id AND customer.is_deleted = false
  JOIN public.staff AS assignee
    ON assignee.id = COALESCE(application.assigned_staff_id, customer.assigned_staff_id)
   AND assignee.is_active = true
  WHERE document.is_required = true
    AND document.status = 'bekleniyor'
    AND document.requested_at <= now() - interval '3 days'
    AND (public.is_admin() OR assignee.id = actor_staff_id)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS step_count = ROW_COUNT;
  inserted_count := inserted_count + step_count;

  -- Uc gunden uzun suredir bekleyen odemeler.
  INSERT INTO public.tasks (
    title, description, task_type, source_type, source_id, priority, due_at,
    assigned_staff_id, customer_id, application_id, idempotency_key
  )
  SELECT
    'Bekleyen ödeme: ' || customer.first_name || ' ' || customer.last_name,
    payment.amount::TEXT || ' ' || payment.currency || ' — ' || application.country,
    'payment', 'payment', payment.id, 'high', payment.created_at + interval '3 days',
    assignee.id, customer.id, application.id,
    'payment:' || payment.id::TEXT || ':pending'
  FROM public.payments AS payment
  JOIN public.applications AS application ON application.id = payment.application_id
  JOIN public.customers AS customer ON customer.id = application.customer_id AND customer.is_deleted = false
  JOIN public.staff AS assignee
    ON assignee.id = COALESCE(application.assigned_staff_id, customer.assigned_staff_id)
   AND assignee.is_active = true
  WHERE payment.status = 'bekliyor'
    AND payment.created_at <= now() - interval '3 days'
    AND (public.is_admin() OR assignee.id = actor_staff_id)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS step_count = ROW_COUNT;
  inserted_count := inserted_count + step_count;

  -- Yedi gundur guncellenmeyen aktif basvurular.
  INSERT INTO public.tasks (
    title, description, task_type, source_type, source_id, priority, due_at,
    assigned_staff_id, customer_id, application_id, idempotency_key
  )
  SELECT
    'Hareketsiz başvuru: ' || customer.first_name || ' ' || customer.last_name,
    application.country || ' başvurusu 7 gündür güncellenmedi.',
    'inactivity', 'inactivity', application.id, 'normal',
    application.updated_at + interval '7 days',
    assignee.id, customer.id, application.id,
    'inactivity:' || application.id::TEXT || ':' || extract(epoch FROM application.updated_at)::BIGINT::TEXT
  FROM public.applications AS application
  JOIN public.customers AS customer ON customer.id = application.customer_id AND customer.is_deleted = false
  JOIN public.staff AS assignee
    ON assignee.id = COALESCE(application.assigned_staff_id, customer.assigned_staff_id)
   AND assignee.is_active = true
  WHERE application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
    AND application.updated_at <= now() - interval '7 days'
    AND (public.is_admin() OR assignee.id = actor_staff_id)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS step_count = ROW_COUNT;
  inserted_count := inserted_count + step_count;

  RETURN inserted_count;
END
$$;

REVOKE ALL ON FUNCTION public.notify_task_assignment_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_task_v1(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_task_status_v1(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notification_read_v1(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_operational_tasks_v1() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_task_v1(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_task_status_v1(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_operational_tasks_v1() TO authenticated;

-- Yeni tablolar backup v2'ye dahil edilir. Eski v2 yedeklerde bu iki anahtar
-- bulunmayabilir; bos dizi varsayimi geriye uyumlulugu korur.
CREATE OR REPLACE FUNCTION public.restore_backup_v2(p_backup JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  table_name TEXT;
  required_tables CONSTANT TEXT[] := ARRAY[
    'tenants',
    'staff',
    'countries',
    'country_visa_rules',
    'customers',
    'applications',
    'documents',
    'notes',
    'payments',
    'activity_log',
    'communications',
    'visa_history',
    'family_members',
    'webhook_events'
  ];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_backup IS NULL OR jsonb_typeof(p_backup) <> 'object' THEN
    RAISE EXCEPTION 'backup_object_required' USING ERRCODE = '22023';
  END IF;
  IF p_backup->>'format' <> 'nobel-vize-crm-backup' OR p_backup->>'version' <> '2.0' THEN
    RAISE EXCEPTION 'unsupported_backup_format_or_version' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_backup->'tables') <> 'object' THEN
    RAISE EXCEPTION 'backup_tables_object_required' USING ERRCODE = '22023';
  END IF;

  FOREACH table_name IN ARRAY required_tables
  LOOP
    IF NOT (p_backup->'tables' ? table_name)
      OR jsonb_typeof(p_backup->'tables'->table_name) <> 'array' THEN
      RAISE EXCEPTION 'backup_table_missing_or_not_array:%', table_name USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF (p_backup->'tables' ? 'tasks')
    AND jsonb_typeof(p_backup->'tables'->'tasks') <> 'array' THEN
    RAISE EXCEPTION 'backup_table_not_array:tasks' USING ERRCODE = '22023';
  END IF;
  IF (p_backup->'tables' ? 'notifications')
    AND jsonb_typeof(p_backup->'tables'->'notifications') <> 'array' THEN
    RAISE EXCEPTION 'backup_table_not_array:notifications' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.restore_mode', 'on', true);

  DELETE FROM public.notifications;
  DELETE FROM public.tasks;
  DELETE FROM public.webhook_events;
  DELETE FROM public.activity_log;
  DELETE FROM public.family_members;
  DELETE FROM public.visa_history;
  DELETE FROM public.communications;
  DELETE FROM public.notes;
  DELETE FROM public.payments;
  DELETE FROM public.documents;
  DELETE FROM public.applications;
  DELETE FROM public.customers;
  DELETE FROM public.country_visa_rules;
  DELETE FROM public.countries;
  DELETE FROM public.staff;
  DELETE FROM public.tenants;

  INSERT INTO public.tenants
  SELECT * FROM jsonb_populate_recordset(NULL::public.tenants, p_backup->'tables'->'tenants');
  INSERT INTO public.staff
  SELECT * FROM jsonb_populate_recordset(NULL::public.staff, p_backup->'tables'->'staff');
  INSERT INTO public.countries
  SELECT * FROM jsonb_populate_recordset(NULL::public.countries, p_backup->'tables'->'countries');
  INSERT INTO public.country_visa_rules
  SELECT * FROM jsonb_populate_recordset(NULL::public.country_visa_rules, p_backup->'tables'->'country_visa_rules');
  INSERT INTO public.customers
  SELECT * FROM jsonb_populate_recordset(NULL::public.customers, p_backup->'tables'->'customers');
  INSERT INTO public.applications
  SELECT * FROM jsonb_populate_recordset(NULL::public.applications, p_backup->'tables'->'applications');
  INSERT INTO public.documents
  SELECT * FROM jsonb_populate_recordset(NULL::public.documents, p_backup->'tables'->'documents');
  INSERT INTO public.notes
  SELECT * FROM jsonb_populate_recordset(NULL::public.notes, p_backup->'tables'->'notes');
  INSERT INTO public.payments
  SELECT * FROM jsonb_populate_recordset(NULL::public.payments, p_backup->'tables'->'payments');
  INSERT INTO public.activity_log
  SELECT * FROM jsonb_populate_recordset(NULL::public.activity_log, p_backup->'tables'->'activity_log');
  INSERT INTO public.communications
  SELECT * FROM jsonb_populate_recordset(NULL::public.communications, p_backup->'tables'->'communications');
  INSERT INTO public.tasks
  SELECT * FROM jsonb_populate_recordset(
    NULL::public.tasks,
    COALESCE(p_backup->'tables'->'tasks', '[]'::JSONB)
  );
  INSERT INTO public.notifications
  SELECT * FROM jsonb_populate_recordset(
    NULL::public.notifications,
    COALESCE(p_backup->'tables'->'notifications', '[]'::JSONB)
  );
  INSERT INTO public.visa_history
  SELECT * FROM jsonb_populate_recordset(NULL::public.visa_history, p_backup->'tables'->'visa_history');
  INSERT INTO public.family_members
  SELECT * FROM jsonb_populate_recordset(NULL::public.family_members, p_backup->'tables'->'family_members');
  INSERT INTO public.webhook_events
  SELECT * FROM jsonb_populate_recordset(NULL::public.webhook_events, p_backup->'tables'->'webhook_events');

  RETURN jsonb_build_object(
    'success', true,
    'version', '2.0',
    'restored_at', now(),
    'table_count', array_length(required_tables, 1) + 2
  );
END
$$;

COMMIT;
