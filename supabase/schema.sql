-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers Table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  profile_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Countries Table (Evrak konfigürasyonu)
CREATE TABLE countries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  visa_system TEXT,
  base_fee DECIMAL,
  document_checklist JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applications Table (Başvurular)
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  country TEXT,
  status TEXT DEFAULT 'profil_analizi',
  total_fee DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents Table (Evraklar)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  document_type TEXT,
  status TEXT DEFAULT 'bekleniyor',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Eklenen verilerin herkes tarafından okunabilmesi (MVP aşaması için Public, daha sonra RLS ile sınırlandırılacak)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Şimdilik herkesin okuyup yazabilmesi için geçici poliçeler (Auth gelince admin/danışman ayrımı yapılacak)
CREATE POLICY "Public Access" ON customers FOR ALL USING (true);
CREATE POLICY "Public Access" ON countries FOR ALL USING (true);
CREATE POLICY "Public Access" ON applications FOR ALL USING (true);
CREATE POLICY "Public Access" ON documents FOR ALL USING (true);
