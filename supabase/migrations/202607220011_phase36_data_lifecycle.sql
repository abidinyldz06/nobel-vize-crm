-- Faz 3.6.3-3.6.5: veri sahibi talepleri, saklama kilidi, Storage temizligi ve kontrollu anonimlestirme.

BEGIN;

CREATE TABLE public.privacy_settings (
  id UUID PRIMARY KEY,
  customer_retention_days INTEGER,
  document_retention_days INTEGER,
  archive_grace_days INTEGER NOT NULL DEFAULT 30,
  automatic_actions_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT privacy_settings_customer_retention_range CHECK (customer_retention_days IS NULL OR customer_retention_days BETWEEN 30 AND 36500),
  CONSTRAINT privacy_settings_document_retention_range CHECK (document_retention_days IS NULL OR document_retention_days BETWEEN 30 AND 36500),
  CONSTRAINT privacy_settings_archive_grace_range CHECK (archive_grace_days BETWEEN 30 AND 3650),
  CONSTRAINT privacy_settings_automatic_requires_periods CHECK (
    automatic_actions_enabled = false
    OR (customer_retention_days IS NOT NULL AND document_retention_days IS NOT NULL)
  )
);

INSERT INTO public.privacy_settings (id)
VALUES ('00000000-0000-0000-0000-000000000360')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  requested_via TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  resolution_note TEXT,
  created_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  handled_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT data_subject_request_type_check CHECK (request_type IN ('access', 'export', 'correction', 'restriction', 'deletion', 'anonymization')),
  CONSTRAINT data_subject_request_status_check CHECK (status IN ('received', 'in_review', 'approved', 'completed', 'rejected', 'cancelled')),
  CONSTRAINT data_subject_request_via_check CHECK (requested_via IN ('yuz_yuze', 'email', 'whatsapp', 'portal', 'telefon', 'diger')),
  CONSTRAINT data_subject_request_notes_length CHECK (notes IS NULL OR length(notes) <= 4000),
  CONSTRAINT data_subject_request_resolution_length CHECK (resolution_note IS NULL OR length(resolution_note) <= 4000),
  CONSTRAINT data_subject_request_completion_consistent CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  )
);

ALTER TABLE public.customers
  ADD COLUMN anonymized_at TIMESTAMPTZ,
  ADD COLUMN anonymized_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN retention_hold_until TIMESTAMPTZ,
  ADD COLUMN retention_hold_reason TEXT;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_retention_hold_reason_length CHECK (retention_hold_reason IS NULL OR length(retention_hold_reason) <= 1000),
  ADD CONSTRAINT customers_anonymization_consistent CHECK (
    (anonymized_at IS NULL AND anonymized_by_staff_id IS NULL)
    OR anonymized_at IS NOT NULL
  );

ALTER TABLE public.documents ADD COLUMN storage_deleted_at TIMESTAMPTZ;

CREATE INDEX idx_data_subject_requests_customer_status ON public.data_subject_requests(customer_id, status, requested_at DESC);
CREATE INDEX idx_customers_retention_candidates ON public.customers(deleted_at, anonymized_at) WHERE is_deleted = true;

CREATE TRIGGER privacy_settings_set_updated_at BEFORE UPDATE ON public.privacy_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER data_subject_requests_set_updated_at BEFORE UPDATE ON public.data_subject_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY privacy_settings_staff_read ON public.privacy_settings
  FOR SELECT TO authenticated USING (public.current_staff_id() IS NOT NULL);
CREATE POLICY data_subject_requests_assigned_read ON public.data_subject_requests
  FOR SELECT TO authenticated USING (public.can_access_customer(customer_id));

GRANT SELECT ON public.privacy_settings, public.data_subject_requests TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.privacy_settings, public.data_subject_requests FROM authenticated;
GRANT ALL ON public.privacy_settings, public.data_subject_requests TO service_role;
-- Faz 3.4-3.5 sonrasinda eklenen kataloglar admin export/backup istemcisiyle okunabilmelidir.
GRANT ALL ON public.tags, public.customer_tags, public.message_templates TO service_role;

CREATE OR REPLACE FUNCTION public.create_data_subject_request_v1(p_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  target_customer_id UUID;
  request_type_value TEXT := COALESCE(p_payload->>'request_type', '');
  requested_via_value TEXT := COALESCE(p_payload->>'requested_via', '');
  requested_at_value TIMESTAMPTZ := now();
  due_at_value TIMESTAMPTZ;
  notes_value TEXT := NULLIF(btrim(COALESCE(p_payload->>'notes', '')), '');
  result_id UUID := gen_random_uuid();
  actor_name TEXT;
BEGIN
  BEGIN
    target_customer_id := (p_payload->>'customer_id')::UUID;
    requested_at_value := COALESCE((p_payload->>'requested_at')::TIMESTAMPTZ, now());
    due_at_value := NULLIF(p_payload->>'due_at', '')::TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'data_subject_request_payload_invalid' USING ERRCODE = '22023'; END;
  IF actor_staff_id IS NULL OR NOT public.can_access_customer(target_customer_id) THEN RAISE EXCEPTION 'customer_access_denied' USING ERRCODE = '42501'; END IF;
  IF request_type_value NOT IN ('access', 'export', 'correction', 'restriction', 'deletion', 'anonymization') THEN RAISE EXCEPTION 'data_subject_request_type_invalid' USING ERRCODE = '22023'; END IF;
  IF requested_via_value NOT IN ('yuz_yuze', 'email', 'whatsapp', 'portal', 'telefon', 'diger') THEN RAISE EXCEPTION 'data_subject_request_via_invalid' USING ERRCODE = '22023'; END IF;
  IF notes_value IS NOT NULL AND length(notes_value) > 4000 THEN RAISE EXCEPTION 'data_subject_request_notes_too_long' USING ERRCODE = '22023'; END IF;
  SELECT full_name INTO actor_name FROM public.staff WHERE id = actor_staff_id AND is_active = true;
  IF actor_name IS NULL THEN RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.data_subject_requests (id, customer_id, request_type, requested_via, requested_at, due_at, notes, created_by_staff_id)
  VALUES (result_id, target_customer_id, request_type_value, requested_via_value, requested_at_value, due_at_value, notes_value, actor_staff_id);
  INSERT INTO public.activity_log (customer_id, action, performed_by, performed_by_staff_id, type)
  VALUES (target_customer_id, 'KVKK veri sahibi talebi alındı: ' || request_type_value || ' — ' || actor_name, actor_name, actor_staff_id, 'privacy');
  RETURN result_id;
END $$;

CREATE OR REPLACE FUNCTION public.set_data_subject_request_status_v1(p_request_id UUID, p_status TEXT, p_resolution_note TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT;
  target_customer_id UUID;
  current_status TEXT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('received', 'in_review', 'approved', 'completed', 'rejected', 'cancelled') THEN RAISE EXCEPTION 'data_subject_request_status_invalid' USING ERRCODE = '22023'; END IF;
  IF p_resolution_note IS NOT NULL AND length(p_resolution_note) > 4000 THEN RAISE EXCEPTION 'data_subject_request_resolution_too_long' USING ERRCODE = '22023'; END IF;
  SELECT customer_id, status INTO target_customer_id, current_status FROM public.data_subject_requests WHERE id = p_request_id FOR UPDATE;
  IF target_customer_id IS NULL THEN RAISE EXCEPTION 'data_subject_request_not_found' USING ERRCODE = 'P0002'; END IF;
  IF current_status IN ('completed', 'rejected', 'cancelled') THEN RAISE EXCEPTION 'data_subject_request_already_closed' USING ERRCODE = '22023'; END IF;
  SELECT full_name INTO actor_name FROM public.staff WHERE id = actor_staff_id AND is_active = true;
  UPDATE public.data_subject_requests SET status = p_status, resolution_note = NULLIF(btrim(COALESCE(p_resolution_note, '')), ''), handled_by_staff_id = actor_staff_id,
    completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE NULL END WHERE id = p_request_id;
  INSERT INTO public.activity_log (customer_id, action, performed_by, performed_by_staff_id, type)
  VALUES (target_customer_id, 'KVKK talep durumu: ' || current_status || ' → ' || p_status || ' — ' || actor_name, actor_name, actor_staff_id, 'privacy');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.update_privacy_settings_v1(p_payload JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_staff_id UUID := public.current_staff_id(); BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501'; END IF;
  UPDATE public.privacy_settings SET
    customer_retention_days = NULLIF(p_payload->>'customer_retention_days', '')::INTEGER,
    document_retention_days = NULLIF(p_payload->>'document_retention_days', '')::INTEGER,
    archive_grace_days = COALESCE(NULLIF(p_payload->>'archive_grace_days', '')::INTEGER, archive_grace_days),
    automatic_actions_enabled = COALESCE((p_payload->>'automatic_actions_enabled')::BOOLEAN, false),
    updated_by_staff_id = actor_staff_id
  WHERE id = '00000000-0000-0000-0000-000000000360';
  RETURN true;
EXCEPTION WHEN check_violation OR invalid_text_representation THEN
  RAISE EXCEPTION 'privacy_settings_invalid' USING ERRCODE = '22023';
END $$;

CREATE OR REPLACE FUNCTION public.set_customer_retention_hold_v1(p_customer_id UUID, p_hold_until TIMESTAMPTZ, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_staff_id UUID := public.current_staff_id(); actor_name TEXT; BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501'; END IF;
  IF p_hold_until IS NOT NULL AND (p_reason IS NULL OR btrim(p_reason) = '') THEN RAISE EXCEPTION 'retention_hold_reason_required' USING ERRCODE = '22023'; END IF;
  IF p_reason IS NOT NULL AND length(p_reason) > 1000 THEN RAISE EXCEPTION 'retention_hold_reason_too_long' USING ERRCODE = '22023'; END IF;
  SELECT full_name INTO actor_name FROM public.staff WHERE id = actor_staff_id AND is_active = true;
  UPDATE public.customers SET retention_hold_until = p_hold_until, retention_hold_reason = CASE WHEN p_hold_until IS NULL THEN NULL ELSE btrim(p_reason) END WHERE id = p_customer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.activity_log (customer_id, action, performed_by, performed_by_staff_id, type)
  VALUES (p_customer_id, CASE WHEN p_hold_until IS NULL THEN 'KVKK saklama kilidi kaldırıldı' ELSE 'KVKK saklama kilidi konuldu' END || ' — ' || actor_name, actor_name, actor_staff_id, 'privacy');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.mark_customer_documents_deleted_v1(p_customer_id UUID, p_document_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE changed INTEGER; BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND is_deleted = true) THEN RAISE EXCEPTION 'archived_customer_required' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.data_subject_requests WHERE customer_id = p_customer_id AND request_type IN ('deletion','anonymization') AND status = 'approved') THEN RAISE EXCEPTION 'approved_privacy_request_required' USING ERRCODE = '22023'; END IF;
  UPDATE public.documents SET file_url = NULL, storage_deleted_at = now()
  WHERE id = ANY(COALESCE(p_document_ids, ARRAY[]::UUID[])) AND application_id IN (SELECT id FROM public.applications WHERE customer_id = p_customer_id);
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END $$;

CREATE OR REPLACE FUNCTION public.anonymize_customer_v1(p_customer_id UUID, p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT;
  grace_days INTEGER;
  customer_record public.customers%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501'; END IF;
  SELECT archive_grace_days INTO grace_days FROM public.privacy_settings WHERE id = '00000000-0000-0000-0000-000000000360';
  SELECT * INTO customer_record FROM public.customers WHERE id = p_customer_id FOR UPDATE;
  IF customer_record.id IS NULL THEN RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT customer_record.is_deleted OR customer_record.deleted_at > now() - make_interval(days => grace_days) THEN RAISE EXCEPTION 'archive_grace_period_required' USING ERRCODE = '22023'; END IF;
  IF customer_record.anonymized_at IS NOT NULL THEN RAISE EXCEPTION 'customer_already_anonymized' USING ERRCODE = '22023'; END IF;
  IF customer_record.retention_hold_until IS NOT NULL AND customer_record.retention_hold_until > now() THEN RAISE EXCEPTION 'customer_retention_hold_active' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.data_subject_requests WHERE id = p_request_id AND customer_id = p_customer_id AND request_type IN ('deletion','anonymization') AND status = 'approved') THEN RAISE EXCEPTION 'approved_privacy_request_required' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.documents d JOIN public.applications a ON a.id = d.application_id WHERE a.customer_id = p_customer_id AND d.file_url IS NOT NULL) THEN RAISE EXCEPTION 'storage_cleanup_required' USING ERRCODE = '22023'; END IF;
  SELECT full_name INTO actor_name FROM public.staff WHERE id = actor_staff_id AND is_active = true;

  UPDATE public.activity_log SET action = '[ANONİMLEŞTİRİLDİ]', performed_by = COALESCE(performed_by, 'Sistem')
  WHERE customer_id = p_customer_id OR application_id IN (SELECT id FROM public.applications WHERE customer_id = p_customer_id);
  UPDATE public.applications SET rejection_reason = NULL, appointment_location = NULL, travel_method = NULL, accommodation = NULL, occupation = NULL, with_children = NULL, nationality = NULL WHERE customer_id = p_customer_id;
  UPDATE public.notes SET content = '[ANONİMLEŞTİRİLDİ]', author = 'Anonim' WHERE application_id IN (SELECT id FROM public.applications WHERE customer_id = p_customer_id);
  UPDATE public.payments SET note = NULL, method = NULL WHERE application_id IN (SELECT id FROM public.applications WHERE customer_id = p_customer_id);
  UPDATE public.communications SET subject = NULL, content = NULL, recipient = NULL, failure_reason = NULL WHERE customer_id = p_customer_id OR application_id IN (SELECT id FROM public.applications WHERE customer_id = p_customer_id);
  UPDATE public.visa_history SET notes = NULL WHERE customer_id = p_customer_id;
  DELETE FROM public.family_members WHERE customer_id = p_customer_id;
  DELETE FROM public.customer_tags WHERE customer_id = p_customer_id;
  UPDATE public.tasks SET title = 'Anonimleştirilmiş müşteri görevi', description = NULL, source_id = NULL, idempotency_key = NULL WHERE customer_id = p_customer_id;
  UPDATE public.notifications SET title = 'Anonimleştirilmiş müşteri bildirimi', message = NULL, href = NULL, idempotency_key = NULL WHERE customer_id = p_customer_id;
  UPDATE public.customer_privacy_notices SET evidence_note = NULL WHERE customer_id = p_customer_id;
  UPDATE public.customer_consents SET evidence_note = NULL WHERE customer_id = p_customer_id;
  UPDATE public.data_subject_requests SET notes = NULL WHERE customer_id = p_customer_id;
  UPDATE public.customers SET
    first_name = 'Anonim', last_name = 'Müşteri ' || left(replace(id::TEXT, '-', ''), 8), phone = NULL, email = NULL,
    passport_no = NULL, passport_expiry = NULL, passport_issuing_country = NULL, financial_status = NULL,
    monthly_income = NULL, notes = NULL, profile_score = 0, assigned_staff_id = NULL,
    portal_token = gen_random_uuid()::TEXT, portal_access_enabled = false, portal_token_expires_at = now(),
    retention_hold_until = NULL, retention_hold_reason = NULL, anonymized_at = now(), anonymized_by_staff_id = actor_staff_id
  WHERE id = p_customer_id;
  UPDATE public.data_subject_requests SET status = 'completed', completed_at = now(), handled_by_staff_id = actor_staff_id, resolution_note = 'Kontrollü anonimleştirme tamamlandı.' WHERE id = p_request_id;
  INSERT INTO public.activity_log (customer_id, action, performed_by, performed_by_staff_id, type)
  VALUES (p_customer_id, 'Müşteri kontrollü olarak anonimleştirildi — ' || actor_name, actor_name, actor_staff_id, 'privacy');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.record_customer_export_v1(p_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_staff_id UUID := public.current_staff_id(); actor_name TEXT; BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501'; END IF;
  SELECT full_name INTO actor_name FROM public.staff WHERE id = actor_staff_id AND is_active = true;
  INSERT INTO public.activity_log (customer_id, action, performed_by, performed_by_staff_id, type)
  VALUES (p_customer_id, 'KVKK müşteri veri dışa aktarımı oluşturuldu — ' || actor_name, actor_name, actor_staff_id, 'privacy');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.list_archived_customer_privacy_v1()
RETURNS TABLE (
  customer_id UUID,
  request_id UUID,
  request_status TEXT,
  anonymized_at TIMESTAMPTZ,
  storage_file_count BIGINT,
  grace_eligible BOOLEAN,
  retention_hold_active BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT
    customer.id,
    privacy_request.id,
    privacy_request.status,
    customer.anonymized_at,
    (
      SELECT count(*) FROM public.documents document
      JOIN public.applications application ON application.id = document.application_id
      WHERE application.customer_id = customer.id AND document.file_url IS NOT NULL
    ),
    customer.deleted_at <= now() - make_interval(days => settings.archive_grace_days),
    customer.retention_hold_until IS NOT NULL AND customer.retention_hold_until > now()
  FROM public.customers customer
  CROSS JOIN public.privacy_settings settings
  LEFT JOIN LATERAL (
    SELECT request.id, request.status
    FROM public.data_subject_requests request
    WHERE request.customer_id = customer.id
      AND request.request_type IN ('deletion', 'anonymization')
      AND request.status = 'approved'
    ORDER BY request.requested_at DESC
    LIMIT 1
  ) privacy_request ON true
  WHERE customer.is_deleted = true
    AND settings.id = '00000000-0000-0000-0000-000000000360';
END $$;

-- Kalici silme, ancak kontrollu anonimlestirme tamamlandiktan sonra mumkundur.
CREATE OR REPLACE FUNCTION public.list_archived_customers_v1()
RETURNS TABLE (id UUID, first_name TEXT, last_name TEXT, phone TEXT, email TEXT, assigned_staff_id UUID, deleted_at TIMESTAMPTZ, purge_eligible BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT c.id, c.first_name, c.last_name, c.phone, c.email, c.assigned_staff_id, c.deleted_at,
    (c.anonymized_at IS NOT NULL AND c.deleted_at <= now() - make_interval(days => settings.archive_grace_days))
  FROM public.customers c
  CROSS JOIN public.privacy_settings settings
  WHERE c.is_deleted = true
    AND settings.id = '00000000-0000-0000-0000-000000000360'
  ORDER BY c.deleted_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.purge_deleted_customers_v1(p_customer_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_staff_id UUID := public.current_staff_id(); actor_name TEXT; purged_count INTEGER := 0; grace_days INTEGER; BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501'; END IF;
  IF p_customer_ids IS NULL OR cardinality(p_customer_ids) = 0 THEN RAISE EXCEPTION 'customer_ids_required' USING ERRCODE = '22023'; END IF;
  SELECT full_name INTO actor_name FROM public.staff WHERE id = actor_staff_id AND is_active = true;
  SELECT archive_grace_days INTO grace_days FROM public.privacy_settings WHERE id = '00000000-0000-0000-0000-000000000360';
  WITH purged AS (
    DELETE FROM public.customers WHERE id = ANY(p_customer_ids) AND is_deleted = true AND anonymized_at IS NOT NULL AND deleted_at <= now() - make_interval(days => grace_days) RETURNING id
  )
  INSERT INTO public.activity_log (action, performed_by, performed_by_staff_id, type)
  SELECT 'Anonim müşteri kaydı kalıcı silindi — ' || actor_name, actor_name, actor_staff_id, 'privacy' FROM purged;
  GET DIAGNOSTICS purged_count = ROW_COUNT;
  RETURN purged_count;
END $$;

REVOKE ALL ON FUNCTION public.create_data_subject_request_v1(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_data_subject_request_status_v1(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_privacy_settings_v1(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_customer_retention_hold_v1(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_customer_documents_deleted_v1(UUID, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.anonymize_customer_v1(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_customer_export_v1(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_archived_customer_privacy_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_data_subject_request_v1(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_data_subject_request_status_v1(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_privacy_settings_v1(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_customer_retention_hold_v1(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_customer_documents_deleted_v1(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_customer_v1(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_customer_export_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_archived_customer_privacy_v1() TO authenticated;

COMMIT;
