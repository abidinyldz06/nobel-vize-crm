-- Faz 1 baseline: migration zincirinin bos bir Supabase veritabaninda da
-- calisabilmesi icin uygulamanin bekledigi kanonik tablolari kurar.
-- Mevcut ortamlarda tum ifadeler veri koruyacak sekilde IF NOT EXISTS kullanir.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  subdomain TEXT,
  email TEXT,
  phone TEXT,
  plan TEXT,
  primary_color TEXT,
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_whatsapp BOOLEAN NOT NULL DEFAULT true,
  notify_reminder BOOLEAN NOT NULL DEFAULT true,
  notify_status_change BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID CONSTRAINT staff_user_fk REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'consultant',
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  profile_score INTEGER NOT NULL DEFAULT 0,
  passport_no TEXT,
  passport_expiry DATE,
  passport_issuing_country TEXT DEFAULT 'Türkiye',
  financial_status TEXT DEFAULT 'orta',
  monthly_income NUMERIC,
  notes TEXT,
  assigned_staff_id UUID CONSTRAINT customers_assigned_staff_fk REFERENCES public.staff(id) ON DELETE SET NULL,
  portal_token TEXT DEFAULT gen_random_uuid()::TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  visa_system TEXT,
  appointment_system TEXT,
  base_fee_visa NUMERIC NOT NULL DEFAULT 0,
  base_fee_service NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.country_visa_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL CONSTRAINT rules_country_fk REFERENCES public.countries(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL CONSTRAINT applications_customer_fk REFERENCES public.customers(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'profil_analizi',
  visa_type TEXT NOT NULL DEFAULT 'turistik',
  total_fee NUMERIC NOT NULL DEFAULT 0,
  consulate_fee NUMERIC NOT NULL DEFAULT 0,
  service_fee NUMERIC NOT NULL DEFAULT 0,
  appointment_date TIMESTAMPTZ,
  appointment_location TEXT,
  assigned_staff_id UUID CONSTRAINT applications_assigned_staff_fk REFERENCES public.staff(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL CONSTRAINT documents_application_fk REFERENCES public.applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'diger',
  is_required BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'bekleniyor',
  file_url TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL CONSTRAINT notes_application_fk REFERENCES public.applications(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID CONSTRAINT notes_created_by_fk REFERENCES public.staff(id) ON DELETE SET NULL,
  author TEXT DEFAULT 'Danışman',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL CONSTRAINT payments_application_fk REFERENCES public.applications(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT,
  method TEXT,
  type TEXT NOT NULL DEFAULT 'upfront',
  currency TEXT NOT NULL DEFAULT 'TRY',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID CONSTRAINT activity_log_application_fk REFERENCES public.applications(id) ON DELETE CASCADE,
  customer_id UUID CONSTRAINT activity_log_customer_fk REFERENCES public.customers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL DEFAULT 'Sistem',
  performed_by_staff_id UUID CONSTRAINT activity_log_actor_fk REFERENCES public.staff(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'general',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID CONSTRAINT communications_customer_fk REFERENCES public.customers(id) ON DELETE CASCADE,
  application_id UUID CONSTRAINT communications_application_fk REFERENCES public.applications(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'giden',
  subject TEXT,
  content TEXT,
  performed_by TEXT,
  performed_by_staff_id UUID CONSTRAINT communications_actor_fk REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.visa_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL CONSTRAINT visa_history_customer_fk REFERENCES public.customers(id) ON DELETE CASCADE,
  country TEXT,
  visa_type TEXT,
  result TEXT,
  application_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL CONSTRAINT family_members_customer_fk REFERENCES public.customers(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  relationship TEXT,
  passport_no TEXT,
  birth_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  event_id UUID PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

COMMIT;
