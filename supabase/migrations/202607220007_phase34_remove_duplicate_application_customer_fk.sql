-- Faz 3.4 production uyumluluğu: eski şemadan kalan yinelenen ilişki
-- PostgREST'in applications -> customers embed seçimini belirsizleştiriyordu.
BEGIN;

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_customer_id_fkey;

COMMIT;
