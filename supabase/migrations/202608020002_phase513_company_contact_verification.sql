-- Faz 5.1.3: Tek şirket iletişim bilgisini yöneticiler aracılığıyla doğrulama.
-- Değerler doğrudan istemciden güncellenemez; kontrollü RPC güncel kaynak ve
-- doğrulayan personel bilgisini aynı işlemde kaydeder.

BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS contact_source_url TEXT,
  ADD COLUMN IF NOT EXISTS contact_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contact_verified_by_staff_id UUID
    CONSTRAINT tenants_contact_verified_by_staff_fk
    REFERENCES public.staff(id) ON DELETE SET NULL;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_contact_source_url_valid,
  ADD CONSTRAINT tenants_contact_source_url_valid
    CHECK (contact_source_url IS NULL OR contact_source_url ~ '^https://[^[:space:]]+$') NOT VALID;

ALTER TABLE public.tenants
  VALIDATE CONSTRAINT tenants_contact_source_url_valid;

-- Şirket verisinin yazımı yalnızca aşağıdaki kontrollü fonksiyonlar üzerinden
-- yapılır. Okuma, aktif personel için mevcut politika ile sürer.
DROP POLICY IF EXISTS "tenant_admin_all" ON public.tenants;
DROP POLICY IF EXISTS tenant_staff_read ON public.tenants;
CREATE POLICY tenant_staff_read ON public.tenants
  FOR SELECT TO authenticated
  USING (public.current_staff_id() IS NOT NULL);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.tenants FROM authenticated;

CREATE OR REPLACE FUNCTION public.verify_company_contact_v1(
  p_company_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_source_url TEXT
)
RETURNS TABLE (
  company_name TEXT,
  email TEXT,
  phone TEXT,
  contact_source_url TEXT,
  contact_verified_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT := 'Sistem';
  company_name_value TEXT := btrim(COALESCE(p_company_name, ''));
  email_value TEXT := lower(btrim(COALESCE(p_email, '')));
  phone_value TEXT := btrim(COALESCE(p_phone, ''));
  phone_digits TEXT;
  source_url_value TEXT := btrim(COALESCE(p_source_url, ''));
  tenant_record public.tenants%ROWTYPE;
BEGIN
  -- service_role yalnızca kontrollü, sunucu tarafı ilk veri aktarımı için
  -- kullanılabilir; normal kullanıcılar aktif bir yönetici olmalıdır.
  IF actor_staff_id IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  IF actor_staff_id IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  IF actor_staff_id IS NOT NULL THEN
    SELECT staff.full_name
    INTO actor_name
    FROM public.staff AS staff
    WHERE staff.id = actor_staff_id AND staff.is_active = true;

    IF actor_name IS NULL THEN
      RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF company_name_value = '' OR length(company_name_value) > 160 THEN
    RAISE EXCEPTION 'invalid_company_name' USING ERRCODE = '22023';
  END IF;

  IF email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR length(email_value) > 320 THEN
    RAISE EXCEPTION 'invalid_company_email' USING ERRCODE = '22023';
  END IF;

  phone_digits := regexp_replace(phone_value, '[^0-9]', '', 'g');
  IF length(phone_digits) < 10 OR length(phone_digits) > 15 THEN
    RAISE EXCEPTION 'invalid_company_phone' USING ERRCODE = '22023';
  END IF;

  IF source_url_value !~ '^https://[^[:space:]]+$' OR length(source_url_value) > 2048 THEN
    RAISE EXCEPTION 'invalid_contact_source_url' USING ERRCODE = '22023';
  END IF;

  SELECT tenant.*
  INTO tenant_record
  FROM public.tenants AS tenant
  FOR UPDATE;

  IF tenant_record.id IS NULL THEN
    RAISE EXCEPTION 'company_settings_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.tenants AS tenant
  SET company_name = company_name_value,
      email = email_value,
      phone = phone_value,
      contact_source_url = source_url_value,
      contact_verified_at = now(),
      contact_verified_by_staff_id = actor_staff_id
  WHERE tenant.id = tenant_record.id;

  INSERT INTO public.activity_log (
    action,
    performed_by,
    performed_by_staff_id,
    type
  ) VALUES (
    'Şirket iletişim bilgileri resmî kaynaktan doğrulandı — ' || actor_name,
    actor_name,
    actor_staff_id,
    'settings'
  );

  RETURN QUERY
  SELECT
    tenant.company_name,
    tenant.email,
    tenant.phone,
    tenant.contact_source_url,
    tenant.contact_verified_at
  FROM public.tenants AS tenant
  WHERE tenant.id = tenant_record.id;
END
$$;

CREATE OR REPLACE FUNCTION public.update_tenant_security_settings_v1(
  p_consultant_mfa_required BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
BEGIN
  IF actor_staff_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.tenants
  SET admin_mfa_required = true,
      consultant_mfa_required = p_consultant_mfa_required;

  RETURN FOUND;
END
$$;

REVOKE ALL ON FUNCTION public.verify_company_contact_v1(TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_tenant_security_settings_v1(BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_company_contact_v1(TEXT, TEXT, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_security_settings_v1(BOOLEAN)
  TO authenticated;

COMMIT;
