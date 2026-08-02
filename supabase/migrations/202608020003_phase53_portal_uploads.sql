-- Faz 5.3.1: Süreli müşteri portalından private Storage'a güvenli evrak yükleme.

BEGIN;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS upload_source TEXT,
  ADD COLUMN IF NOT EXISTS original_file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS content_type TEXT;

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_upload_source_valid,
  ADD CONSTRAINT documents_upload_source_valid
    CHECK (upload_source IS NULL OR upload_source IN ('staff', 'portal'));
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_file_size_valid,
  ADD CONSTRAINT documents_file_size_valid
    CHECK (file_size_bytes IS NULL OR file_size_bytes BETWEEN 1 AND 10485760);
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_content_type_valid,
  ADD CONSTRAINT documents_content_type_valid
    CHECK (content_type IS NULL OR content_type IN ('application/pdf', 'image/jpeg', 'image/png'));

CREATE OR REPLACE FUNCTION public.record_portal_document_upload_v1(
  p_customer_id UUID,
  p_document_id UUID,
  p_storage_path TEXT,
  p_file_name TEXT,
  p_content_type TEXT,
  p_file_size_bytes BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_application_id UUID;
  target_document_type TEXT;
  target_staff_id UUID;
  existing_file_url TEXT;
  existing_upload_source TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_customer_id IS NULL OR p_document_id IS NULL OR p_storage_path IS NULL
    OR p_file_name IS NULL OR p_content_type IS NULL OR p_file_size_bytes IS NULL
    OR p_file_size_bytes NOT BETWEEN 1 AND 10485760
    OR p_content_type NOT IN ('application/pdf', 'image/jpeg', 'image/png')
    OR p_file_name !~* '^[^/\\[:cntrl:]]{1,160}\.(pdf|jpg|jpeg|png)$' THEN
    RAISE EXCEPTION 'invalid_portal_document_upload' USING ERRCODE = '22023';
  END IF;

  SELECT application.id,
         document.document_type,
         COALESCE(application.assigned_staff_id, customer.assigned_staff_id),
         document.file_url,
         document.upload_source
  INTO target_application_id, target_document_type, target_staff_id, existing_file_url, existing_upload_source
  FROM public.documents AS document
  JOIN public.applications AS application ON application.id = document.application_id
  JOIN public.customers AS customer ON customer.id = application.customer_id
  WHERE document.id = p_document_id
    AND customer.id = p_customer_id
    AND customer.is_deleted = false;

  IF target_application_id IS NULL THEN
    RAISE EXCEPTION 'portal_document_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF p_storage_path !~ ('^portal/' || p_customer_id::TEXT || '/' || p_document_id::TEXT || '/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$') THEN
    RAISE EXCEPTION 'invalid_portal_storage_path' USING ERRCODE = '22023';
  END IF;
  IF existing_file_url IS NOT NULL AND COALESCE(existing_upload_source, 'staff') <> 'portal' THEN
    RAISE EXCEPTION 'document_already_uploaded_by_staff' USING ERRCODE = '22023';
  END IF;
  IF existing_file_url = p_storage_path AND existing_upload_source = 'portal' THEN
    RETURN target_application_id;
  END IF;

  UPDATE public.documents
  SET file_url = p_storage_path,
      status = 'yuklendi',
      uploaded_at = now(),
      upload_source = 'portal',
      original_file_name = p_file_name,
      file_size_bytes = p_file_size_bytes,
      content_type = p_content_type,
      updated_at = now()
  WHERE id = p_document_id;

  INSERT INTO public.activity_log (
    customer_id, application_id, action, performed_by, type
  ) VALUES (
    p_customer_id,
    target_application_id,
    'Müşteri portal üzerinden evrak yükledi: ' || target_document_type,
    'Müşteri Portalı',
    'document'
  );

  INSERT INTO public.notifications (
    recipient_staff_id, customer_id, application_id, type, title, message, href, idempotency_key
  )
  SELECT
    staff.id,
    p_customer_id,
    target_application_id,
    'document',
    'Yeni portal evrakı yüklendi',
    target_document_type || ' danışman incelemesi bekliyor.',
    '/customers/' || p_customer_id::TEXT,
    'portal-document:' || p_document_id::TEXT || ':' || staff.id::TEXT || ':' || md5(p_storage_path)
  FROM public.staff AS staff
  WHERE staff.id = target_staff_id
    AND staff.is_active = true;

  RETURN target_application_id;
END
$$;

REVOKE ALL ON FUNCTION public.record_portal_document_upload_v1(UUID, UUID, TEXT, TEXT, TEXT, BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_portal_document_upload_v1(UUID, UUID, TEXT, TEXT, TEXT, BIGINT)
  TO service_role;

COMMIT;
