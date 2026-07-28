-- Faz 4.6: dry-run varsayimli, onayli ve yedek kapili KVKK yasam dongusu.

BEGIN;

ALTER TABLE public.scheduled_job_runs
  DROP CONSTRAINT scheduled_job_runs_job_valid,
  ADD CONSTRAINT scheduled_job_runs_job_valid
    CHECK (job_name IN ('operations', 'backup', 'messages', 'privacy'));

CREATE TABLE public.privacy_action_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  request_id UUID REFERENCES public.data_subject_requests(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL,
  required_approvals INTEGER NOT NULL,
  requested_by_staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT privacy_action_type_valid CHECK (action_type IN ('anonymize', 'purge')),
  CONSTRAINT privacy_action_status_valid CHECK (
    status IN ('pending', 'approved', 'processing', 'completed', 'rejected', 'failed')
  ),
  CONSTRAINT privacy_action_reason_length CHECK (length(btrim(reason)) BETWEEN 5 AND 1000),
  CONSTRAINT privacy_action_approval_count_valid CHECK (required_approvals IN (1, 2)),
  CONSTRAINT privacy_action_failure_code_valid CHECK (
    failure_code IS NULL OR failure_code ~ '^[A-Za-z0-9_.:/-]{1,120}$'
  ),
  CONSTRAINT privacy_action_state_consistent CHECK (
    (status = 'pending' AND approved_at IS NULL AND completed_at IS NULL AND failure_code IS NULL)
    OR (status IN ('approved', 'processing') AND approved_at IS NOT NULL AND completed_at IS NULL AND failure_code IS NULL)
    OR (status = 'completed' AND approved_at IS NOT NULL AND completed_at IS NOT NULL AND failure_code IS NULL)
    OR (status = 'rejected' AND completed_at IS NOT NULL AND failure_code IS NULL)
    OR (status = 'failed' AND completed_at IS NOT NULL AND failure_code IS NOT NULL)
  )
);

CREATE UNIQUE INDEX privacy_action_queue_active_unique
  ON public.privacy_action_queue(customer_id, action_type)
  WHERE status IN ('pending', 'approved', 'processing');
CREATE INDEX privacy_action_queue_status_created_idx
  ON public.privacy_action_queue(status, created_at);
CREATE TRIGGER privacy_action_queue_set_updated_at
  BEFORE UPDATE ON public.privacy_action_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.privacy_action_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.privacy_action_queue(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT privacy_action_approval_reason_length CHECK (length(btrim(reason)) BETWEEN 5 AND 1000),
  UNIQUE (action_id, staff_id)
);

CREATE TABLE public.privacy_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID REFERENCES public.privacy_action_queue(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  actor_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT privacy_audit_event_valid CHECK (
    event_type IN (
      'dry_run', 'queued', 'approved', 'rejected', 'storage_cleaned',
      'anonymized', 'purged', 'failed'
    )
  ),
  CONSTRAINT privacy_audit_reason_length CHECK (reason IS NULL OR length(reason) <= 1000),
  CONSTRAINT privacy_audit_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX privacy_audit_log_created_idx ON public.privacy_audit_log(created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_privacy_audit_mutation_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(current_setting('app.restore_mode', true), '') = 'on'
    OR pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'privacy_audit_is_immutable' USING ERRCODE = '42501';
END
$$;
CREATE TRIGGER privacy_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.privacy_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privacy_audit_mutation_v1();

ALTER TABLE public.privacy_action_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_action_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY privacy_action_queue_admin_read ON public.privacy_action_queue
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY privacy_action_approvals_admin_read ON public.privacy_action_approvals
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY privacy_audit_log_admin_read ON public.privacy_audit_log
  FOR SELECT TO authenticated USING (public.is_admin());

REVOKE ALL ON public.privacy_action_queue, public.privacy_action_approvals, public.privacy_audit_log
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.privacy_action_queue, public.privacy_action_approvals, public.privacy_audit_log
  TO authenticated;
GRANT ALL ON public.privacy_action_queue, public.privacy_action_approvals, public.privacy_audit_log
  TO service_role;

CREATE OR REPLACE FUNCTION public.list_privacy_lifecycle_candidates_v1()
RETURNS TABLE (
  customer_id UUID,
  customer_name TEXT,
  request_id UUID,
  proposed_action TEXT,
  deleted_at TIMESTAMPTZ,
  storage_file_count BIGINT,
  hold_active BOOLEAN,
  grace_eligible BOOLEAN,
  blocked_reasons TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    customer.id,
    customer.first_name || ' ' || customer.last_name,
    privacy_request.id,
    CASE WHEN customer.anonymized_at IS NULL THEN 'anonymize' ELSE 'purge' END,
    customer.deleted_at,
    (
      SELECT count(*)
      FROM public.documents document
      JOIN public.applications application ON application.id = document.application_id
      WHERE application.customer_id = customer.id AND document.file_url IS NOT NULL
    ),
    customer.retention_hold_until IS NOT NULL AND customer.retention_hold_until > now(),
    customer.deleted_at <= now() - make_interval(days => settings.archive_grace_days),
    array_remove(ARRAY[
      CASE WHEN privacy_request.id IS NULL THEN 'approved_request_required' END,
      CASE WHEN customer.retention_hold_until IS NOT NULL AND customer.retention_hold_until > now()
        THEN 'retention_hold_active' END,
      CASE WHEN customer.deleted_at > now() - make_interval(days => settings.archive_grace_days)
        THEN 'archive_grace_period' END
    ], NULL)
  FROM public.customers customer
  CROSS JOIN public.privacy_settings settings
  LEFT JOIN LATERAL (
    SELECT request.id
    FROM public.data_subject_requests request
    WHERE request.customer_id = customer.id
      AND request.request_type IN ('deletion', 'anonymization')
      AND request.status = 'approved'
    ORDER BY request.requested_at DESC
    LIMIT 1
  ) privacy_request ON true
  WHERE customer.is_deleted = true
    AND settings.id = '00000000-0000-0000-0000-000000000360'
  ORDER BY customer.deleted_at;
END
$$;

CREATE OR REPLACE FUNCTION public.queue_privacy_action_v1(
  p_customer_id UUID,
  p_request_id UUID,
  p_action_type TEXT,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  action_id UUID;
  required_count INTEGER;
  customer_record public.customers%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_action_type NOT IN ('anonymize', 'purge') THEN
    RAISE EXCEPTION 'privacy_action_type_invalid' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'privacy_action_reason_invalid' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO customer_record FROM public.customers WHERE id = p_customer_id FOR UPDATE;
  IF customer_record.id IS NULL OR NOT customer_record.is_deleted THEN
    RAISE EXCEPTION 'archived_customer_required' USING ERRCODE = '22023';
  END IF;
  IF customer_record.retention_hold_until IS NOT NULL AND customer_record.retention_hold_until > now() THEN
    RAISE EXCEPTION 'customer_retention_hold_active' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.data_subject_requests
    WHERE id = p_request_id AND customer_id = p_customer_id
      AND request_type IN ('deletion', 'anonymization') AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'approved_privacy_request_required' USING ERRCODE = '22023';
  END IF;
  IF p_action_type = 'anonymize' AND customer_record.anonymized_at IS NOT NULL THEN
    RAISE EXCEPTION 'customer_already_anonymized' USING ERRCODE = '22023';
  END IF;
  IF p_action_type = 'purge' AND customer_record.anonymized_at IS NULL THEN
    RAISE EXCEPTION 'customer_anonymization_required' USING ERRCODE = '22023';
  END IF;

  required_count := CASE WHEN p_action_type = 'purge' THEN 2 ELSE 1 END;
  INSERT INTO public.privacy_action_queue (
    customer_id, request_id, action_type, reason, required_approvals, requested_by_staff_id
  ) VALUES (
    p_customer_id, p_request_id, p_action_type, btrim(p_reason), required_count, actor_staff_id
  ) RETURNING id INTO action_id;

  INSERT INTO public.privacy_audit_log (
    action_id, customer_id, event_type, actor_staff_id, reason,
    metadata
  ) VALUES (
    action_id, p_customer_id, 'queued', actor_staff_id, btrim(p_reason),
    jsonb_build_object('action_type', p_action_type, 'required_approvals', required_count)
  );
  RETURN action_id;
END
$$;

CREATE OR REPLACE FUNCTION public.approve_privacy_action_v1(p_action_id UUID, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  target public.privacy_action_queue%ROWTYPE;
  approval_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'privacy_approval_reason_invalid' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO target FROM public.privacy_action_queue WHERE id = p_action_id FOR UPDATE;
  IF target.id IS NULL OR target.status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'privacy_action_not_approvable' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.privacy_action_approvals(action_id, staff_id, reason)
  VALUES (p_action_id, actor_staff_id, btrim(p_reason))
  ON CONFLICT (action_id, staff_id) DO NOTHING;
  SELECT count(*) INTO approval_count
  FROM public.privacy_action_approvals WHERE action_id = p_action_id;

  IF approval_count >= target.required_approvals THEN
    UPDATE public.privacy_action_queue
    SET status = 'approved', approved_at = COALESCE(approved_at, now())
    WHERE id = p_action_id;
  END IF;
  INSERT INTO public.privacy_audit_log (
    action_id, customer_id, event_type, actor_staff_id, reason, metadata
  ) VALUES (
    p_action_id, target.customer_id, 'approved', actor_staff_id, btrim(p_reason),
    jsonb_build_object('approval_count', approval_count, 'required_approvals', target.required_approvals)
  );
  RETURN approval_count >= target.required_approvals;
END
$$;

CREATE OR REPLACE FUNCTION public.reject_privacy_action_v1(p_action_id UUID, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  target public.privacy_action_queue%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'privacy_rejection_reason_invalid' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO target FROM public.privacy_action_queue WHERE id = p_action_id FOR UPDATE;
  IF target.id IS NULL OR target.status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'privacy_action_not_rejectable' USING ERRCODE = '22023';
  END IF;
  UPDATE public.privacy_action_queue
  SET status = 'rejected', completed_at = now(), approved_at = NULL
  WHERE id = p_action_id;
  INSERT INTO public.privacy_audit_log(action_id, customer_id, event_type, actor_staff_id, reason)
  VALUES (p_action_id, target.customer_id, 'rejected', actor_staff_id, btrim(p_reason));
  RETURN true;
END
$$;

CREATE OR REPLACE FUNCTION public.execute_privacy_action_v1(p_action_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  service_invocation BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
  target public.privacy_action_queue%ROWTYPE;
  customer_record public.customers%ROWTYPE;
  approval_count INTEGER;
  grace_days INTEGER;
  actor_name TEXT := 'Sistem';
BEGIN
  IF NOT service_invocation AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_or_service_role_required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO target FROM public.privacy_action_queue WHERE id = p_action_id FOR UPDATE;
  IF target.id IS NULL OR target.status <> 'approved' THEN
    RAISE EXCEPTION 'approved_privacy_action_required' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO approval_count FROM public.privacy_action_approvals WHERE action_id = target.id;
  IF approval_count < target.required_approvals THEN
    RAISE EXCEPTION 'privacy_approval_count_insufficient' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.backup_runs
    WHERE status = 'verified' AND verified_at >= target.approved_at
  ) THEN
    RAISE EXCEPTION 'verified_backup_after_approval_required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO customer_record FROM public.customers WHERE id = target.customer_id FOR UPDATE;
  IF customer_record.id IS NULL OR NOT customer_record.is_deleted THEN
    RAISE EXCEPTION 'archived_customer_required' USING ERRCODE = '22023';
  END IF;
  IF customer_record.retention_hold_until IS NOT NULL AND customer_record.retention_hold_until > now() THEN
    RAISE EXCEPTION 'customer_retention_hold_active' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.documents document
    JOIN public.applications application ON application.id = document.application_id
    WHERE application.customer_id = customer_record.id AND document.file_url IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'storage_cleanup_required' USING ERRCODE = '22023';
  END IF;
  SELECT archive_grace_days INTO grace_days FROM public.privacy_settings
  WHERE id = '00000000-0000-0000-0000-000000000360';
  IF customer_record.deleted_at > now() - make_interval(days => grace_days) THEN
    RAISE EXCEPTION 'archive_grace_period_required' USING ERRCODE = '22023';
  END IF;
  IF actor_staff_id IS NOT NULL THEN
    SELECT full_name INTO actor_name FROM public.staff WHERE id = actor_staff_id;
  END IF;

  UPDATE public.privacy_action_queue SET status = 'processing' WHERE id = target.id;

  IF target.action_type = 'anonymize' THEN
    UPDATE public.activity_log SET action = '[ANONİMLEŞTİRİLDİ]', performed_by = COALESCE(performed_by, 'Sistem')
    WHERE customer_id = customer_record.id OR application_id IN (
      SELECT id FROM public.applications WHERE customer_id = customer_record.id
    );
    UPDATE public.applications SET rejection_reason = NULL, appointment_location = NULL,
      travel_method = NULL, accommodation = NULL, occupation = NULL,
      with_children = NULL, nationality = NULL WHERE customer_id = customer_record.id;
    UPDATE public.notes SET content = '[ANONİMLEŞTİRİLDİ]', author = 'Anonim'
      WHERE application_id IN (SELECT id FROM public.applications WHERE customer_id = customer_record.id);
    UPDATE public.payments SET note = NULL, method = NULL
      WHERE application_id IN (SELECT id FROM public.applications WHERE customer_id = customer_record.id);
    UPDATE public.communications SET subject = NULL, content = NULL, recipient = NULL, failure_reason = NULL
      WHERE customer_id = customer_record.id OR application_id IN (
        SELECT id FROM public.applications WHERE customer_id = customer_record.id
      );
    UPDATE public.visa_history SET notes = NULL WHERE customer_id = customer_record.id;
    DELETE FROM public.family_members WHERE customer_id = customer_record.id;
    DELETE FROM public.customer_tags WHERE customer_id = customer_record.id;
    UPDATE public.tasks SET title = 'Anonimleştirilmiş müşteri görevi', description = NULL,
      source_id = NULL, idempotency_key = NULL WHERE customer_id = customer_record.id;
    UPDATE public.notifications SET title = 'Anonimleştirilmiş müşteri bildirimi', message = NULL,
      href = NULL, idempotency_key = NULL WHERE customer_id = customer_record.id;
    UPDATE public.customer_privacy_notices SET evidence_note = NULL WHERE customer_id = customer_record.id;
    UPDATE public.customer_consents SET evidence_note = NULL WHERE customer_id = customer_record.id;
    UPDATE public.data_subject_requests SET notes = NULL WHERE customer_id = customer_record.id;
    UPDATE public.customers SET
      first_name = 'Anonim',
      last_name = 'Müşteri ' || left(replace(id::TEXT, '-', ''), 8),
      phone = NULL, email = NULL, passport_no = NULL, passport_expiry = NULL,
      passport_issuing_country = NULL, financial_status = NULL, monthly_income = NULL,
      notes = NULL, assigned_staff_id = NULL, portal_token = gen_random_uuid()::TEXT,
      portal_access_enabled = false, portal_token_expires_at = now(),
      retention_hold_until = NULL, retention_hold_reason = NULL,
      anonymized_at = now(), anonymized_by_staff_id = actor_staff_id
    WHERE id = customer_record.id;
    UPDATE public.data_subject_requests
      SET status = 'completed', completed_at = now(), handled_by_staff_id = actor_staff_id,
          resolution_note = 'Onay kuyruğu ve yedek kapısı ile anonimleştirme tamamlandı.'
      WHERE id = target.request_id;
    INSERT INTO public.activity_log(customer_id, action, performed_by, performed_by_staff_id, type)
    VALUES (customer_record.id, 'Müşteri kontrollü olarak anonimleştirildi — ' || actor_name,
      actor_name, actor_staff_id, 'privacy');
    INSERT INTO public.privacy_audit_log(action_id, customer_id, event_type, actor_staff_id, reason)
    VALUES (target.id, customer_record.id, 'anonymized', actor_staff_id, target.reason);
  ELSE
    IF customer_record.anonymized_at IS NULL THEN
      RAISE EXCEPTION 'customer_anonymization_required' USING ERRCODE = '22023';
    END IF;
    DELETE FROM public.customers WHERE id = customer_record.id;
    INSERT INTO public.privacy_audit_log(action_id, customer_id, event_type, actor_staff_id, reason, metadata)
    VALUES (target.id, NULL, 'purged', actor_staff_id, target.reason,
      jsonb_build_object('customer_reference', customer_record.id));
  END IF;

  UPDATE public.privacy_action_queue
  SET status = 'completed', completed_at = now()
  WHERE id = target.id;
  RETURN jsonb_build_object('status', 'completed', 'action_type', target.action_type);
END
$$;

REVOKE ALL ON FUNCTION public.prevent_privacy_audit_mutation_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_privacy_lifecycle_candidates_v1() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.queue_privacy_action_v1(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_privacy_action_v1(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_privacy_action_v1(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.execute_privacy_action_v1(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_privacy_lifecycle_candidates_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_privacy_action_v1(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_privacy_action_v1(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_privacy_action_v1(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_privacy_action_v1(UUID) TO authenticated, service_role;

COMMIT;
