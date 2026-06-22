-- 0. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 0. CLEANUP (DROP EXISTING TABLES)
-- ==========================================
DROP TABLE IF EXISTS family_members CASCADE;
DROP TABLE IF EXISTS visa_history CASCADE;
DROP TABLE IF EXISTS communications CASCADE;
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS countries CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- ==========================================
-- 1. TABLES CREATION
-- ==========================================

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  subdomain TEXT,
  email TEXT,
  phone TEXT,
  plan TEXT,
  primary_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staff
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  profile_score INTEGER DEFAULT 0,
  passport_no TEXT,
  passport_expiry DATE,
  passport_issuing_country TEXT,
  financial_status TEXT,
  monthly_income DECIMAL,
  notes TEXT,
  assigned_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Countries
CREATE TABLE IF NOT EXISTS countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  visa_system TEXT,
  base_fee DECIMAL,
  document_checklist JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applications
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  country TEXT,
  status TEXT DEFAULT 'profil_analizi',
  visa_type TEXT,
  total_fee DECIMAL,
  consulate_fee DECIMAL,
  service_fee DECIMAL,
  appointment_date TIMESTAMP WITH TIME ZONE,
  appointment_location TEXT,
  assigned_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  document_type TEXT,
  status TEXT DEFAULT 'bekleniyor',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notes
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  status TEXT,
  method TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Communications
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  type TEXT,
  direction TEXT,
  subject TEXT,
  content TEXT,
  performed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Visa History
CREATE TABLE IF NOT EXISTS visa_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  country TEXT,
  visa_type TEXT,
  result TEXT,
  application_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Family Members
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  relationship TEXT,
  passport_no TEXT,
  birth_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE visa_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;


-- ==========================================
-- 3. AUTHENTICATED POLICIES (Read & Write)
-- ==========================================

-- Drop any potential public policies to ensure strict security
DO $$ 
DECLARE 
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN ('tenants', 'staff', 'customers', 'countries', 'applications', 'documents', 'notes', 'payments', 'activity_log', 'communications', 'visa_history', 'family_members')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Tenants
CREATE POLICY "Authenticated Read" ON tenants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Write" ON tenants FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Staff
CREATE POLICY "Authenticated Read" ON staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Write" ON staff FOR ALL TO authenticated USING (true) WITH CHECK (true);

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
