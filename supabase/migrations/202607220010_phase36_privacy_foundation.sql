-- Faz 3.6.1-3.6.2: surumlu aydinlatma, teslim/teyit ve acik riza karar kayitlari.

BEGIN;

CREATE TABLE public.privacy_notice_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT privacy_notice_version_not_blank CHECK (length(btrim(version)) BETWEEN 1 AND 50),
  CONSTRAINT privacy_notice_title_not_blank CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  CONSTRAINT privacy_notice_content_not_blank CHECK (length(btrim(content)) BETWEEN 1 AND 50000)
);

CREATE TABLE public.customer_privacy_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  notice_version_id UUID NOT NULL REFERENCES public.privacy_notice_versions(id) ON DELETE RESTRICT,
  delivery_method TEXT NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  evidence_note TEXT,
  recorded_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT privacy_notice_delivery_method_check
    CHECK (delivery_method IN ('yuz_yuze', 'email', 'whatsapp', 'portal', 'diger')),
  CONSTRAINT privacy_notice_evidence_note_length
    CHECK (evidence_note IS NULL OR length(evidence_note) <= 2000),
  CONSTRAINT privacy_notice_ack_after_delivery
    CHECK (acknowledged_at IS NULL OR acknowledged_at >= delivered_at)
);

CREATE TABLE public.customer_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  decision TEXT NOT NULL,
  decision_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,
  notice_version_id UUID REFERENCES public.privacy_notice_versions(id) ON DELETE RESTRICT,
  evidence_note TEXT,
  recorded_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_consent_type_check
    CHECK (consent_type IN ('marketing', 'cross_border_transfer', 'special_category_processing')),
  CONSTRAINT customer_consent_decision_check
    CHECK (decision IN ('granted', 'refused', 'withdrawn')),
  CONSTRAINT customer_consent_source_check
    CHECK (source IN ('yuz_yuze', 'email', 'whatsapp', 'portal', 'telefon', 'diger')),
  CONSTRAINT customer_consent_evidence_note_length
    CHECK (evidence_note IS NULL OR length(evidence_note) <= 2000)
);

CREATE INDEX idx_privacy_notice_active_effective
  ON public.privacy_notice_versions(is_active, effective_at DESC);
CREATE INDEX idx_customer_privacy_notices_customer
  ON public.customer_privacy_notices(customer_id, delivered_at DESC);
CREATE INDEX idx_customer_consents_latest
  ON public.customer_consents(customer_id, consent_type, decision_at DESC, created_at DESC);

CREATE TRIGGER privacy_notice_versions_set_updated_at
  BEFORE UPDATE ON public.privacy_notice_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.privacy_notice_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_privacy_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY privacy_notice_staff_read ON public.privacy_notice_versions
  FOR SELECT TO authenticated
  USING (public.current_staff_id() IS NOT NULL);

CREATE POLICY customer_privacy_notices_assigned_read ON public.customer_privacy_notices
  FOR SELECT TO authenticated
  USING (public.can_access_customer(customer_id));

CREATE POLICY customer_consents_assigned_read ON public.customer_consents
  FOR SELECT TO authenticated
  USING (public.can_access_customer(customer_id));

GRANT SELECT ON public.privacy_notice_versions TO authenticated;
GRANT SELECT ON public.customer_privacy_notices TO authenticated;
GRANT SELECT ON public.customer_consents TO authenticated;
GRANT ALL ON public.privacy_notice_versions TO service_role;
GRANT ALL ON public.customer_privacy_notices TO service_role;
GRANT ALL ON public.customer_consents TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.privacy_notice_versions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.customer_privacy_notices FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.customer_consents FROM authenticated;

CREATE OR REPLACE FUNCTION public.upsert_privacy_notice_v1(p_notice_id UUID, p_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  target_id UUID := COALESCE(p_notice_id, gen_random_uuid());
  normalized_version TEXT := btrim(COALESCE(p_payload->>'version', ''));
  normalized_title TEXT := btrim(COALESCE(p_payload->>'title', ''));
  normalized_content TEXT := btrim(COALESCE(p_payload->>'content', ''));
  effective_at_value TIMESTAMPTZ;
  active_value BOOLEAN := COALESCE((p_payload->>'is_active')::BOOLEAN, false);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF normalized_version = '' OR length(normalized_version) > 50 THEN
    RAISE EXCEPTION 'privacy_notice_version_invalid' USING ERRCODE = '22023';
  END IF;
  IF normalized_title = '' OR length(normalized_title) > 200 THEN
    RAISE EXCEPTION 'privacy_notice_title_invalid' USING ERRCODE = '22023';
  END IF;
  IF normalized_content = '' OR length(normalized_content) > 50000 THEN
    RAISE EXCEPTION 'privacy_notice_content_invalid' USING ERRCODE = '22023';
  END IF;

  BEGIN
    effective_at_value := COALESCE((p_payload->>'effective_at')::TIMESTAMPTZ, now());
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'privacy_notice_effective_at_invalid' USING ERRCODE = '22023';
  END;

  IF EXISTS (
    SELECT 1
    FROM public.privacy_notice_versions AS notice
    WHERE notice.id = target_id
      AND (
        notice.version IS DISTINCT FROM normalized_version
        OR notice.title IS DISTINCT FROM normalized_title
        OR notice.content IS DISTINCT FROM normalized_content
        OR notice.effective_at IS DISTINCT FROM effective_at_value
      )
      AND (
        EXISTS (SELECT 1 FROM public.customer_privacy_notices AS delivery WHERE delivery.notice_version_id = target_id)
        OR EXISTS (SELECT 1 FROM public.customer_consents AS consent WHERE consent.notice_version_id = target_id)
      )
  ) THEN
    RAISE EXCEPTION 'delivered_privacy_notice_immutable' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.privacy_notice_versions (
    id, version, title, content, effective_at, is_active, created_by_staff_id
  ) VALUES (
    target_id, normalized_version, normalized_title, normalized_content,
    effective_at_value, active_value, actor_staff_id
  )
  ON CONFLICT (id) DO UPDATE SET
    version = EXCLUDED.version,
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    effective_at = EXCLUDED.effective_at,
    is_active = EXCLUDED.is_active;

  INSERT INTO public.activity_log (action, performed_by, performed_by_staff_id, type)
  SELECT
    'KVKK aydınlatma metni kaydedildi: ' || normalized_version || ' — ' || staff.full_name,
    staff.full_name,
    actor_staff_id,
    'privacy'
  FROM public.staff AS staff
  WHERE staff.id = actor_staff_id;

  RETURN target_id;
END
$$;

CREATE OR REPLACE FUNCTION public.record_customer_privacy_notice_v1(p_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  target_customer_id UUID;
  target_notice_id UUID;
  delivery_method_value TEXT := COALESCE(p_payload->>'delivery_method', '');
  delivered_at_value TIMESTAMPTZ := now();
  acknowledged_at_value TIMESTAMPTZ;
  evidence_note_value TEXT := NULLIF(btrim(COALESCE(p_payload->>'evidence_note', '')), '');
  result_id UUID := gen_random_uuid();
  customer_name TEXT;
  notice_version TEXT;
  actor_name TEXT;
BEGIN
  BEGIN
    target_customer_id := (p_payload->>'customer_id')::UUID;
    target_notice_id := (p_payload->>'notice_version_id')::UUID;
    delivered_at_value := COALESCE((p_payload->>'delivered_at')::TIMESTAMPTZ, now());
    acknowledged_at_value := NULLIF(p_payload->>'acknowledged_at', '')::TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'privacy_notice_payload_invalid' USING ERRCODE = '22023';
  END;

  IF actor_staff_id IS NULL OR NOT public.can_access_customer(target_customer_id) THEN
    RAISE EXCEPTION 'customer_access_denied' USING ERRCODE = '42501';
  END IF;
  IF delivery_method_value NOT IN ('yuz_yuze', 'email', 'whatsapp', 'portal', 'diger') THEN
    RAISE EXCEPTION 'privacy_notice_delivery_method_invalid' USING ERRCODE = '22023';
  END IF;
  IF evidence_note_value IS NOT NULL AND length(evidence_note_value) > 2000 THEN
    RAISE EXCEPTION 'privacy_notice_evidence_too_long' USING ERRCODE = '22023';
  END IF;
  IF acknowledged_at_value IS NOT NULL AND acknowledged_at_value < delivered_at_value THEN
    RAISE EXCEPTION 'privacy_notice_ack_before_delivery' USING ERRCODE = '22023';
  END IF;

  SELECT customer.first_name || ' ' || customer.last_name
  INTO customer_name
  FROM public.customers AS customer
  WHERE customer.id = target_customer_id AND customer.is_deleted = false;

  SELECT notice.version INTO notice_version
  FROM public.privacy_notice_versions AS notice
  WHERE notice.id = target_notice_id AND notice.is_active = true AND notice.effective_at <= now();
  IF notice_version IS NULL THEN
    RAISE EXCEPTION 'active_privacy_notice_required' USING ERRCODE = '22023';
  END IF;

  SELECT staff.full_name INTO actor_name
  FROM public.staff AS staff WHERE staff.id = actor_staff_id AND staff.is_active = true;
  IF actor_name IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.customer_privacy_notices (
    id, customer_id, notice_version_id, delivery_method, delivered_at,
    acknowledged_at, evidence_note, recorded_by_staff_id
  ) VALUES (
    result_id, target_customer_id, target_notice_id, delivery_method_value,
    delivered_at_value, acknowledged_at_value, evidence_note_value, actor_staff_id
  );

  INSERT INTO public.activity_log (customer_id, action, performed_by, performed_by_staff_id, type)
  VALUES (
    target_customer_id,
    'KVKK aydınlatma kaydı: ' || notice_version || ' — ' || customer_name || ' — ' || actor_name,
    actor_name,
    actor_staff_id,
    'privacy'
  );
  RETURN result_id;
END
$$;

CREATE OR REPLACE FUNCTION public.record_customer_consent_v1(p_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  target_customer_id UUID;
  target_notice_id UUID;
  consent_type_value TEXT := COALESCE(p_payload->>'consent_type', '');
  decision_value TEXT := COALESCE(p_payload->>'decision', '');
  source_value TEXT := COALESCE(p_payload->>'source', '');
  decision_at_value TIMESTAMPTZ := now();
  evidence_note_value TEXT := NULLIF(btrim(COALESCE(p_payload->>'evidence_note', '')), '');
  result_id UUID := gen_random_uuid();
  actor_name TEXT;
  customer_name TEXT;
BEGIN
  BEGIN
    target_customer_id := (p_payload->>'customer_id')::UUID;
    target_notice_id := NULLIF(p_payload->>'notice_version_id', '')::UUID;
    decision_at_value := COALESCE((p_payload->>'decision_at')::TIMESTAMPTZ, now());
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'customer_consent_payload_invalid' USING ERRCODE = '22023';
  END;

  IF actor_staff_id IS NULL OR NOT public.can_access_customer(target_customer_id) THEN
    RAISE EXCEPTION 'customer_access_denied' USING ERRCODE = '42501';
  END IF;
  IF consent_type_value NOT IN ('marketing', 'cross_border_transfer', 'special_category_processing') THEN
    RAISE EXCEPTION 'customer_consent_type_invalid' USING ERRCODE = '22023';
  END IF;
  IF decision_value NOT IN ('granted', 'refused', 'withdrawn') THEN
    RAISE EXCEPTION 'customer_consent_decision_invalid' USING ERRCODE = '22023';
  END IF;
  IF source_value NOT IN ('yuz_yuze', 'email', 'whatsapp', 'portal', 'telefon', 'diger') THEN
    RAISE EXCEPTION 'customer_consent_source_invalid' USING ERRCODE = '22023';
  END IF;
  IF evidence_note_value IS NOT NULL AND length(evidence_note_value) > 2000 THEN
    RAISE EXCEPTION 'customer_consent_evidence_too_long' USING ERRCODE = '22023';
  END IF;
  IF target_notice_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.privacy_notice_versions AS notice WHERE notice.id = target_notice_id
  ) THEN
    RAISE EXCEPTION 'privacy_notice_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT staff.full_name INTO actor_name
  FROM public.staff AS staff WHERE staff.id = actor_staff_id AND staff.is_active = true;
  SELECT customer.first_name || ' ' || customer.last_name INTO customer_name
  FROM public.customers AS customer
  WHERE customer.id = target_customer_id AND customer.is_deleted = false;
  IF actor_name IS NULL OR customer_name IS NULL THEN
    RAISE EXCEPTION 'active_staff_and_customer_required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.customer_consents (
    id, customer_id, consent_type, decision, decision_at, source,
    notice_version_id, evidence_note, recorded_by_staff_id
  ) VALUES (
    result_id, target_customer_id, consent_type_value, decision_value,
    decision_at_value, source_value, target_notice_id, evidence_note_value, actor_staff_id
  );

  INSERT INTO public.activity_log (customer_id, action, performed_by, performed_by_staff_id, type)
  VALUES (
    target_customer_id,
    'KVKK rıza kararı: ' || consent_type_value || ' / ' || decision_value ||
      ' — ' || customer_name || ' — ' || actor_name,
    actor_name,
    actor_staff_id,
    'privacy'
  );
  RETURN result_id;
END
$$;

REVOKE ALL ON FUNCTION public.upsert_privacy_notice_v1(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_customer_privacy_notice_v1(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_customer_consent_v1(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_privacy_notice_v1(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_customer_privacy_notice_v1(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_customer_consent_v1(JSONB) TO authenticated;

COMMIT;
