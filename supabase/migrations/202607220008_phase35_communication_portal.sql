-- Faz 3.5: yönetilebilir mesaj şablonları, atomik iletişim kaydı ve
-- süreli/iptal edilebilir müşteri portalı bağlantıları.

BEGIN;

CREATE TABLE public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_key TEXT UNIQUE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  subject_template TEXT,
  body_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT message_templates_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT message_templates_body_not_blank CHECK (btrim(body_template) <> ''),
  CONSTRAINT message_templates_email_subject CHECK (
    channel <> 'email' OR (subject_template IS NOT NULL AND btrim(subject_template) <> '')
  )
);

CREATE INDEX idx_message_templates_channel_active
  ON public.message_templates(channel, is_active, name);

CREATE TRIGGER message_templates_set_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_templates_staff_read ON public.message_templates
  FOR SELECT TO authenticated
  USING (public.current_staff_id() IS NOT NULL);

REVOKE ALL ON TABLE public.message_templates FROM anon, authenticated;
GRANT SELECT ON TABLE public.message_templates TO authenticated;

INSERT INTO public.message_templates
  (system_key, name, channel, subject_template, body_template)
VALUES
  ('whatsapp_documents', 'Evrak Listesi', 'whatsapp', NULL,
   E'Merhaba {{first_name}} Bey/Hanım,\n\n{{country}} vize başvurunuz için gereken evraklar:\n\n{{document_list}}\n\nSaygılarımızla,\n{{company_name}}'),
  ('whatsapp_appointment', 'Randevu Hatırlatma', 'whatsapp', NULL,
   E'Merhaba {{first_name}} Bey/Hanım,\n\n{{country}} vize randevunuz {{appointment_date}} tarihinde, {{appointment_location}} konumundadır.\n\nLütfen randevu saatinden önce hazır olun.\n\n{{company_name}}'),
  ('whatsapp_approved', 'Başvuru Onaylandı', 'whatsapp', NULL,
   E'Merhaba {{first_name}} Bey/Hanım,\n\n{{country}} vize başvurunuz onaylandı. Sonraki adımlar için danışmanınız sizinle iletişime geçecektir.\n\n{{company_name}}'),
  ('whatsapp_rejected', 'Başvuru Sonucu', 'whatsapp', NULL,
   E'Merhaba {{first_name}} Bey/Hanım,\n\n{{country}} vize başvurunuz sonuçlandı. İtiraz ve sonraki adımlar için danışmanınızla iletişime geçebilirsiniz.\n\n{{company_name}}'),
  ('whatsapp_payment', 'Ödeme Hatırlatma', 'whatsapp', NULL,
   E'Merhaba {{first_name}} Bey/Hanım,\n\n{{country}} vize dosyanız için kalan ödeme tutarı {{remaining_fee}}.\n\nÖdeme bilgileri için bizimle iletişime geçebilirsiniz.\n\n{{company_name}}'),
  ('whatsapp_portal', 'Portal Bağlantısı', 'whatsapp', NULL,
   E'Merhaba {{first_name}} Bey/Hanım,\n\nVize başvurunuzu güvenli müşteri portalından takip edebilirsiniz:\n{{portal_url}}\n\n{{company_name}}'),
  ('email_documents', 'Evrak Listesi', 'email', '{{country}} Vize Başvurusu — Evrak Listesi',
   E'Merhaba {{first_name}} Bey/Hanım,\n\n{{country}} vize başvurunuz için gereken evraklar:\n\n{{document_list}}\n\nSaygılarımızla,\n{{company_name}}'),
  ('email_appointment', 'Randevu Hatırlatma', 'email', '{{country}} Vize Randevusu',
   E'Merhaba {{first_name}} Bey/Hanım,\n\nRandevunuz {{appointment_date}} tarihinde, {{appointment_location}} konumundadır.\n\nSaygılarımızla,\n{{company_name}}'),
  ('email_status', 'Başvuru Durumu', 'email', '{{country}} Vize Başvurusu Durum Güncellemesi',
   E'Merhaba {{first_name}} Bey/Hanım,\n\n{{country}} vize başvurunuzun güncel durumu: {{status}}.\n\nSaygılarımızla,\n{{company_name}}'),
  ('email_payment', 'Ödeme Hatırlatma', 'email', '{{country}} Vize Dosyası Ödeme Hatırlatması',
   E'Merhaba {{first_name}} Bey/Hanım,\n\nDosyanız için kalan ödeme tutarı {{remaining_fee}}.\n\nSaygılarımızla,\n{{company_name}}'),
  ('email_portal', 'Portal Bağlantısı', 'email', 'Vize Başvurusu Takip Bağlantınız',
   E'Merhaba {{first_name}} Bey/Hanım,\n\nBaşvurunuzu aşağıdaki güvenli bağlantıdan takip edebilirsiniz:\n{{portal_url}}\n\nSaygılarımızla,\n{{company_name}}')
ON CONFLICT (system_key) DO NOTHING;

ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'kaydedildi',
  ADD COLUMN IF NOT EXISTS recipient TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE public.communications
  ADD CONSTRAINT communications_status_check
  CHECK (status IN ('kaydedildi', 'hazirlandi', 'gonderildi', 'basarisiz'));

CREATE INDEX idx_communications_status_created
  ON public.communications(status, created_at DESC);

DROP POLICY IF EXISTS communications_assigned_all ON public.communications;
CREATE POLICY communications_assigned_read ON public.communications
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (customer_id IS NOT NULL AND public.can_access_customer(customer_id))
    OR (application_id IS NOT NULL AND public.can_access_application(application_id))
  );

REVOKE INSERT, UPDATE, DELETE ON TABLE public.communications FROM authenticated;

CREATE OR REPLACE FUNCTION public.upsert_message_template_v1(
  p_template_id UUID,
  p_payload JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  target_id UUID := COALESCE(p_template_id, gen_random_uuid());
  template_name TEXT := btrim(COALESCE(p_payload->>'name', ''));
  template_channel TEXT := p_payload->>'channel';
  template_subject TEXT := NULLIF(btrim(COALESCE(p_payload->>'subject_template', '')), '');
  template_body TEXT := btrim(COALESCE(p_payload->>'body_template', ''));
  template_active BOOLEAN := COALESCE((p_payload->>'is_active')::BOOLEAN, true);
BEGIN
  IF actor_staff_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF template_name = '' OR template_body = '' THEN
    RAISE EXCEPTION 'template_name_and_body_required' USING ERRCODE = '22023';
  END IF;
  IF template_channel NOT IN ('whatsapp', 'email') THEN
    RAISE EXCEPTION 'invalid_template_channel' USING ERRCODE = '22023';
  END IF;
  IF template_channel = 'email' AND template_subject IS NULL THEN
    RAISE EXCEPTION 'email_subject_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.message_templates (
    id, name, channel, subject_template, body_template, is_active, created_by_staff_id
  ) VALUES (
    target_id, template_name, template_channel, template_subject, template_body,
    template_active, actor_staff_id
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    channel = EXCLUDED.channel,
    subject_template = EXCLUDED.subject_template,
    body_template = EXCLUDED.body_template,
    is_active = EXCLUDED.is_active;

  INSERT INTO public.activity_log (action, performed_by, performed_by_staff_id, type)
  SELECT
    'Mesaj şablonu kaydedildi: ' || template_name,
    staff.full_name,
    actor_staff_id,
    'communication'
  FROM public.staff staff WHERE staff.id = actor_staff_id;

  RETURN target_id;
END
$$;

CREATE OR REPLACE FUNCTION public.record_communication_v1(p_payload JSONB)
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
  communication_type TEXT := p_payload->>'type';
  communication_direction TEXT := COALESCE(p_payload->>'direction', 'giden');
  communication_status TEXT := COALESCE(p_payload->>'status', 'kaydedildi');
  communication_subject TEXT := NULLIF(btrim(COALESCE(p_payload->>'subject', '')), '');
  communication_content TEXT := btrim(COALESCE(p_payload->>'content', ''));
  communication_recipient TEXT := NULLIF(btrim(COALESCE(p_payload->>'recipient', '')), '');
  communication_failure TEXT := NULLIF(btrim(COALESCE(p_payload->>'failure_reason', '')), '');
  created_id UUID;
BEGIN
  IF actor_staff_id IS NULL OR NOT public.can_access_customer(target_customer_id) THEN
    RAISE EXCEPTION 'customer_access_denied' USING ERRCODE = '42501';
  END IF;
  IF target_application_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.applications
    WHERE id = target_application_id AND customer_id = target_customer_id
  ) THEN
    RAISE EXCEPTION 'application_customer_mismatch' USING ERRCODE = '23503';
  END IF;
  IF communication_type NOT IN ('telefon', 'whatsapp', 'email', 'sms', 'yuz_yuze') THEN
    RAISE EXCEPTION 'invalid_communication_type' USING ERRCODE = '22023';
  END IF;
  IF communication_direction NOT IN ('giden', 'gelen') THEN
    RAISE EXCEPTION 'invalid_communication_direction' USING ERRCODE = '22023';
  END IF;
  IF communication_status NOT IN ('kaydedildi', 'hazirlandi', 'gonderildi', 'basarisiz') THEN
    RAISE EXCEPTION 'invalid_communication_status' USING ERRCODE = '22023';
  END IF;
  IF communication_content = '' THEN
    RAISE EXCEPTION 'communication_content_required' USING ERRCODE = '22023';
  END IF;
  IF communication_status = 'basarisiz' AND communication_failure IS NULL THEN
    RAISE EXCEPTION 'failure_reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT full_name INTO actor_name FROM public.staff WHERE id = actor_staff_id;

  INSERT INTO public.communications (
    customer_id, application_id, template_id, type, direction, subject, content,
    status, recipient, failure_reason, sent_at, performed_by, performed_by_staff_id
  ) VALUES (
    target_customer_id, target_application_id, target_template_id,
    communication_type, communication_direction, communication_subject,
    communication_content, communication_status, communication_recipient,
    communication_failure,
    CASE WHEN communication_status = 'gonderildi' THEN now() ELSE NULL END,
    actor_name, actor_staff_id
  ) RETURNING id INTO created_id;

  INSERT INTO public.activity_log (
    application_id, customer_id, action, performed_by, performed_by_staff_id, type
  ) VALUES (
    target_application_id, target_customer_id,
    'İletişim kaydı: ' || communication_type || ' (' || communication_status || ')',
    actor_name, actor_staff_id, 'communication'
  );

  RETURN created_id;
END
$$;

CREATE OR REPLACE FUNCTION public.set_communication_delivery_v1(
  p_communication_id UUID,
  p_status TEXT,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  communication public.communications%ROWTYPE;
  actor_name TEXT;
BEGIN
  SELECT * INTO communication
  FROM public.communications
  WHERE id = p_communication_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'communication_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF actor_staff_id IS NULL OR NOT public.can_access_customer(communication.customer_id) THEN
    RAISE EXCEPTION 'communication_access_denied' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('gonderildi', 'basarisiz') THEN
    RAISE EXCEPTION 'invalid_delivery_status' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'basarisiz' AND NULLIF(btrim(COALESCE(p_failure_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'failure_reason_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.communications SET
    status = p_status,
    failure_reason = CASE WHEN p_status = 'basarisiz' THEN btrim(p_failure_reason) ELSE NULL END,
    sent_at = CASE WHEN p_status = 'gonderildi' THEN now() ELSE NULL END
  WHERE id = p_communication_id;

  SELECT full_name INTO actor_name FROM public.staff WHERE id = actor_staff_id;
  INSERT INTO public.activity_log (
    application_id, customer_id, action, performed_by, performed_by_staff_id, type
  ) VALUES (
    communication.application_id, communication.customer_id,
    'İletişim durumu güncellendi: ' || p_status,
    actor_name, actor_staff_id, 'communication'
  );
END
$$;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS portal_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portal_access_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS portal_last_accessed_at TIMESTAMPTZ;

UPDATE public.customers
SET portal_token_expires_at = now() + INTERVAL '90 days'
WHERE portal_token IS NOT NULL AND portal_token_expires_at IS NULL;

ALTER TABLE public.customers
  ALTER COLUMN portal_token_expires_at SET DEFAULT (now() + INTERVAL '90 days');

CREATE OR REPLACE FUNCTION public.rotate_customer_portal_token_v1(
  p_customer_id UUID,
  p_valid_days INTEGER DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT;
  new_token TEXT := gen_random_uuid()::TEXT;
  expires_at TIMESTAMPTZ;
BEGIN
  IF actor_staff_id IS NULL OR NOT public.can_access_customer(p_customer_id) THEN
    RAISE EXCEPTION 'customer_access_denied' USING ERRCODE = '42501';
  END IF;
  IF p_valid_days < 1 OR p_valid_days > 365 THEN
    RAISE EXCEPTION 'portal_valid_days_out_of_range' USING ERRCODE = '22023';
  END IF;

  expires_at := now() + make_interval(days => p_valid_days);
  UPDATE public.customers SET
    portal_token = new_token,
    portal_token_expires_at = expires_at,
    portal_access_enabled = true,
    portal_last_accessed_at = NULL
  WHERE id = p_customer_id AND is_deleted = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT full_name INTO actor_name FROM public.staff WHERE id = actor_staff_id;
  INSERT INTO public.activity_log (customer_id, action, performed_by, performed_by_staff_id, type)
  VALUES (p_customer_id, 'Müşteri portal bağlantısı yenilendi', actor_name, actor_staff_id, 'portal');

  RETURN jsonb_build_object('token', new_token, 'expires_at', expires_at, 'enabled', true);
END
$$;

CREATE OR REPLACE FUNCTION public.set_customer_portal_access_v1(
  p_customer_id UUID,
  p_enabled BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT;
  result_customer public.customers%ROWTYPE;
BEGIN
  IF actor_staff_id IS NULL OR NOT public.can_access_customer(p_customer_id) THEN
    RAISE EXCEPTION 'customer_access_denied' USING ERRCODE = '42501';
  END IF;

  UPDATE public.customers SET
    portal_access_enabled = p_enabled,
    portal_token = CASE
      WHEN p_enabled AND portal_token IS NULL THEN gen_random_uuid()::TEXT
      ELSE portal_token
    END,
    portal_token_expires_at = CASE
      WHEN p_enabled AND (portal_token_expires_at IS NULL OR portal_token_expires_at <= now())
        THEN now() + INTERVAL '90 days'
      ELSE portal_token_expires_at
    END
  WHERE id = p_customer_id AND is_deleted = false
  RETURNING * INTO result_customer;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT full_name INTO actor_name FROM public.staff WHERE id = actor_staff_id;
  INSERT INTO public.activity_log (customer_id, action, performed_by, performed_by_staff_id, type)
  VALUES (
    p_customer_id,
    CASE WHEN p_enabled THEN 'Müşteri portal erişimi açıldı' ELSE 'Müşteri portal erişimi kapatıldı' END,
    actor_name, actor_staff_id, 'portal'
  );

  RETURN jsonb_build_object(
    'token', result_customer.portal_token,
    'expires_at', result_customer.portal_token_expires_at,
    'enabled', result_customer.portal_access_enabled
  );
END
$$;

REVOKE ALL ON FUNCTION public.upsert_message_template_v1(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_communication_v1(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_communication_delivery_v1(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rotate_customer_portal_token_v1(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_customer_portal_access_v1(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_message_template_v1(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_communication_v1(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_communication_delivery_v1(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_customer_portal_token_v1(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_customer_portal_access_v1(UUID, BOOLEAN) TO authenticated;

COMMIT;
