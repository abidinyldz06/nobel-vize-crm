ALTER TABLE customers ADD COLUMN IF NOT EXISTS passport_no TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS passport_expiry DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS passport_issuing_country TEXT DEFAULT 'Türkiye';

CREATE TABLE IF NOT EXISTS communications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  direction TEXT DEFAULT 'giden',
  subject TEXT,
  content TEXT,
  performed_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
