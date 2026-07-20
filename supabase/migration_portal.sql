-- customers tablosuna portal_token kolonu ekle
ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_token TEXT DEFAULT gen_random_uuid();

-- Mevcut müşterilere token ata (NULL olanlar için)
UPDATE customers SET portal_token = gen_random_uuid() WHERE portal_token IS NULL;

-- Token'ı benzersiz yap
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_portal_token ON customers(portal_token) WHERE portal_token IS NOT NULL;

-- Portal sorguları yalnızca Next.js sunucu katmanında service-role istemcisiyle,
-- sınırlı kolonlar seçilerek yapılır. Anonim tablo erişimi kesinlikle verilmez.
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Portal Public Read" ON customers;
DROP POLICY IF EXISTS "Portal Public Read Apps" ON applications;
DROP POLICY IF EXISTS "Portal Public Read Docs" ON documents;
DROP POLICY IF EXISTS "Portal Public Read Payments" ON payments;
