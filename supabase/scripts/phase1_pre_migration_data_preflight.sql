-- Faz 1 migration oncesi veri kalite sayaclari.
-- Eski production semasinda henuz bulunmayan kolonlara basvurmaz; satir verisi
-- veya secret yazdirmaz. Migration sonrasi phase1_data_preflight.sql kullanilir.

SELECT 'invalid_staff_roles' AS check_name, count(*) AS issue_count
FROM public.staff
WHERE role IS NULL OR role NOT IN ('admin', 'consultant')
UNION ALL
SELECT 'duplicate_staff_user_ids', count(*)
FROM (
  SELECT user_id FROM public.staff
  WHERE user_id IS NOT NULL
  GROUP BY user_id HAVING count(*) > 1
) AS duplicate_users
UNION ALL
SELECT 'staff_without_auth_user', count(*)
FROM public.staff AS staff
WHERE staff.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = staff.user_id)
UNION ALL
SELECT 'invalid_profile_scores', count(*)
FROM public.customers
WHERE profile_score IS NULL OR profile_score NOT BETWEEN 0 AND 100
UNION ALL
SELECT 'customers_with_missing_staff', count(*)
FROM public.customers AS customer
WHERE customer.assigned_staff_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.staff WHERE id = customer.assigned_staff_id)
UNION ALL
SELECT 'applications_without_customer', count(*)
FROM public.applications
WHERE customer_id IS NULL
UNION ALL
SELECT 'applications_with_missing_customer', count(*)
FROM public.applications AS application
WHERE application.customer_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.customers WHERE id = application.customer_id)
UNION ALL
SELECT 'applications_with_missing_staff', count(*)
FROM public.applications AS application
WHERE application.assigned_staff_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.staff WHERE id = application.assigned_staff_id)
UNION ALL
SELECT 'invalid_application_statuses', count(*)
FROM public.applications
WHERE status IS NULL OR status NOT IN (
  'profil_analizi', 'evrak_bekleniyor', 'randevu_bekleniyor',
  'randevu_alindi', 'evrak_hazirlaniyor', 'basvuru_yapildi',
  'onaylandi', 'reddedildi', 'itiraz', 'kapandi'
)
UNION ALL
SELECT 'invalid_application_visa_types', count(*)
FROM public.applications
WHERE visa_type IS NULL OR visa_type NOT IN (
  'turist', 'turistik', 'aile_ziyareti', 'aile_birlesimi', 'is', 'ogrenci',
  'transit', 'tedavi', 'arastirma', 'kulturel_spor', 'calisma'
)
UNION ALL
SELECT 'negative_application_fees', count(*)
FROM public.applications
WHERE COALESCE(total_fee, 0) < 0
  OR COALESCE(consulate_fee, 0) < 0
  OR COALESCE(service_fee, 0) < 0
UNION ALL
SELECT 'documents_without_application', count(*)
FROM public.documents
WHERE application_id IS NULL
UNION ALL
SELECT 'documents_with_missing_application', count(*)
FROM public.documents AS document
WHERE document.application_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.applications WHERE id = document.application_id)
UNION ALL
SELECT 'invalid_document_statuses', count(*)
FROM public.documents
WHERE status IS NULL OR status NOT IN ('bekleniyor', 'yuklendi', 'onaylandi', 'eksik', 'reddedildi')
UNION ALL
SELECT 'negative_payments', count(*)
FROM public.payments
WHERE amount < 0
UNION ALL
SELECT 'invalid_rule_documents', count(*)
FROM public.country_visa_rules
WHERE documents IS NULL OR jsonb_typeof(documents) <> 'array'
UNION ALL
SELECT 'rules_with_missing_country', count(*)
FROM public.country_visa_rules AS rule
WHERE NOT EXISTS (SELECT 1 FROM public.countries WHERE id = rule.country_id)
ORDER BY check_name;

SELECT
  country_id,
  visa_category,
  COALESCE(travel_method, '*') AS travel_method,
  COALESCE(accommodation, '*') AS accommodation,
  COALESCE(occupation, '*') AS occupation,
  COALESCE(with_children::TEXT, '*') AS with_children,
  COALESCE(nationality, '*') AS nationality,
  count(*) AS duplicate_count
FROM public.country_visa_rules
GROUP BY 1, 2, 3, 4, 5, 6, 7
HAVING count(*) > 1;
