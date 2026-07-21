-- Faz 3.2: SaaS ayarlarini kaldirir ve CRM'i tek Nobel Vize sirket kaydina sabitler.

BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.tenants) > 1 THEN
    RAISE EXCEPTION 'single_company_preflight_failed:multiple_company_rows';
  END IF;
END
$$;

INSERT INTO public.tenants (company_name)
SELECT 'Nobel Vize'
WHERE NOT EXISTS (SELECT 1 FROM public.tenants);

UPDATE public.tenants
SET company_name = 'Nobel Vize'
WHERE company_name IS NULL OR btrim(company_name) = '';

ALTER TABLE public.tenants
  ALTER COLUMN company_name SET DEFAULT 'Nobel Vize',
  ALTER COLUMN company_name SET NOT NULL,
  DROP COLUMN IF EXISTS subdomain,
  DROP COLUMN IF EXISTS plan,
  DROP COLUMN IF EXISTS primary_color,
  DROP COLUMN IF EXISTS notify_email,
  DROP COLUMN IF EXISTS notify_whatsapp,
  DROP COLUMN IF EXISTS notify_reminder,
  DROP COLUMN IF EXISTS notify_status_change;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_company_name_not_blank
  CHECK (btrim(company_name) <> '') NOT VALID;

ALTER TABLE public.tenants
  VALIDATE CONSTRAINT tenants_company_name_not_blank;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_single_company_idx
  ON public.tenants ((1));

DROP POLICY IF EXISTS tenant_staff_read ON public.tenants;
CREATE POLICY tenant_staff_read ON public.tenants
  FOR SELECT TO authenticated
  USING (public.current_staff_id() IS NOT NULL);

COMMIT;
