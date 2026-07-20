-- Faz 0: müşteri verilerinin anonim tablo erişimini kapat.
-- Staging ortamında doğrulanmadan üretimde çalıştırmayın.

BEGIN;

ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_log ENABLE ROW LEVEL SECURITY;

-- İmzalı webhook olay kimlikleri tekrar saldırılarını engeller. Ham müşteri
-- verisi bu tabloda saklanmaz.
CREATE TABLE IF NOT EXISTS public.webhook_events (
  event_id UUID PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'processed', 'rejected', 'failed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.webhook_events FROM anon, authenticated;

DROP POLICY IF EXISTS "Portal Public Read" ON public.customers;
DROP POLICY IF EXISTS "Portal Public Read Apps" ON public.applications;
DROP POLICY IF EXISTS "Portal Public Read Docs" ON public.documents;
DROP POLICY IF EXISTS "Portal Public Read Payments" ON public.payments;

-- Pasaport ve destekleyici belgeler herkese açık URL ile sunulmamalıdır.
UPDATE storage.buckets
SET public = false
WHERE id = 'documents';

COMMIT;
