-- Faz 4.5: saglayici secimine hazir, izin kontrollu outbox ve teslim audit temeli.
-- Gercek saglayici adaptoru bu migration ile etkinlestirilmez.

BEGIN;

CREATE TABLE public.communication_preferences (
  customer_id UUID NOT NULL
    CONSTRAINT communication_preferences_customer_fk REFERENCES public.customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  purpose TEXT NOT NULL DEFAULT 'transactional',
  evidence_note TEXT,
  recorded_by_staff_id UUID
    CONSTRAINT communication_preferences_staff_fk REFERENCES public.staff(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, channel, purpose),
  CONSTRAINT communication_preferences_channel_valid CHECK (channel IN ('email', 'whatsapp')),
  CONSTRAINT communication_preferences_purpose_valid CHECK (purpose IN ('transactional', 'marketing')),
  CONSTRAINT communication_preferences_evidence_length
    CHECK (evidence_note IS NULL OR length(evidence_note) <= 1000)
);

CREATE TABLE public.message_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL UNIQUE
    CONSTRAINT message_outbox_communication_fk REFERENCES public.communications(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL
    CONSTRAINT message_outbox_customer_fk REFERENCES public.customers(id) ON DELETE CASCADE,
  application_id UUID
    CONSTRAINT message_outbox_application_fk REFERENCES public.applications(id) ON DELETE SET NULL,
  template_id UUID
    CONSTRAINT message_outbox_template_fk REFERENCES public.message_templates(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'transactional',
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_name TEXT,
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  processing_started_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error_code TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_by_staff_id UUID
    CONSTRAINT message_outbox_created_by_staff_fk REFERENCES public.staff(id) ON DELETE SET NULL,
  CONSTRAINT message_outbox_channel_valid CHECK (channel IN ('email', 'whatsapp')),
  CONSTRAINT message_outbox_purpose_valid CHECK (purpose IN ('transactional', 'marketing')),
  CONSTRAINT message_outbox_status_valid
    CHECK (status IN ('queued', 'processing', 'accepted', 'delivered', 'retry', 'failed', 'cancelled')),
  CONSTRAINT message_outbox_idempotency_valid
    CHECK (idempotency_key ~ '^[A-Za-z0-9_.:/-]{8,180}$'),
  CONSTRAINT message_outbox_attempt_valid CHECK (attempt_count BETWEEN 0 AND 20),
  CONSTRAINT message_outbox_error_valid
    CHECK (last_error_code IS NULL OR last_error_code ~ '^[A-Za-z0-9_.:/-]{1,120}$')
);

CREATE INDEX message_outbox_pending_idx
  ON public.message_outbox(next_attempt_at, queued_at)
  WHERE status IN ('queued', 'retry');
CREATE INDEX message_outbox_customer_idx
  ON public.message_outbox(customer_id, queued_at DESC);

ALTER TABLE public.communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY communication_preferences_assigned_read
  ON public.communication_preferences FOR SELECT TO authenticated
  USING (public.can_access_customer(customer_id));
CREATE POLICY message_outbox_assigned_read
  ON public.message_outbox FOR SELECT TO authenticated
  USING (public.can_access_customer(customer_id));

REVOKE ALL ON TABLE public.communication_preferences, public.message_outbox FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.communication_preferences, public.message_outbox FROM authenticated;
GRANT SELECT ON TABLE public.communication_preferences, public.message_outbox TO authenticated;
GRANT ALL ON TABLE public.communication_preferences, public.message_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.set_communication_preference_v1(p_payload JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  target_customer_id UUID := (p_payload->>'customer_id')::UUID;
  channel_value TEXT := p_payload->>'channel';
  purpose_value TEXT := COALESCE(p_payload->>'purpose', 'transactional');
  allowed_value BOOLEAN := COALESCE((p_payload->>'allowed')::BOOLEAN, false);
  evidence_value TEXT := NULLIF(btrim(COALESCE(p_payload->>'evidence_note', '')), '');
BEGIN
  IF actor_staff_id IS NULL OR NOT public.can_access_customer(target_customer_id) THEN
    RAISE EXCEPTION 'customer_access_denied' USING ERRCODE = '42501';
  END IF;
  IF channel_value NOT IN ('email', 'whatsapp')
    OR purpose_value NOT IN ('transactional', 'marketing') THEN
    RAISE EXCEPTION 'invalid_communication_preference' USING ERRCODE = '22023';
  END IF;
  IF evidence_value IS NULL THEN
    RAISE EXCEPTION 'communication_preference_evidence_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.communication_preferences(
    customer_id, channel, allowed, purpose, evidence_note, recorded_by_staff_id, recorded_at
  ) VALUES (
    target_customer_id, channel_value, allowed_value, purpose_value,
    evidence_value, actor_staff_id, now()
  )
  ON CONFLICT (customer_id, channel, purpose) DO UPDATE
  SET allowed = EXCLUDED.allowed,
      evidence_note = EXCLUDED.evidence_note,
      recorded_by_staff_id = EXCLUDED.recorded_by_staff_id,
      recorded_at = now();

  RETURN true;
END
$$;

CREATE OR REPLACE FUNCTION public.enqueue_message_v1(p_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT;
  target_customer_id UUID := (p_payload->>'customer_id')::UUID;
  target_application_id UUID := NULLIF(p_payload->>'application_id', '')::UUID;
  target_template_id UUID := NULLIF(p_payload->>'template_id', '')::UUID;
  channel_value TEXT := p_payload->>'channel';
  purpose_value TEXT := COALESCE(p_payload->>'purpose', 'transactional');
  recipient_value TEXT := btrim(COALESCE(p_payload->>'recipient', ''));
  subject_value TEXT := NULLIF(btrim(COALESCE(p_payload->>'subject', '')), '');
  body_value TEXT := btrim(COALESCE(p_payload->>'body', ''));
  idempotency_value TEXT := btrim(COALESCE(p_payload->>'idempotency_key', ''));
  communication_id UUID;
  outbox_id UUID;
BEGIN
  IF actor_staff_id IS NULL OR NOT public.can_access_customer(target_customer_id) THEN
    RAISE EXCEPTION 'customer_access_denied' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.customers
  WHERE id = target_customer_id AND is_deleted = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002'; END IF;
  IF channel_value NOT IN ('email', 'whatsapp')
    OR purpose_value NOT IN ('transactional', 'marketing') THEN
    RAISE EXCEPTION 'invalid_message_channel_or_purpose' USING ERRCODE = '22023';
  END IF;
  IF recipient_value = '' OR body_value = ''
    OR idempotency_value !~ '^[A-Za-z0-9_.:/-]{8,180}$' THEN
    RAISE EXCEPTION 'invalid_message_payload' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.communication_preferences preference
    WHERE preference.customer_id = target_customer_id
      AND preference.channel = channel_value
      AND preference.purpose = purpose_value
      AND preference.allowed = true
  ) THEN
    RAISE EXCEPTION 'communication_permission_required' USING ERRCODE = '42501';
  END IF;
  IF purpose_value = 'marketing' AND NOT EXISTS (
    SELECT 1
    FROM public.customer_consents consent
    WHERE consent.customer_id = target_customer_id
      AND consent.consent_type = 'marketing'
      AND consent.decision = 'granted'
      AND consent.decision_at = (
        SELECT max(latest.decision_at)
        FROM public.customer_consents latest
        WHERE latest.customer_id = target_customer_id
          AND latest.consent_type = 'marketing'
      )
  ) THEN
    RAISE EXCEPTION 'marketing_consent_required' USING ERRCODE = '42501';
  END IF;
  IF target_application_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.applications
    WHERE id = target_application_id AND customer_id = target_customer_id
  ) THEN
    RAISE EXCEPTION 'application_customer_mismatch' USING ERRCODE = '23503';
  END IF;

  SELECT full_name INTO actor_name FROM public.staff WHERE id = actor_staff_id;
  INSERT INTO public.communications(
    customer_id, application_id, template_id, type, direction, subject, content,
    status, recipient, performed_by, performed_by_staff_id
  ) VALUES (
    target_customer_id, target_application_id, target_template_id, channel_value,
    'giden', subject_value, body_value, 'hazirlandi', recipient_value,
    actor_name, actor_staff_id
  ) RETURNING id INTO communication_id;

  INSERT INTO public.message_outbox(
    communication_id, customer_id, application_id, template_id, channel, purpose,
    recipient, subject, body, idempotency_key, created_by_staff_id
  ) VALUES (
    communication_id, target_customer_id, target_application_id, target_template_id,
    channel_value, purpose_value, recipient_value, subject_value, body_value,
    idempotency_value, actor_staff_id
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO outbox_id;

  IF outbox_id IS NULL THEN
    DELETE FROM public.communications WHERE id = communication_id;
    SELECT id INTO outbox_id FROM public.message_outbox WHERE idempotency_key = idempotency_value;
  END IF;
  RETURN outbox_id;
END
$$;

CREATE OR REPLACE FUNCTION public.apply_message_delivery_event_v1(
  p_outbox_id UUID,
  p_status TEXT,
  p_provider_message_id TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('accepted', 'delivered', 'failed') THEN
    RAISE EXCEPTION 'invalid_provider_delivery_status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.message_outbox AS outbox
  SET status = p_status,
      processing_started_at = NULL,
      provider_message_id = COALESCE(p_provider_message_id, outbox.provider_message_id),
      accepted_at = CASE WHEN p_status = 'accepted' THEN COALESCE(outbox.accepted_at, now()) ELSE outbox.accepted_at END,
      delivered_at = CASE WHEN p_status = 'delivered' THEN now() ELSE outbox.delivered_at END,
      failed_at = CASE WHEN p_status = 'failed' THEN now() ELSE outbox.failed_at END,
      last_error_code = CASE WHEN p_status = 'failed' THEN p_error_code ELSE NULL END
  WHERE outbox.id = p_outbox_id;
  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.communications AS communication
  SET status = CASE
        WHEN p_status = 'failed' THEN 'basarisiz'
        WHEN p_status = 'delivered' THEN 'gonderildi'
        ELSE 'hazirlandi'
      END,
      sent_at = CASE WHEN p_status = 'delivered' THEN COALESCE(communication.sent_at, now()) ELSE communication.sent_at END,
      failure_reason = CASE WHEN p_status = 'failed' THEN COALESCE(p_error_code, 'provider_failed') ELSE NULL END
  WHERE communication.id = (
    SELECT outbox.communication_id FROM public.message_outbox outbox WHERE outbox.id = p_outbox_id
  );
  RETURN affected = 1;
END
$$;

REVOKE ALL ON FUNCTION public.set_communication_preference_v1(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enqueue_message_v1(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_message_delivery_event_v1(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_communication_preference_v1(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_message_v1(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_message_delivery_event_v1(UUID, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
