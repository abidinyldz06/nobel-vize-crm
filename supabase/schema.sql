-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  profile_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Countries Table (Evrak konfigürasyonu)
CREATE TABLE IF NOT EXISTS countries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  visa_system TEXT,
  base_fee DECIMAL,
  document_checklist JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applications Table (Başvurular)
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  country TEXT,
  status TEXT DEFAULT 'profil_analizi',
  total_fee DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents Table (Evraklar)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  document_type TEXT,
  status TEXT DEFAULT 'bekleniyor',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1. Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE visa_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Public Access" ON customers;
DROP POLICY IF EXISTS "Public Access" ON countries;
DROP POLICY IF EXISTS "Public Access" ON applications;
DROP POLICY IF EXISTS "Public Access" ON documents;
DROP POLICY IF EXISTS "Public Access" ON staff;
DROP POLICY IF EXISTS "Public Access" ON notes;
DROP POLICY IF EXISTS "Public Access" ON payments;
DROP POLICY IF EXISTS "Public Access" ON activity_log;
DROP POLICY IF EXISTS "Public Access" ON communications;
DROP POLICY IF EXISTS "Public Access" ON visa_history;
DROP POLICY IF EXISTS "Public Access" ON family_members;
DROP POLICY IF EXISTS "Public Access" ON tenants;

DROP POLICY IF EXISTS "Enable read access for all users" ON family_members;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON family_members;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON family_members;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON family_members;
DROP POLICY IF EXISTS "Enable read/write for auth users" ON tenants;

-- 3. Create Authenticated Read/Write policies
-- Customers
CREATE POLICY "Authenticated Read" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Write" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Countries
CREATE POLICY "Authenticated Read" ON countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Write" ON countries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Applications
CREATE POLICY "Authenticated Read" ON applications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Write" ON applications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Documents
CREATE POLICY "Authenticated Read" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Write" ON documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Staff
CREATE POLICY "Authenticated Read" ON staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Write" ON staff FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Notes
CREATE POLICY "Authenticated Read" ON notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Write" ON notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Payments
CREATE POLICY "Authenticated Read" ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Write" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Activity Log
CREATE POLICY "Authenticated Read" ON activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Write" ON activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Communications
CREATE POLICY "Authenticated Read" ON communications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Write" ON communications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Visa History
CREATE POLICY "Authenticated Read" ON visa_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Write" ON visa_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Family Members
CREATE POLICY "Authenticated Read" ON family_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Write" ON family_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tenants
CREATE POLICY "Authenticated Read" ON tenants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Write" ON tenants FOR ALL TO authenticated USING (true) WITH CHECK (true);
