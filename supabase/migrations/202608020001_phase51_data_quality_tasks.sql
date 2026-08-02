-- Faz 5.1.2: Eksik müşteri ve başvuru verisini mevcut görev kuyruğunda güvenle takip et.

BEGIN;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_type_valid,
  DROP CONSTRAINT IF EXISTS tasks_source_valid;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_type_valid CHECK (
    task_type IN (
      'manual', 'appointment', 'document', 'payment', 'inactivity', 'passport',
      'lead', 'data_quality'
    )
  ),
  ADD CONSTRAINT tasks_source_valid CHECK (
    source_type IN (
      'manual', 'appointment', 'document', 'payment', 'inactivity', 'passport',
      'lead', 'data_quality'
    )
  );

-- Aynı eksik için tek görev tutulur. Veri hâlâ eksikse tamamlanmış görev yeniden
-- açılır; iptal edilmiş görevler özellikle susturulmuş kabul edilir.
CREATE OR REPLACE FUNCTION public.upsert_data_quality_task_v1(
  p_idempotency_key TEXT,
  p_title TEXT,
  p_description TEXT,
  p_priority TEXT,
  p_due_at TIMESTAMPTZ,
  p_assigned_staff_id UUID,
  p_customer_id UUID,
  p_application_id UUID,
  p_source_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  task_id UUID;
BEGIN
  INSERT INTO public.tasks (
    title,
    description,
    task_type,
    source_type,
    source_id,
    status,
    priority,
    due_at,
    assigned_staff_id,
    created_by_staff_id,
    customer_id,
    application_id,
    idempotency_key
  )
  VALUES (
    p_title,
    p_description,
    'data_quality',
    'data_quality',
    p_source_id,
    'pending',
    p_priority,
    p_due_at,
    p_assigned_staff_id,
    public.current_staff_id(),
    p_customer_id,
    p_application_id,
    p_idempotency_key
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO UPDATE
  SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    priority = EXCLUDED.priority,
    due_at = CASE
      WHEN public.tasks.status = 'completed' THEN EXCLUDED.due_at
      ELSE LEAST(public.tasks.due_at, EXCLUDED.due_at)
    END,
    status = CASE
      WHEN public.tasks.status = 'completed' THEN 'pending'
      ELSE public.tasks.status
    END,
    completed_at = CASE
      WHEN public.tasks.status = 'completed' THEN NULL
      ELSE public.tasks.completed_at
    END
  RETURNING id INTO task_id;

  RETURN task_id;
END
$$;

CREATE OR REPLACE FUNCTION public.sync_data_quality_tasks_v1()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  open_task_count INTEGER;
BEGIN
  IF actor_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  -- En az bir iletişim kanalı olmayan müşteriler.
  PERFORM public.upsert_data_quality_task_v1(
    'data-quality:customer:' || customer.id::TEXT || ':contact',
    'İletişim bilgisi eksik: ' || customer.first_name || ' ' || customer.last_name,
    'Müşteride kullanılabilir telefon veya e-posta bilgisi bulunmuyor.',
    'high',
    now() + interval '3 days',
    COALESCE(customer_owner.id, actor.id),
    customer.id,
    NULL,
    customer.id
  )
  FROM public.customers AS customer
  JOIN public.staff AS actor ON actor.id = actor_staff_id AND actor.is_active = true
  LEFT JOIN public.staff AS customer_owner
    ON customer_owner.id = customer.assigned_staff_id AND customer_owner.is_active = true
  WHERE customer.is_deleted = false
    AND NULLIF(regexp_replace(COALESCE(customer.phone, ''), '[^0-9]', '', 'g'), '') IS NULL
    AND NULLIF(btrim(COALESCE(customer.email, '')), '') IS NULL;

  -- Açık başvurusu varken pasaport numarası olmayan müşteriler.
  PERFORM public.upsert_data_quality_task_v1(
    'data-quality:customer:' || customer.id::TEXT || ':passport-no',
    'Pasaport numarası eksik: ' || customer.first_name || ' ' || customer.last_name,
    'Açık başvuru için pasaport numarası girilmemiş.',
    'high',
    now() + interval '3 days',
    COALESCE(customer_owner.id, actor.id),
    customer.id,
    NULL,
    customer.id
  )
  FROM public.customers AS customer
  JOIN public.staff AS actor ON actor.id = actor_staff_id AND actor.is_active = true
  LEFT JOIN public.staff AS customer_owner
    ON customer_owner.id = customer.assigned_staff_id AND customer_owner.is_active = true
  WHERE customer.is_deleted = false
    AND NULLIF(btrim(COALESCE(customer.passport_no, '')), '') IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.applications AS application
      WHERE application.customer_id = customer.id
        AND application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
    );

  -- Açık başvurusu varken pasaport son kullanım tarihi olmayan müşteriler.
  PERFORM public.upsert_data_quality_task_v1(
    'data-quality:customer:' || customer.id::TEXT || ':passport-expiry',
    'Pasaport bitiş tarihi eksik: ' || customer.first_name || ' ' || customer.last_name,
    'Açık başvuru için pasaport son kullanım tarihi girilmemiş.',
    'high',
    now() + interval '3 days',
    COALESCE(customer_owner.id, actor.id),
    customer.id,
    NULL,
    customer.id
  )
  FROM public.customers AS customer
  JOIN public.staff AS actor ON actor.id = actor_staff_id AND actor.is_active = true
  LEFT JOIN public.staff AS customer_owner
    ON customer_owner.id = customer.assigned_staff_id AND customer_owner.is_active = true
  WHERE customer.is_deleted = false
    AND customer.passport_expiry IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.applications AS application
      WHERE application.customer_id = customer.id
        AND application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
    );

  -- Açık başvuruda hedef ülke bağlantısı veya ülke adı bulunmayan kayıtlar.
  PERFORM public.upsert_data_quality_task_v1(
    'data-quality:application:' || application.id::TEXT || ':country',
    'Başvuru ülkesi eksik: ' || customer.first_name || ' ' || customer.last_name,
    'Açık başvuruda hedef ülke seçimi veya ülke bağlantısı eksik.',
    'high',
    now() + interval '3 days',
    COALESCE(application_owner.id, customer_owner.id, actor.id),
    customer.id,
    application.id,
    application.id
  )
  FROM public.applications AS application
  JOIN public.customers AS customer ON customer.id = application.customer_id AND customer.is_deleted = false
  JOIN public.staff AS actor ON actor.id = actor_staff_id AND actor.is_active = true
  LEFT JOIN public.staff AS application_owner
    ON application_owner.id = application.assigned_staff_id AND application_owner.is_active = true
  LEFT JOIN public.staff AS customer_owner
    ON customer_owner.id = customer.assigned_staff_id AND customer_owner.is_active = true
  WHERE application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
    AND (application.country_id IS NULL OR NULLIF(btrim(application.country), '') IS NULL);

  -- Açık başvuruda vize türü bulunmayan kayıtlar.
  PERFORM public.upsert_data_quality_task_v1(
    'data-quality:application:' || application.id::TEXT || ':visa-type',
    'Vize türü eksik: ' || customer.first_name || ' ' || customer.last_name,
    'Açık başvuruda vize türü seçilmemiş.',
    'high',
    now() + interval '3 days',
    COALESCE(application_owner.id, customer_owner.id, actor.id),
    customer.id,
    application.id,
    application.id
  )
  FROM public.applications AS application
  JOIN public.customers AS customer ON customer.id = application.customer_id AND customer.is_deleted = false
  JOIN public.staff AS actor ON actor.id = actor_staff_id AND actor.is_active = true
  LEFT JOIN public.staff AS application_owner
    ON application_owner.id = application.assigned_staff_id AND application_owner.is_active = true
  LEFT JOIN public.staff AS customer_owner
    ON customer_owner.id = customer.assigned_staff_id AND customer_owner.is_active = true
  WHERE application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
    AND NULLIF(btrim(COALESCE(application.visa_type, '')), '') IS NULL;

  -- Açık başvurunun erişilebilir aktif bir sorumlusu yoksa yöneticinin kuyruğuna düşer.
  PERFORM public.upsert_data_quality_task_v1(
    'data-quality:application:' || application.id::TEXT || ':assignee',
    'Sorumlu personel eksik: ' || customer.first_name || ' ' || customer.last_name,
    'Açık başvuruya veya müşteriye atanmış aktif bir personel bulunmuyor.',
    'urgent',
    now() + interval '1 day',
    actor.id,
    customer.id,
    application.id,
    application.id
  )
  FROM public.applications AS application
  JOIN public.customers AS customer ON customer.id = application.customer_id AND customer.is_deleted = false
  JOIN public.staff AS actor ON actor.id = actor_staff_id AND actor.is_active = true
  WHERE application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
    AND NOT EXISTS (
      SELECT 1
      FROM public.staff AS assignee
      WHERE assignee.is_active = true
        AND assignee.id IN (application.assigned_staff_id, customer.assigned_staff_id)
    );

  -- Evrak seçimini daha doğru daraltacak profil alanları eksikse yalnız takip görevi açılır;
  -- eşleştirici boş alanı "fark etmez" saymaya devam eder.
  PERFORM public.upsert_data_quality_task_v1(
    'data-quality:application:' || application.id::TEXT || ':profile',
    'Başvuru profili eksik: ' || customer.first_name || ' ' || customer.last_name,
    'Seyahat aracı, konaklama, meslek, çocuk durumu veya uyruk bilgisinden en az biri eksik.',
    'normal',
    now() + interval '7 days',
    COALESCE(application_owner.id, customer_owner.id, actor.id),
    customer.id,
    application.id,
    application.id
  )
  FROM public.applications AS application
  JOIN public.customers AS customer ON customer.id = application.customer_id AND customer.is_deleted = false
  JOIN public.staff AS actor ON actor.id = actor_staff_id AND actor.is_active = true
  LEFT JOIN public.staff AS application_owner
    ON application_owner.id = application.assigned_staff_id AND application_owner.is_active = true
  LEFT JOIN public.staff AS customer_owner
    ON customer_owner.id = customer.assigned_staff_id AND customer_owner.is_active = true
  WHERE application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
    AND (
      NULLIF(btrim(COALESCE(application.travel_method, '')), '') IS NULL
      OR NULLIF(btrim(COALESCE(application.accommodation, '')), '') IS NULL
      OR NULLIF(btrim(COALESCE(application.occupation, '')), '') IS NULL
      OR application.with_children IS NULL
      OR NULLIF(btrim(COALESCE(application.nationality, '')), '') IS NULL
    );

  -- Veri gerçekten tamamlandığında açık görev kendiliğinden kapanır.
  UPDATE public.tasks AS task
  SET status = 'completed', completed_at = now()
  WHERE task.source_type = 'data_quality'
    AND task.status IN ('pending', 'in_progress')
    AND task.idempotency_key LIKE 'data-quality:customer:%:contact'
    AND NOT EXISTS (
      SELECT 1 FROM public.customers AS customer
      WHERE customer.id = task.customer_id
        AND customer.is_deleted = false
        AND NULLIF(regexp_replace(COALESCE(customer.phone, ''), '[^0-9]', '', 'g'), '') IS NULL
        AND NULLIF(btrim(COALESCE(customer.email, '')), '') IS NULL
    );

  UPDATE public.tasks AS task
  SET status = 'completed', completed_at = now()
  WHERE task.source_type = 'data_quality'
    AND task.status IN ('pending', 'in_progress')
    AND task.idempotency_key LIKE 'data-quality:customer:%:passport-no'
    AND NOT EXISTS (
      SELECT 1
      FROM public.customers AS customer
      WHERE customer.id = task.customer_id
        AND customer.is_deleted = false
        AND NULLIF(btrim(COALESCE(customer.passport_no, '')), '') IS NULL
        AND EXISTS (
          SELECT 1 FROM public.applications AS application
          WHERE application.customer_id = customer.id
            AND application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
        )
    );

  UPDATE public.tasks AS task
  SET status = 'completed', completed_at = now()
  WHERE task.source_type = 'data_quality'
    AND task.status IN ('pending', 'in_progress')
    AND task.idempotency_key LIKE 'data-quality:customer:%:passport-expiry'
    AND NOT EXISTS (
      SELECT 1
      FROM public.customers AS customer
      WHERE customer.id = task.customer_id
        AND customer.is_deleted = false
        AND customer.passport_expiry IS NULL
        AND EXISTS (
          SELECT 1 FROM public.applications AS application
          WHERE application.customer_id = customer.id
            AND application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
        )
    );

  UPDATE public.tasks AS task
  SET status = 'completed', completed_at = now()
  WHERE task.source_type = 'data_quality'
    AND task.status IN ('pending', 'in_progress')
    AND task.idempotency_key LIKE 'data-quality:application:%:country'
    AND NOT EXISTS (
      SELECT 1
      FROM public.applications AS application
      JOIN public.customers AS customer ON customer.id = application.customer_id
      WHERE application.id = task.application_id
        AND customer.is_deleted = false
        AND application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
        AND (application.country_id IS NULL OR NULLIF(btrim(application.country), '') IS NULL)
    );

  UPDATE public.tasks AS task
  SET status = 'completed', completed_at = now()
  WHERE task.source_type = 'data_quality'
    AND task.status IN ('pending', 'in_progress')
    AND task.idempotency_key LIKE 'data-quality:application:%:visa-type'
    AND NOT EXISTS (
      SELECT 1
      FROM public.applications AS application
      JOIN public.customers AS customer ON customer.id = application.customer_id
      WHERE application.id = task.application_id
        AND customer.is_deleted = false
        AND application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
        AND NULLIF(btrim(COALESCE(application.visa_type, '')), '') IS NULL
    );

  UPDATE public.tasks AS task
  SET status = 'completed', completed_at = now()
  WHERE task.source_type = 'data_quality'
    AND task.status IN ('pending', 'in_progress')
    AND task.idempotency_key LIKE 'data-quality:application:%:assignee'
    AND NOT EXISTS (
      SELECT 1
      FROM public.applications AS application
      JOIN public.customers AS customer ON customer.id = application.customer_id
      WHERE application.id = task.application_id
        AND customer.is_deleted = false
        AND application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
        AND NOT EXISTS (
          SELECT 1 FROM public.staff AS assignee
          WHERE assignee.is_active = true
            AND assignee.id IN (application.assigned_staff_id, customer.assigned_staff_id)
        )
    );

  UPDATE public.tasks AS task
  SET status = 'completed', completed_at = now()
  WHERE task.source_type = 'data_quality'
    AND task.status IN ('pending', 'in_progress')
    AND task.idempotency_key LIKE 'data-quality:application:%:profile'
    AND NOT EXISTS (
      SELECT 1
      FROM public.applications AS application
      JOIN public.customers AS customer ON customer.id = application.customer_id
      WHERE application.id = task.application_id
        AND customer.is_deleted = false
        AND application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
        AND (
          NULLIF(btrim(COALESCE(application.travel_method, '')), '') IS NULL
          OR NULLIF(btrim(COALESCE(application.accommodation, '')), '') IS NULL
          OR NULLIF(btrim(COALESCE(application.occupation, '')), '') IS NULL
          OR application.with_children IS NULL
          OR NULLIF(btrim(COALESCE(application.nationality, '')), '') IS NULL
        )
    );

  SELECT count(*)::INTEGER
  INTO open_task_count
  FROM public.tasks
  WHERE source_type = 'data_quality'
    AND status IN ('pending', 'in_progress');

  RETURN jsonb_build_object('open_tasks', open_task_count);
END
$$;

CREATE OR REPLACE FUNCTION public.set_task_assignee_v1(
  p_task_id UUID,
  p_assigned_staff_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  current_task public.tasks%ROWTYPE;
  updated_task public.tasks%ROWTYPE;
BEGIN
  IF actor_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.staff
    WHERE id = p_assigned_staff_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'active_assignee_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_task
  FROM public.tasks
  WHERE id = p_task_id;

  IF current_task.id IS NULL THEN
    RETURN false;
  END IF;
  IF current_task.assigned_staff_id = p_assigned_staff_id THEN
    RETURN true;
  END IF;

  UPDATE public.tasks
  SET assigned_staff_id = p_assigned_staff_id
  WHERE id = p_task_id
  RETURNING * INTO updated_task;

  INSERT INTO public.notifications (
    recipient_staff_id,
    task_id,
    customer_id,
    application_id,
    type,
    title,
    message,
    href,
    idempotency_key
  )
  VALUES (
    updated_task.assigned_staff_id,
    updated_task.id,
    updated_task.customer_id,
    updated_task.application_id,
    updated_task.task_type,
    'Görev size atandı: ' || updated_task.title,
    updated_task.description,
    '/tasks?task=' || updated_task.id::TEXT,
    'task-reassigned:' || updated_task.id::TEXT || ':'
      || updated_task.assigned_staff_id::TEXT || ':'
      || extract(epoch FROM updated_task.updated_at)::BIGINT::TEXT
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.upsert_data_quality_task_v1(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_data_quality_tasks_v1() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_task_assignee_v1(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_data_quality_tasks_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_task_assignee_v1(UUID, UUID) TO authenticated;

COMMIT;
