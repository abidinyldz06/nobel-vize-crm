-- Faz 0: tek kiracılı Nobel Vize CRM için kapalı-varsayımlı rol politikaları.
-- Önce staging ortamında ve docs/PHASE_0_DEPLOYMENT_RUNBOOK.md sırasıyla uygulayın.

BEGIN;

-- RLS politikalarının staff tablosuna recursive sorgu göndermemesi için yalnızca
-- bool/kimlik döndüren security-definer yardımcıları kullanılır.
CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id
  FROM public.staff
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff
    WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_customer(target_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.customers
    WHERE id = target_customer_id
      AND assigned_staff_id = public.current_staff_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_application(target_application_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.applications
    WHERE id = target_application_id
      AND (
        assigned_staff_id = public.current_staff_id()
        OR public.can_access_customer(customer_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_document(target_document_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.documents
    WHERE id = target_document_id
      AND public.can_access_application(application_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.storage_document_id(object_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  candidate TEXT;
BEGIN
  candidate := split_part(split_part(object_name, '/', 2), '-', 1);
  RETURN candidate::UUID;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END
$$;

REVOKE ALL ON FUNCTION public.current_staff_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_customer(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_application(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_document(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storage_document_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_staff_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_customer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_application(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_document(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_document_id(TEXT) TO authenticated;

-- Eski ve çelişkili public şema politikalarını temizle.
DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'tenants', 'staff', 'customers', 'countries',
        'country_visa_requirements', 'country_visa_rules',
        'applications', 'documents', 'notes', 'payments', 'activity_log',
        'communications', 'visa_history', 'family_members'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END
$$;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visa_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_admin_all" ON public.tenants
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "staff_read_self_or_admin" ON public.staff
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "staff_admin_insert" ON public.staff
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "staff_admin_update" ON public.staff
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "staff_admin_delete" ON public.staff
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "countries_authenticated_read" ON public.countries
  FOR SELECT TO authenticated USING (public.current_staff_id() IS NOT NULL);
CREATE POLICY "countries_admin_insert" ON public.countries
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "countries_admin_update" ON public.countries
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "countries_admin_delete" ON public.countries
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "customers_read_assigned" ON public.customers
  FOR SELECT TO authenticated
  USING (public.is_admin() OR assigned_staff_id = public.current_staff_id());
CREATE POLICY "customers_insert_assigned" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR assigned_staff_id = public.current_staff_id());
CREATE POLICY "customers_update_assigned" ON public.customers
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR assigned_staff_id = public.current_staff_id())
  WITH CHECK (public.is_admin() OR assigned_staff_id = public.current_staff_id());
CREATE POLICY "customers_admin_delete" ON public.customers
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "applications_read_assigned" ON public.applications
  FOR SELECT TO authenticated USING (public.can_access_application(id));
CREATE POLICY "applications_insert_assigned" ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR assigned_staff_id = public.current_staff_id()
    OR public.can_access_customer(customer_id)
  );
CREATE POLICY "applications_update_assigned" ON public.applications
  FOR UPDATE TO authenticated
  USING (public.can_access_application(id))
  WITH CHECK (
    public.is_admin()
    OR assigned_staff_id = public.current_staff_id()
    OR public.can_access_customer(customer_id)
  );
CREATE POLICY "applications_admin_delete" ON public.applications
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "documents_assigned_select" ON public.documents
  FOR SELECT TO authenticated USING (public.can_access_application(application_id));
CREATE POLICY "documents_assigned_insert" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (public.can_access_application(application_id));
CREATE POLICY "documents_assigned_update" ON public.documents
  FOR UPDATE TO authenticated
  USING (public.can_access_application(application_id))
  WITH CHECK (public.can_access_application(application_id));
CREATE POLICY "documents_assigned_delete" ON public.documents
  FOR DELETE TO authenticated USING (public.can_access_application(application_id));

CREATE POLICY "notes_assigned_all" ON public.notes
  FOR ALL TO authenticated
  USING (public.can_access_application(application_id))
  WITH CHECK (public.can_access_application(application_id));
CREATE POLICY "payments_assigned_all" ON public.payments
  FOR ALL TO authenticated
  USING (public.can_access_application(application_id))
  WITH CHECK (public.can_access_application(application_id));

CREATE POLICY "activity_log_assigned_all" ON public.activity_log
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR (customer_id IS NOT NULL AND public.can_access_customer(customer_id))
    OR (application_id IS NOT NULL AND public.can_access_application(application_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (customer_id IS NOT NULL AND public.can_access_customer(customer_id))
    OR (application_id IS NOT NULL AND public.can_access_application(application_id))
  );

CREATE POLICY "communications_assigned_all" ON public.communications
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR (customer_id IS NOT NULL AND public.can_access_customer(customer_id))
    OR (application_id IS NOT NULL AND public.can_access_application(application_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (customer_id IS NOT NULL AND public.can_access_customer(customer_id))
    OR (application_id IS NOT NULL AND public.can_access_application(application_id))
  );

CREATE POLICY "visa_history_assigned_all" ON public.visa_history
  FOR ALL TO authenticated
  USING (public.can_access_customer(customer_id))
  WITH CHECK (public.can_access_customer(customer_id));
CREATE POLICY "family_members_assigned_all" ON public.family_members
  FOR ALL TO authenticated
  USING (public.can_access_customer(customer_id))
  WITH CHECK (public.can_access_customer(customer_id));

-- Eski ve yeni ülke/vize kural tablolarından hangisi varsa aynı rol modeli uygulanır.
DO $$
DECLARE
  rule_table TEXT;
BEGIN
  FOREACH rule_table IN ARRAY ARRAY['country_visa_requirements', 'country_visa_rules']
  LOOP
    IF to_regclass(format('public.%I', rule_table)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', rule_table);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.current_staff_id() IS NOT NULL)',
        rule_table || '_authenticated_read',
        rule_table
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
        rule_table || '_admin_write',
        rule_table
      );
    END IF;
  END LOOP;
END
$$;

-- Private document bucket: nesne adı docs/<document_uuid>-<random>.<ext>
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
DROP POLICY IF EXISTS "documents_assigned_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_assigned_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_assigned_delete" ON storage.objects;

CREATE POLICY "documents_assigned_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.can_access_document(public.storage_document_id(name))
  );
CREATE POLICY "documents_assigned_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.can_access_document(public.storage_document_id(name))
  );
CREATE POLICY "documents_assigned_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.can_access_document(public.storage_document_id(name))
  );

COMMIT;
