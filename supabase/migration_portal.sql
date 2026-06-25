-- customers tablosuna portal_token kolonu ekle
ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_token TEXT DEFAULT gen_random_uuid();

-- Mevcut müşterilere token ata (NULL olanlar için)
UPDATE customers SET portal_token = gen_random_uuid() WHERE portal_token IS NULL;

-- Token'ı benzersiz yap
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_portal_token ON customers(portal_token) WHERE portal_token IS NOT NULL;

-- Portal token'ı authenticated olmadan okunabilmesi için public read policy
CREATE POLICY "Portal Public Read" ON customers FOR SELECT TO anon USING (true);

-- applications, documents, payments tabloları için de anon read policy ekle (portal için)
CREATE POLICY "Portal Public Read Apps" ON applications FOR SELECT TO anon USING (true);
CREATE POLICY "Portal Public Read Docs" ON documents FOR SELECT TO anon USING (true);
CREATE POLICY "Portal Public Read Payments" ON payments FOR SELECT TO anon USING (true);
