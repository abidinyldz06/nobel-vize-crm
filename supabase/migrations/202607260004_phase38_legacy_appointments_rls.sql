-- Faz 3.8.8 production drift kapanışı:
-- Eski production kurulumundan kalan ve uygulamanın kullanmadığı appointments
-- tablosunu veri kaybetmeden güvenli duruma getirir.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.appointments') IS NOT NULL THEN
    ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
    REVOKE ALL PRIVILEGES ON TABLE public.appointments FROM PUBLIC, anon;
  END IF;
END
$$;

COMMIT;
