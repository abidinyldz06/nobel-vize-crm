-- Faz 4.3 production hotfix: service-role yedek dogrulamasi sistem olaylarini
-- personel kimligi olmadan kapatabilir. Kullanici kaynakli cozum fonksiyonlari
-- kendi admin denetimlerini uygulamaya devam eder.

BEGIN;

ALTER TABLE public.operational_events
  DROP CONSTRAINT operational_events_resolution_consistent,
  ADD CONSTRAINT operational_events_resolution_consistent CHECK (
    (status = 'open' AND resolved_at IS NULL AND resolved_by_staff_id IS NULL)
    OR (status = 'resolved' AND resolved_at IS NOT NULL)
  );

COMMIT;
