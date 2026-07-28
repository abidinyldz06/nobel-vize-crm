-- Faz 4.7: yetki sinirli lead yasam dongusu, donusum, duplicate aciklamasi ve SLA.

BEGIN;

ALTER TABLE public.tasks
  DROP CONSTRAINT tasks_type_valid,
  DROP CONSTRAINT tasks_source_valid;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_type_valid CHECK (
    task_type IN ('manual', 'appointment', 'document', 'payment', 'inactivity', 'passport', 'lead')
  ),
  ADD CONSTRAINT tasks_source_valid CHECK (
    source_type IN ('manual', 'appointment', 'document', 'payment', 'inactivity', 'passport', 'lead')
  );

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  passport_no TEXT,
  source TEXT NOT NULL DEFAULT 'diger',
  campaign TEXT,
  referral TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  target_country TEXT,
  visa_type TEXT NOT NULL DEFAULT 'turistik',
  notes TEXT,
  assigned_staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  follow_up_due_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  converted_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  converted_application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  created_by_staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  phone_normalized TEXT GENERATED ALWAYS AS (
    NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), '')
  ) STORED,
  email_normalized TEXT GENERATED ALWAYS AS (
    NULLIF(lower(btrim(COALESCE(email, ''))), '')
  ) STORED,
  passport_normalized TEXT GENERATED ALWAYS AS (
    NULLIF(upper(regexp_replace(COALESCE(passport_no, ''), '\s+', '', 'g')), '')
  ) STORED,
  CONSTRAINT leads_name_length CHECK (
    length(btrim(first_name)) BETWEEN 1 AND 120 AND length(btrim(last_name)) BETWEEN 1 AND 120
  ),
  CONSTRAINT leads_source_valid CHECK (
    source IN ('web', 'telefon', 'whatsapp', 'referans', 'sosyal_medya', 'ofis', 'diger')
  ),
  CONSTRAINT leads_status_valid CHECK (
    status IN ('new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost')
  ),
  CONSTRAINT leads_visa_type_valid CHECK (
    visa_type IN ('turistik', 'is', 'ogrenci', 'aile_ziyareti', 'diger')
  ),
  CONSTRAINT leads_text_lengths CHECK (
    (campaign IS NULL OR length(campaign) <= 200)
    AND (referral IS NULL OR length(referral) <= 200)
    AND (target_country IS NULL OR length(target_country) <= 120)
    AND (notes IS NULL OR length(notes) <= 4000)
  ),
  CONSTRAINT leads_conversion_consistent CHECK (
    (status = 'converted'
      AND converted_customer_id IS NOT NULL
      AND converted_application_id IS NOT NULL
      AND converted_at IS NOT NULL)
    OR (status <> 'converted'
      AND converted_customer_id IS NULL
      AND converted_application_id IS NULL
      AND converted_at IS NULL)
  )
);
CREATE INDEX leads_assignee_status_idx ON public.leads(assigned_staff_id, status, follow_up_due_at);
CREATE INDEX leads_phone_normalized_idx ON public.leads(phone_normalized) WHERE phone_normalized IS NOT NULL;
CREATE INDEX leads_email_normalized_idx ON public.leads(email_normalized) WHERE email_normalized IS NOT NULL;
CREATE INDEX leads_passport_normalized_idx ON public.leads(passport_normalized) WHERE passport_normalized IS NOT NULL;
CREATE TRIGGER leads_set_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lead_events_type_valid CHECK (
    event_type IN ('created', 'status_changed', 'assigned', 'contacted', 'converted', 'note')
  ),
  CONSTRAINT lead_events_note_length CHECK (note IS NULL OR length(note) <= 1000)
);
CREATE INDEX lead_events_lead_created_idx ON public.lead_events(lead_id, created_at DESC);
CREATE TRIGGER lead_events_immutable
  BEFORE UPDATE OR DELETE ON public.lead_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privacy_audit_mutation_v1();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_authorized_read ON public.leads
  FOR SELECT TO authenticated
  USING (public.is_admin() OR assigned_staff_id = public.current_staff_id());
CREATE POLICY lead_events_authorized_read ON public.lead_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leads lead
    WHERE lead.id = lead_events.lead_id
      AND (public.is_admin() OR lead.assigned_staff_id = public.current_staff_id())
  ));
REVOKE ALL ON public.leads, public.lead_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.leads, public.lead_events TO authenticated;
GRANT ALL ON public.leads, public.lead_events TO service_role;

CREATE OR REPLACE FUNCTION public.create_lead_v1(p_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_role TEXT;
  assignee_id UUID;
  lead_id UUID;
BEGIN
  IF actor_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO actor_role FROM public.staff WHERE id = actor_staff_id AND is_active = true;
  assignee_id := CASE
    WHEN actor_role = 'admin' THEN COALESCE(NULLIF(p_payload->>'assigned_staff_id', '')::UUID, actor_staff_id)
    ELSE actor_staff_id
  END;
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = assignee_id AND is_active = true) THEN
    RAISE EXCEPTION 'active_assignee_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.leads (
    first_name, last_name, phone, email, passport_no, source, campaign, referral,
    target_country, visa_type, notes, assigned_staff_id, follow_up_due_at,
    created_by_staff_id
  ) VALUES (
    btrim(COALESCE(p_payload->>'first_name', '')),
    btrim(COALESCE(p_payload->>'last_name', '')),
    NULLIF(btrim(COALESCE(p_payload->>'phone', '')), ''),
    NULLIF(lower(btrim(COALESCE(p_payload->>'email', ''))), ''),
    NULLIF(upper(btrim(COALESCE(p_payload->>'passport_no', ''))), ''),
    COALESCE(NULLIF(p_payload->>'source', ''), 'diger'),
    NULLIF(btrim(COALESCE(p_payload->>'campaign', '')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'referral', '')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'target_country', '')), ''),
    COALESCE(NULLIF(p_payload->>'visa_type', ''), 'turistik'),
    NULLIF(btrim(COALESCE(p_payload->>'notes', '')), ''),
    assignee_id,
    NULLIF(p_payload->>'follow_up_due_at', '')::TIMESTAMPTZ,
    actor_staff_id
  ) RETURNING id INTO lead_id;
  INSERT INTO public.lead_events(lead_id, event_type, to_status, actor_staff_id, note)
  VALUES (lead_id, 'created', 'new', actor_staff_id, 'Lead kaydı oluşturuldu.');
  RETURN lead_id;
EXCEPTION WHEN check_violation OR invalid_text_representation THEN
  RAISE EXCEPTION 'lead_payload_invalid' USING ERRCODE = '22023';
END
$$;

CREATE OR REPLACE FUNCTION public.update_lead_v1(p_lead_id UUID, p_payload JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_role TEXT;
  current_lead public.leads%ROWTYPE;
  next_status TEXT;
  next_assignee UUID;
BEGIN
  SELECT role INTO actor_role FROM public.staff WHERE id = actor_staff_id AND is_active = true;
  SELECT * INTO current_lead FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF current_lead.id IS NULL OR (
    actor_role <> 'admin' AND current_lead.assigned_staff_id <> actor_staff_id
  ) THEN
    RAISE EXCEPTION 'lead_access_denied' USING ERRCODE = '42501';
  END IF;
  IF current_lead.status = 'converted' THEN
    RAISE EXCEPTION 'converted_lead_is_read_only' USING ERRCODE = '22023';
  END IF;
  next_status := COALESCE(NULLIF(p_payload->>'status', ''), current_lead.status);
  next_assignee := CASE
    WHEN actor_role = 'admin' THEN COALESCE(NULLIF(p_payload->>'assigned_staff_id', '')::UUID, current_lead.assigned_staff_id)
    ELSE current_lead.assigned_staff_id
  END;

  UPDATE public.leads SET
    status = next_status,
    assigned_staff_id = next_assignee,
    follow_up_due_at = CASE
      WHEN p_payload ? 'follow_up_due_at' THEN NULLIF(p_payload->>'follow_up_due_at', '')::TIMESTAMPTZ
      ELSE follow_up_due_at
    END,
    last_contacted_at = CASE
      WHEN next_status = 'contacted' AND current_lead.status <> 'contacted' THEN now()
      ELSE last_contacted_at
    END,
    notes = CASE
      WHEN p_payload ? 'notes' THEN NULLIF(btrim(COALESCE(p_payload->>'notes', '')), '')
      ELSE notes
    END
  WHERE id = p_lead_id;
  IF next_status <> current_lead.status THEN
    INSERT INTO public.lead_events(
      lead_id, event_type, from_status, to_status, actor_staff_id, note
    ) VALUES (
      p_lead_id,
      CASE WHEN next_status = 'contacted' THEN 'contacted' ELSE 'status_changed' END,
      current_lead.status, next_status, actor_staff_id,
      NULLIF(btrim(COALESCE(p_payload->>'event_note', '')), '')
    );
  END IF;
  IF next_assignee <> current_lead.assigned_staff_id THEN
    INSERT INTO public.lead_events(lead_id, event_type, actor_staff_id, note)
    VALUES (p_lead_id, 'assigned', actor_staff_id, 'Lead sorumlusu değiştirildi.');
  END IF;
  RETURN true;
END
$$;

CREATE OR REPLACE FUNCTION public.find_lead_duplicates_v1(p_lead_id UUID)
RETURNS TABLE(entity_type TEXT, entity_id UUID, match_reason TEXT, display_name TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  source public.leads%ROWTYPE;
BEGIN
  SELECT * INTO source FROM public.leads WHERE id = p_lead_id;
  IF source.id IS NULL OR (
    NOT public.is_admin() AND source.assigned_staff_id <> actor_staff_id
  ) THEN
    RAISE EXCEPTION 'lead_access_denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT 'customer', customer.id,
    concat_ws(', ',
      CASE WHEN source.phone_normalized IS NOT NULL
        AND regexp_replace(COALESCE(customer.phone, ''), '[^0-9]', '', 'g') = source.phone_normalized
        THEN 'telefon' END,
      CASE WHEN source.email_normalized IS NOT NULL
        AND lower(btrim(COALESCE(customer.email, ''))) = source.email_normalized
        THEN 'e-posta' END,
      CASE WHEN source.passport_normalized IS NOT NULL
        AND upper(regexp_replace(COALESCE(customer.passport_no, ''), '\s+', '', 'g')) = source.passport_normalized
        THEN 'pasaport' END
    ),
    customer.first_name || ' ' || customer.last_name
  FROM public.customers customer
  WHERE customer.is_deleted = false
    AND public.can_access_customer(customer.id)
    AND (
      (source.phone_normalized IS NOT NULL
        AND regexp_replace(COALESCE(customer.phone, ''), '[^0-9]', '', 'g') = source.phone_normalized)
      OR (source.email_normalized IS NOT NULL
        AND lower(btrim(COALESCE(customer.email, ''))) = source.email_normalized)
      OR (source.passport_normalized IS NOT NULL
        AND upper(regexp_replace(COALESCE(customer.passport_no, ''), '\s+', '', 'g')) = source.passport_normalized)
    )
  UNION ALL
  SELECT 'lead', lead.id,
    concat_ws(', ',
      CASE WHEN source.phone_normalized IS NOT NULL AND lead.phone_normalized = source.phone_normalized THEN 'telefon' END,
      CASE WHEN source.email_normalized IS NOT NULL AND lead.email_normalized = source.email_normalized THEN 'e-posta' END,
      CASE WHEN source.passport_normalized IS NOT NULL AND lead.passport_normalized = source.passport_normalized THEN 'pasaport' END
    ),
    lead.first_name || ' ' || lead.last_name
  FROM public.leads lead
  WHERE lead.id <> source.id
    AND (public.is_admin() OR lead.assigned_staff_id = actor_staff_id)
    AND (
      (source.phone_normalized IS NOT NULL AND lead.phone_normalized = source.phone_normalized)
      OR (source.email_normalized IS NOT NULL AND lead.email_normalized = source.email_normalized)
      OR (source.passport_normalized IS NOT NULL AND lead.passport_normalized = source.passport_normalized)
    );
END
$$;

CREATE OR REPLACE FUNCTION public.convert_lead_v1(p_lead_id UUID, p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  source public.leads%ROWTYPE;
  existing_customer_id UUID := NULLIF(p_payload->>'existing_customer_id', '')::UUID;
  workflow_result JSONB;
  target_customer_id UUID;
  target_application_id UUID;
BEGIN
  SELECT * INTO source FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF source.id IS NULL OR source.status = 'converted'
    OR (NOT public.is_admin() AND source.assigned_staff_id <> actor_staff_id) THEN
    RAISE EXCEPTION 'lead_conversion_denied' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.find_lead_duplicates_v1(p_lead_id))
    AND existing_customer_id IS NULL
    AND COALESCE((p_payload->>'confirm_new_customer')::BOOLEAN, false) = false THEN
    RAISE EXCEPTION 'lead_duplicate_confirmation_required' USING ERRCODE = '23505';
  END IF;
  IF existing_customer_id IS NOT NULL AND NOT public.can_access_customer(existing_customer_id) THEN
    RAISE EXCEPTION 'existing_customer_access_denied' USING ERRCODE = '42501';
  END IF;

  workflow_result := public.create_customer_application_v1(
    jsonb_build_object(
      'customer_id', existing_customer_id,
      'first_name', source.first_name,
      'last_name', source.last_name,
      'phone', source.phone,
      'email', source.email,
      'passport_no', source.passport_no,
      'assigned_staff_id', source.assigned_staff_id,
      'country_id', NULLIF(p_payload->>'country_id', ''),
      'country_name', COALESCE(NULLIF(p_payload->>'country_name', ''), source.target_country),
      'visa_type', COALESCE(NULLIF(p_payload->>'visa_type', ''), source.visa_type),
      'travel_method', NULLIF(p_payload->>'travel_method', ''),
      'accommodation', NULLIF(p_payload->>'accommodation', ''),
      'occupation', NULLIF(p_payload->>'occupation', ''),
      'with_children', NULLIF(p_payload->>'with_children', ''),
      'nationality', NULLIF(p_payload->>'nationality', ''),
      'allow_duplicate_customer', COALESCE((p_payload->>'confirm_new_customer')::BOOLEAN, false),
      'customer_notes', source.notes,
      'consultant_note', source.notes
    )
  );
  target_customer_id := NULLIF(workflow_result->>'customer_id', '')::UUID;
  target_application_id := NULLIF(workflow_result->>'application_id', '')::UUID;
  IF target_customer_id IS NULL OR target_application_id IS NULL THEN
    RAISE EXCEPTION 'lead_conversion_workflow_failed';
  END IF;

  UPDATE public.leads SET
    status = 'converted',
    converted_customer_id = target_customer_id,
    converted_application_id = target_application_id,
    converted_at = now(),
    follow_up_due_at = NULL
  WHERE id = p_lead_id;
  INSERT INTO public.lead_events(
    lead_id, event_type, from_status, to_status, actor_staff_id, note
  ) VALUES (
    p_lead_id, 'converted', source.status, 'converted', actor_staff_id,
    'Lead müşteri ve başvuru kaydına dönüştürüldü.'
  );
  RETURN jsonb_build_object(
    'customer_id', target_customer_id,
    'application_id', target_application_id
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sync_lead_followup_tasks_v1()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE inserted_count INTEGER;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.tasks(
    title, description, task_type, source_type, source_id, priority, due_at,
    assigned_staff_id, idempotency_key
  )
  SELECT
    'Geciken lead takibi: ' || lead.first_name || ' ' || lead.last_name,
    concat_ws(' · ', lead.source, lead.campaign, lead.target_country),
    'lead', 'lead', lead.id,
    CASE WHEN lead.follow_up_due_at <= now() - interval '24 hours' THEN 'urgent' ELSE 'high' END,
    lead.follow_up_due_at, lead.assigned_staff_id,
    'lead:' || lead.id::TEXT || ':follow-up:' || extract(epoch FROM lead.follow_up_due_at)::BIGINT::TEXT
  FROM public.leads lead
  WHERE lead.status NOT IN ('converted', 'unqualified', 'lost')
    AND lead.follow_up_due_at IS NOT NULL
    AND lead.follow_up_due_at <= now()
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END
$$;

REVOKE ALL ON FUNCTION public.create_lead_v1(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_lead_v1(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_lead_duplicates_v1(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.convert_lead_v1(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_lead_followup_tasks_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_lead_v1(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_lead_v1(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_lead_duplicates_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_lead_v1(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_lead_followup_tasks_v1() TO service_role;

COMMIT;
