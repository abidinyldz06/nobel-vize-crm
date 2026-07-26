-- Faz 3.8.6: migration, RLS, audit ve Auth/staff kapanış kapıları.

BEGIN;

-- RLS, TRUNCATE/REFERENCES/TRIGGER gibi tablo yetkilerini engellemez.
-- Supabase'in eski varsayılan grant'lerinden kalan tüm anonim tablo
-- yetkilerini mevcut ve gelecekte postgres rolüyle oluşturulan nesnelerde kapat.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon;

-- PostgreSQL fonksiyonlara varsayılan olarak PUBLIC EXECUTE verir. Uygulama
-- RPC'leri gerekli rollere migration'larında açıkça grant edildiği için genel
-- çalıştırma yetkisini güvenle kapatabiliriz.
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Trigger fonksiyonları kullanıcı tarafından doğrudan çalıştırılmamalıdır.
REVOKE ALL ON FUNCTION public.set_activity_actor() FROM authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM authenticated;

-- Aktif bir personelin Auth bağlantısının tekrar kopmasını şema seviyesinde
-- engelle. İnaktif, henüz yeniden davet edilecek tarihsel kayıtlar NULL kalabilir.
ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_active_requires_auth_link;
ALTER TABLE public.staff
  ADD CONSTRAINT staff_active_requires_auth_link
  CHECK (NOT is_active OR user_id IS NOT NULL)
  NOT VALID;
ALTER TABLE public.staff
  VALIDATE CONSTRAINT staff_active_requires_auth_link;

COMMIT;
