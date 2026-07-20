-- Faz 1: mevcut kurulumlari tek veri modeline yaklastirir, yeni yazimlari
-- constraint ve foreign key'lerle korur, eski veriyi silmez.

BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS subdomain TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS plan TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT,
  ADD COLUMN IF NOT EXISTS notify_email BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_whatsapp BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_reminder BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_status_change BOOLEAN DEFAULT true;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'consultant',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS profile_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passport_no TEXT,
  ADD COLUMN IF NOT EXISTS passport_expiry DATE,
  ADD COLUMN IF NOT EXISTS passport_issuing_country TEXT DEFAULT 'Türkiye',
  ADD COLUMN IF NOT EXISTS financial_status TEXT DEFAULT 'orta',
  ADD COLUMN IF NOT EXISTS monthly_income NUMERIC,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS assigned_staff_id UUID,
  ADD COLUMN IF NOT EXISTS portal_token TEXT DEFAULT gen_random_uuid()::TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.countries
  ADD COLUMN IF NOT EXISTS visa_system TEXT,
  ADD COLUMN IF NOT EXISTS appointment_system TEXT,
  ADD COLUMN IF NOT EXISTS base_fee_visa NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_fee_service NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.country_visa_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  visa_category TEXT NOT NULL DEFAULT 'turistik',
  travel_method TEXT,
  accommodation TEXT,
  occupation TEXT,
  with_children BOOLEAN,
  nationality TEXT,
  documents JSONB NOT NULL DEFAULT '[]'::JSONB,
  processing_time TEXT,
  validity TEXT,
  max_stay TEXT,
  multiple_entry BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.country_visa_rules
  ADD COLUMN IF NOT EXISTS visa_category TEXT DEFAULT 'turistik',
  ADD COLUMN IF NOT EXISTS travel_method TEXT,
  ADD COLUMN IF NOT EXISTS accommodation TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS with_children BOOLEAN,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS processing_time TEXT,
  ADD COLUMN IF NOT EXISTS validity TEXT,
  ADD COLUMN IF NOT EXISTS max_stay TEXT,
  ADD COLUMN IF NOT EXISTS multiple_entry BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS visa_type TEXT DEFAULT 'turistik',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'profil_analizi',
  ADD COLUMN IF NOT EXISTS total_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consulate_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS appointment_location TEXT,
  ADD COLUMN IF NOT EXISTS assigned_staff_id UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'diger',
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'bekleniyor',
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS author TEXT DEFAULT 'Danışman';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS method TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'upfront',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TRY',
  ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'giden',
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT;

-- activity_log.performed_by eski kurulumlarda UUID, bazi kurulumlarda TEXT idi.
-- Kanonik model: goruntuleme etiketi TEXT + kimlik icin ayri foreign key.
DO $$
DECLARE
  actor_type TEXT;
BEGIN
  SELECT c.udt_name
  INTO actor_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'activity_log'
    AND c.column_name = 'performed_by';

  IF actor_type = 'uuid' THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activity_log'
        AND column_name = 'performed_by_staff_id'
    ) THEN
      ALTER TABLE public.activity_log RENAME COLUMN performed_by TO performed_by_staff_id;
    ELSE
      ALTER TABLE public.activity_log RENAME COLUMN performed_by TO performed_by_legacy_uuid;
    END IF;
  END IF;
END
$$;

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS performed_by TEXT DEFAULT 'Sistem',
  ADD COLUMN IF NOT EXISTS performed_by_staff_id UUID;

DO $$
DECLARE
  actor_type TEXT;
BEGIN
  SELECT c.udt_name
  INTO actor_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'communications'
    AND c.column_name = 'performed_by';

  IF actor_type = 'uuid' THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'communications'
        AND column_name = 'performed_by_staff_id'
    ) THEN
      ALTER TABLE public.communications RENAME COLUMN performed_by TO performed_by_staff_id;
    ELSE
      ALTER TABLE public.communications RENAME COLUMN performed_by TO performed_by_legacy_uuid;
    END IF;
  END IF;
END
$$;

ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS performed_by TEXT,
  ADD COLUMN IF NOT EXISTS performed_by_staff_id UUID;

UPDATE public.activity_log AS log
SET performed_by_staff_id = staff.id
FROM public.staff AS staff
WHERE log.performed_by_staff_id IS NULL
  AND (
    lower(trim(log.performed_by)) = lower(trim(staff.email))
    OR lower(trim(log.performed_by)) = lower(trim(staff.full_name))
  );

UPDATE public.activity_log AS log
SET performed_by = COALESCE(staff.full_name, staff.email, 'Sistem')
FROM public.staff AS staff
WHERE log.performed_by_staff_id = staff.id
  AND (log.performed_by IS NULL OR trim(log.performed_by) = '');

UPDATE public.activity_log
SET performed_by = 'Sistem'
WHERE performed_by IS NULL OR trim(performed_by) = '';

ALTER TABLE public.activity_log
  ALTER COLUMN performed_by SET DEFAULT 'Sistem',
  ALTER COLUMN performed_by SET NOT NULL;

-- Eski requirements verisini kanonik rules tablosuna tasir. Veri silinmez;
-- eski tablo salt-okunur legacy tabloya, eski ad ise uyumluluk view'ina doner.

DO $$
DECLARE
  requirement_kind "char";
BEGIN
  SELECT c.relkind
  INTO requirement_kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'country_visa_requirements';

  IF requirement_kind IN ('r', 'p') THEN
    EXECUTE $migration$
      INSERT INTO public.country_visa_rules (
        country_id,
        visa_category,
        documents,
        processing_time,
        validity,
        max_stay,
        multiple_entry,
        notes,
        created_at
      )
      SELECT
        legacy.country_id,
        CASE WHEN legacy.visa_type = 'turist' THEN 'turistik' ELSE legacy.visa_type END,
        CASE WHEN jsonb_typeof(legacy.documents::JSONB) = 'array' THEN legacy.documents::JSONB ELSE '[]'::JSONB END,
        legacy.processing_time,
        legacy.validity,
        legacy.max_stay,
        COALESCE(legacy.multiple_entry, true),
        legacy.notes,
        COALESCE(legacy.created_at, now())
      FROM public.country_visa_requirements AS legacy
      WHERE legacy.country_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.country_visa_rules AS rule
          WHERE rule.country_id = legacy.country_id
            AND rule.visa_category = CASE
              WHEN legacy.visa_type = 'turist' THEN 'turistik'
              ELSE legacy.visa_type
            END
            AND rule.travel_method IS NULL
            AND rule.accommodation IS NULL
            AND rule.occupation IS NULL
            AND rule.with_children IS NULL
            AND rule.nationality IS NULL
        )
      ON CONFLICT DO NOTHING
    $migration$;

    IF to_regclass('public.country_visa_requirements_legacy') IS NULL THEN
      ALTER TABLE public.country_visa_requirements
        RENAME TO country_visa_requirements_legacy;
      REVOKE ALL ON public.country_visa_requirements_legacy FROM anon, authenticated;
    END IF;
  END IF;
END
$$;

-- PostgreSQL unique constraint'leri NOT VALID eklenemez. Mevcut tekrarlar
-- varsa migration guvenle devam eder; preflight temizliginden sonra runbook'taki
-- indeks komutlari uygulanir. Temiz kurulumda indeksler hemen olusur.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.country_visa_rules
    GROUP BY
      country_id,
      visa_category,
      COALESCE(travel_method, '*'),
      COALESCE(accommodation, '*'),
      COALESCE(occupation, '*'),
      COALESCE(with_children::TEXT, '*'),
      COALESCE(nationality, '*')
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_country_visa_rules_match
    ON public.country_visa_rules (
      country_id,
      visa_category,
      COALESCE(travel_method, '*'),
      COALESCE(accommodation, '*'),
      COALESCE(occupation, '*'),
      COALESCE(with_children::TEXT, '*'),
      COALESCE(nationality, '*')
    );
  ELSE
    RAISE WARNING 'uq_country_visa_rules_match not created: duplicate rules must be resolved';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.staff
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_user_id
      ON public.staff(user_id) WHERE user_id IS NOT NULL;
  ELSE
    RAISE WARNING 'uq_staff_user_id not created: duplicate staff user ids must be resolved';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.country_visa_requirements') IS NULL THEN
    EXECUTE $view$
      CREATE VIEW public.country_visa_requirements
      WITH (security_invoker = true)
      AS
      SELECT
        id,
        country_id,
        visa_category AS visa_type,
        documents,
        processing_time,
        validity,
        max_stay,
        multiple_entry,
        notes,
        created_at
      FROM public.country_visa_rules
    $view$;
    REVOKE ALL ON public.country_visa_requirements FROM anon;
    GRANT SELECT ON public.country_visa_requirements TO authenticated;
  END IF;
END
$$;

UPDATE public.applications SET visa_type = 'turistik' WHERE visa_type = 'turist';
UPDATE public.applications SET visa_type = 'ogrenci' WHERE visa_type IN ('Öğrenci', 'öğrenci');
UPDATE public.documents SET status = 'onaylandi' WHERE status = 'tamamlandi';
UPDATE public.country_visa_rules SET visa_category = 'turistik' WHERE visa_category = 'turist';
UPDATE public.country_visa_rules SET documents = '[]'::JSONB WHERE documents IS NULL;

-- Yeni kayitlari koruyan, eski uyumsuz satirlari staging envanterine birakan
-- NOT VALID constraint'ler. Runbook'ta envanter sonrasi VALIDATE edilir.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_role_valid') THEN
    ALTER TABLE public.staff ADD CONSTRAINT staff_role_valid
      CHECK (role IN ('admin', 'consultant')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_profile_score_valid') THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_profile_score_valid
      CHECK (profile_score BETWEEN 0 AND 100) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_customer_required') THEN
    ALTER TABLE public.applications ADD CONSTRAINT applications_customer_required
      CHECK (customer_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_status_valid') THEN
    ALTER TABLE public.applications ADD CONSTRAINT applications_status_valid
      CHECK (status IN (
        'profil_analizi', 'evrak_bekleniyor', 'randevu_bekleniyor',
        'randevu_alindi', 'evrak_hazirlaniyor', 'basvuru_yapildi',
        'onaylandi', 'reddedildi', 'itiraz', 'kapandi'
      )) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_visa_type_valid') THEN
    ALTER TABLE public.applications ADD CONSTRAINT applications_visa_type_valid
      CHECK (visa_type IN (
        'turistik', 'aile_ziyareti', 'aile_birlesimi', 'is', 'ogrenci',
        'transit', 'tedavi', 'arastirma', 'kulturel_spor', 'calisma'
      )) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_fees_nonnegative') THEN
    ALTER TABLE public.applications ADD CONSTRAINT applications_fees_nonnegative
      CHECK (
        COALESCE(total_fee, 0) >= 0
        AND COALESCE(consulate_fee, 0) >= 0
        AND COALESCE(service_fee, 0) >= 0
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_application_required') THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_application_required
      CHECK (application_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_status_valid') THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_status_valid
      CHECK (status IN ('bekleniyor', 'yuklendi', 'onaylandi', 'eksik', 'reddedildi')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_amount_nonnegative') THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_amount_nonnegative
      CHECK (amount >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'country_visa_rules_documents_array') THEN
    ALTER TABLE public.country_visa_rules ADD CONSTRAINT country_visa_rules_documents_array
      CHECK (jsonb_typeof(documents) = 'array') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_events_status_valid') THEN
    ALTER TABLE public.webhook_events ADD CONSTRAINT webhook_events_status_valid
      CHECK (status IN ('processing', 'processed', 'rejected', 'failed')) NOT VALID;
  END IF;
END
$$;

-- Eksik foreign key'ler veri silmeden eklenir; yeni satirlarda hemen uygulanir.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_user_fk') THEN
    ALTER TABLE public.staff ADD CONSTRAINT staff_user_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_assigned_staff_fk') THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_assigned_staff_fk
      FOREIGN KEY (assigned_staff_id) REFERENCES public.staff(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_customer_fk') THEN
    ALTER TABLE public.applications ADD CONSTRAINT applications_customer_fk
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_assigned_staff_fk') THEN
    ALTER TABLE public.applications ADD CONSTRAINT applications_assigned_staff_fk
      FOREIGN KEY (assigned_staff_id) REFERENCES public.staff(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rules_country_fk') THEN
    ALTER TABLE public.country_visa_rules ADD CONSTRAINT rules_country_fk
      FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_application_fk') THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_application_fk
      FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notes_application_fk') THEN
    ALTER TABLE public.notes ADD CONSTRAINT notes_application_fk
      FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notes_created_by_fk') THEN
    ALTER TABLE public.notes ADD CONSTRAINT notes_created_by_fk
      FOREIGN KEY (created_by) REFERENCES public.staff(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_application_fk') THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_application_fk
      FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_log_application_fk') THEN
    ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_application_fk
      FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_log_customer_fk') THEN
    ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_customer_fk
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_log_actor_fk') THEN
    ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_actor_fk
      FOREIGN KEY (performed_by_staff_id) REFERENCES public.staff(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'communications_customer_fk') THEN
    ALTER TABLE public.communications ADD CONSTRAINT communications_customer_fk
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'communications_application_fk') THEN
    ALTER TABLE public.communications ADD CONSTRAINT communications_application_fk
      FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'communications_actor_fk') THEN
    ALTER TABLE public.communications ADD CONSTRAINT communications_actor_fk
      FOREIGN KEY (performed_by_staff_id) REFERENCES public.staff(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visa_history_customer_fk') THEN
    ALTER TABLE public.visa_history ADD CONSTRAINT visa_history_customer_fk
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_members_customer_fk') THEN
    ALTER TABLE public.family_members ADD CONSTRAINT family_members_customer_fk
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_active_role ON public.staff(is_active, role);
CREATE INDEX IF NOT EXISTS idx_customers_assigned_staff ON public.customers(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON public.customers(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_portal_token ON public.customers(portal_token) WHERE portal_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_countries_name_lower ON public.countries(lower(name));
CREATE INDEX IF NOT EXISTS idx_rules_country_category ON public.country_visa_rules(country_id, visa_category);
CREATE INDEX IF NOT EXISTS idx_applications_customer_created ON public.applications(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_staff_status ON public.applications(assigned_staff_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_appointment ON public.applications(appointment_date) WHERE appointment_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_application_status ON public.documents(application_id, status);
CREATE INDEX IF NOT EXISTS idx_notes_application_created ON public.notes(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_application_created ON public.payments(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_application_created ON public.activity_log(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_customer_created ON public.activity_log(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_unread ON public.activity_log(is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_communications_customer_created ON public.communications(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visa_history_customer ON public.visa_history(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_members_customer ON public.family_members(customer_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS customers_set_updated_at ON public.customers;
CREATE TRIGGER customers_set_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS countries_set_updated_at ON public.countries;
CREATE TRIGGER countries_set_updated_at
BEFORE UPDATE ON public.countries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS country_visa_rules_set_updated_at ON public.country_visa_rules;
CREATE TRIGGER country_visa_rules_set_updated_at
BEFORE UPDATE ON public.country_visa_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS applications_set_updated_at ON public.applications;
CREATE TRIGGER applications_set_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS documents_set_updated_at ON public.documents;
CREATE TRIGGER documents_set_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_activity_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID;
  actor_name TEXT;
BEGIN
  IF current_setting('app.restore_mode', true) = 'on' THEN
    RETURN NEW;
  END IF;
  actor_id := COALESCE(NEW.performed_by_staff_id, public.current_staff_id());
  IF actor_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(full_name, ''), email)
    INTO actor_name
    FROM public.staff
    WHERE id = actor_id;
    NEW.performed_by_staff_id := actor_id;
    IF NEW.performed_by IS NULL OR trim(NEW.performed_by) = '' OR NEW.performed_by = 'Sistem' THEN
      NEW.performed_by := COALESCE(actor_name, 'Sistem');
    END IF;
  END IF;
  NEW.performed_by := COALESCE(NULLIF(trim(NEW.performed_by), ''), 'Sistem');
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS activity_log_set_actor ON public.activity_log;
CREATE TRIGGER activity_log_set_actor
BEFORE INSERT OR UPDATE OF performed_by, performed_by_staff_id ON public.activity_log
FOR EACH ROW EXECUTE FUNCTION public.set_activity_actor();

-- Baseline ile sifirdan kurulan projelerde tablo yetkileri acikca verilir.
-- RLS satir kapsamlarini sinirlar; anon rolu is tablolari icin yetkisizdir.
REVOKE ALL ON TABLE
  public.tenants,
  public.staff,
  public.customers,
  public.countries,
  public.country_visa_rules,
  public.applications,
  public.documents,
  public.notes,
  public.payments,
  public.activity_log,
  public.communications,
  public.visa_history,
  public.family_members,
  public.webhook_events
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.tenants,
  public.staff,
  public.customers,
  public.countries,
  public.country_visa_rules,
  public.applications,
  public.documents,
  public.notes,
  public.payments,
  public.activity_log,
  public.communications,
  public.visa_history,
  public.family_members
TO authenticated;

REVOKE ALL ON TABLE public.webhook_events FROM authenticated;
GRANT ALL ON TABLE
  public.tenants,
  public.staff,
  public.customers,
  public.countries,
  public.country_visa_rules,
  public.applications,
  public.documents,
  public.notes,
  public.payments,
  public.activity_log,
  public.communications,
  public.visa_history,
  public.family_members,
  public.webhook_events
TO service_role;

ALTER TABLE public.country_visa_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country_visa_rules_authenticated_read" ON public.country_visa_rules;
DROP POLICY IF EXISTS "country_visa_rules_admin_write" ON public.country_visa_rules;
CREATE POLICY "country_visa_rules_authenticated_read" ON public.country_visa_rules
  FOR SELECT TO authenticated USING (public.current_staff_id() IS NOT NULL);
CREATE POLICY "country_visa_rules_admin_write" ON public.country_visa_rules
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

COMMIT;
