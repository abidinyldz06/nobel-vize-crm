-- Acil Paket H2: müşteri hard delete akışını güvenli arşiv yaşam döngüsüne çevirir.

BEGIN;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customers_deleted_state_consistent'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_deleted_state_consistent
      CHECK (
        (is_deleted = false AND deleted_at IS NULL)
        OR (is_deleted = true AND deleted_at IS NOT NULL)
      ) NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.customers
  VALIDATE CONSTRAINT customers_deleted_state_consistent;

CREATE INDEX IF NOT EXISTS idx_customers_active_created_at
  ON public.customers(created_at DESC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_customers_deleted_at
  ON public.customers(deleted_at)
  WHERE is_deleted = true;

-- Silinen müşterinin ilişkili verileri normal uygulama sorgularında görünmez.
CREATE OR REPLACE FUNCTION public.can_access_customer(target_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customers AS customer
    WHERE customer.id = target_customer_id
      AND customer.is_deleted = false
      AND (
        public.is_admin()
        OR customer.assigned_staff_id = public.current_staff_id()
      )
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
    FROM public.applications AS application
    JOIN public.customers AS customer ON customer.id = application.customer_id
    WHERE application.id = target_application_id
      AND customer.is_deleted = false
      AND (
        application.assigned_staff_id = public.current_staff_id()
        OR customer.assigned_staff_id = public.current_staff_id()
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
    FROM public.documents AS document
    WHERE document.id = target_document_id
      AND public.can_access_application(document.application_id)
  )
$$;

DROP POLICY IF EXISTS "customers_read_assigned" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_assigned" ON public.customers;
DROP POLICY IF EXISTS "customers_update_assigned" ON public.customers;
DROP POLICY IF EXISTS "customers_admin_delete" ON public.customers;

CREATE POLICY "customers_read_assigned" ON public.customers
  FOR SELECT TO authenticated
  USING (
    is_deleted = false
    AND (public.is_admin() OR assigned_staff_id = public.current_staff_id())
  );

CREATE POLICY "customers_insert_assigned" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    is_deleted = false
    AND deleted_at IS NULL
    AND (public.is_admin() OR assigned_staff_id = public.current_staff_id())
  );

CREATE POLICY "customers_update_assigned" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    is_deleted = false
    AND (public.is_admin() OR assigned_staff_id = public.current_staff_id())
  )
  WITH CHECK (
    is_deleted = false
    AND deleted_at IS NULL
    AND (public.is_admin() OR assigned_staff_id = public.current_staff_id())
  );

-- Arşiv değişikliği ve audit kaydı aynı transaction içinde tamamlanır.
CREATE OR REPLACE FUNCTION public.archive_customers_v1(p_customer_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT;
  archived_count INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_customer_ids IS NULL OR cardinality(p_customer_ids) = 0 THEN
    RAISE EXCEPTION 'customer_ids_required' USING ERRCODE = '22023';
  END IF;

  SELECT staff.full_name
  INTO actor_name
  FROM public.staff AS staff
  WHERE staff.id = actor_staff_id
    AND staff.is_active = true;

  IF actor_name IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  WITH archived AS (
    UPDATE public.customers AS customer
    SET is_deleted = true,
        deleted_at = now()
    WHERE customer.id = ANY(p_customer_ids)
      AND customer.is_deleted = false
    RETURNING customer.id, customer.first_name, customer.last_name
  )
  INSERT INTO public.activity_log (
    customer_id,
    action,
    performed_by,
    performed_by_staff_id,
    type
  )
  SELECT
    archived.id,
    'Müşteri silindi: ' || archived.first_name || ' ' || archived.last_name || ' — ' || actor_name,
    actor_name,
    actor_staff_id,
    'customer'
  FROM archived;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END
$$;

CREATE OR REPLACE FUNCTION public.restore_customers_v1(p_customer_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT;
  restored_count INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_customer_ids IS NULL OR cardinality(p_customer_ids) = 0 THEN
    RAISE EXCEPTION 'customer_ids_required' USING ERRCODE = '22023';
  END IF;

  SELECT staff.full_name
  INTO actor_name
  FROM public.staff AS staff
  WHERE staff.id = actor_staff_id
    AND staff.is_active = true;

  IF actor_name IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  WITH restored AS (
    UPDATE public.customers AS customer
    SET is_deleted = false,
        deleted_at = NULL
    WHERE customer.id = ANY(p_customer_ids)
      AND customer.is_deleted = true
    RETURNING customer.id, customer.first_name, customer.last_name
  )
  INSERT INTO public.activity_log (
    customer_id,
    action,
    performed_by,
    performed_by_staff_id,
    type
  )
  SELECT
    restored.id,
    'Müşteri geri yüklendi: ' || restored.first_name || ' ' || restored.last_name || ' — ' || actor_name,
    actor_name,
    actor_staff_id,
    'customer'
  FROM restored;

  GET DIAGNOSTICS restored_count = ROW_COUNT;
  RETURN restored_count;
END
$$;

CREATE OR REPLACE FUNCTION public.list_archived_customers_v1()
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  assigned_staff_id UUID,
  deleted_at TIMESTAMPTZ,
  purge_eligible BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    customer.id,
    customer.first_name,
    customer.last_name,
    customer.phone,
    customer.email,
    customer.assigned_staff_id,
    customer.deleted_at,
    customer.deleted_at <= now() - interval '30 days'
  FROM public.customers AS customer
  WHERE customer.is_deleted = true
  ORDER BY customer.deleted_at DESC;
END
$$;

-- Yalnız 30 günlük bekleme süresini doldurmuş seçili kayıtları kalıcı siler.
CREATE OR REPLACE FUNCTION public.purge_deleted_customers_v1(p_customer_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT;
  purged_count INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_customer_ids IS NULL OR cardinality(p_customer_ids) = 0 THEN
    RAISE EXCEPTION 'customer_ids_required' USING ERRCODE = '22023';
  END IF;

  SELECT staff.full_name
  INTO actor_name
  FROM public.staff AS staff
  WHERE staff.id = actor_staff_id
    AND staff.is_active = true;

  IF actor_name IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  WITH purged AS (
    DELETE FROM public.customers AS customer
    WHERE customer.id = ANY(p_customer_ids)
      AND customer.is_deleted = true
      AND customer.deleted_at <= now() - interval '30 days'
    RETURNING customer.first_name, customer.last_name
  )
  INSERT INTO public.activity_log (
    customer_id,
    action,
    performed_by,
    performed_by_staff_id,
    type
  )
  SELECT
    NULL,
    'Müşteri kalıcı silindi: ' || purged.first_name || ' ' || purged.last_name || ' — ' || actor_name,
    actor_name,
    actor_staff_id,
    'customer'
  FROM purged;

  GET DIAGNOSTICS purged_count = ROW_COUNT;
  RETURN purged_count;
END
$$;

REVOKE ALL ON FUNCTION public.archive_customers_v1(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_customers_v1(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_archived_customers_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_deleted_customers_v1(UUID[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.archive_customers_v1(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_customers_v1(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_archived_customers_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_deleted_customers_v1(UUID[]) TO authenticated;

COMMIT;
