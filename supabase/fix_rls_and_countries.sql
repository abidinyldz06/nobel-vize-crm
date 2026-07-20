-- =============================================
-- NOBEL VİZE CRM — Supabase Düzeltme SQL
-- ESKİ VE GÜVENSİZ DOSYA: ÇALIŞTIRMAYIN.
-- Bu dosya geçmiş bağlam için tutulmaktadır; RLS'yi kapattığı için uygulama
-- veya migration amacıyla kullanılması yasaktır. Güncel değişiklikler
-- supabase/migrations klasöründedir.
-- =============================================

DO $$
BEGIN
  RAISE EXCEPTION 'Güvenlik engeli: fix_rls_and_countries.sql eski ve çalıştırılamaz. supabase/migrations kullanın.';
END
$$;

-- 1. Tarihsel içerikte dahi RLS açık tutulur.
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS appointments ENABLE ROW LEVEL SECURITY;

-- 2. EKSİK TABLOLARI OLUŞTUR (yoksa)

-- Staff tablosu
CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'consultant',
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Payments tablosu
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'TRY',
  type TEXT NOT NULL DEFAULT 'upfront',
  method TEXT DEFAULT 'nakit',
  status TEXT DEFAULT 'bekliyor',
  paid_at TIMESTAMP WITH TIME ZONE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Activity Log tablosu
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by TEXT DEFAULT 'Sistem',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Notes tablosu (yoksa)
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author TEXT DEFAULT 'Danışman',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- 3. CUSTOMERS TABLOSUNA EKSİK ALANLAR
ALTER TABLE customers ADD COLUMN IF NOT EXISTS assigned_staff_id UUID;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS financial_status TEXT DEFAULT 'orta';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS monthly_income NUMERIC;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. APPLICATIONS TABLOSUNA EKSİK ALANLAR
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assigned_staff_id UUID;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS visa_type TEXT DEFAULT 'turist';

-- 5. PAYMENTS TABLOSUNA CURRENCY ALANI
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TRY';

-- 5.5 COUNTRIES TABLOSUNA EKSİK ALAN
ALTER TABLE countries ADD COLUMN IF NOT EXISTS appointment_system TEXT;

-- 6. TÜM SCHENGEN + POPÜLER ÜLKELER (countries tablosuna ekle)
INSERT INTO countries (name, visa_system, appointment_system, base_fee, document_checklist)
VALUES
  ('Almanya', 'Schengen', 'iDATA', 5000, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)", "İşveren Yazısı", "Tapu/Araç Ruhsatı"]'),
  ('İtalya', 'Schengen', 'VFS', 5000, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)", "İşveren Yazısı"]'),
  ('İspanya', 'Schengen', 'BLS', 5000, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)", "İşveren Yazısı"]'),
  ('Hollanda', 'Schengen', 'VFS', 5000, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)", "İşveren Yazısı"]'),
  ('Belçika', 'Schengen', 'VFS', 5000, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)"]'),
  ('Avusturya', 'Schengen', 'VFS', 5000, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)", "İşveren Yazısı"]'),
  ('Yunanistan', 'Schengen', 'VFS', 4500, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)"]'),
  ('Portekiz', 'Schengen', 'VFS', 5000, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)"]'),
  ('İsveç', 'Schengen', 'VFS', 5500, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)", "İşveren Yazısı"]'),
  ('Norveç', 'Schengen', 'VFS', 5500, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)"]'),
  ('Danimarka', 'Schengen', 'VFS', 5500, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)"]'),
  ('Finlandiya', 'Schengen', 'VFS', 5500, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)"]'),
  ('Çekya', 'Schengen', 'VFS', 4500, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)"]'),
  ('Polonya', 'Schengen', 'VFS', 4500, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)"]'),
  ('Macaristan', 'Schengen', 'VFS', 4500, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)"]'),
  ('İsviçre', 'Schengen', 'VFS', 6000, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Seyahat Sağlık Sigortası", "Uçak Bileti Rezervasyonu", "Otel Rezervasyonu", "Banka Hesap Özeti (Son 3 Ay)", "Maaş Bordrosu (Son 3 Ay)", "İşveren Yazısı"]'),
  ('İngiltere', 'UK', 'VFS', 12000, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "TB Testi Sonucu", "İngilizce Yeterlilik", "Banka Hesap Özeti (Son 6 Ay)", "Maaş Bordrosu (Son 6 Ay)", "İşveren Yazısı", "Konaklama Kanıtı", "Seyahat Planı"]'),
  ('ABD', 'US', 'Konsolosluk', 15000, '["Pasaport", "Biyometrik Fotoğraf", "DS-160 Formu", "Banka Hesap Özeti (Son 6 Ay)", "Maaş Bordrosu (Son 6 Ay)", "İşveren Yazısı", "Tapu/Araç Ruhsatı", "Vergi Levhası", "Aile Nüfus Kayıt Örneği"]'),
  ('Kanada', 'Canada', 'VFS', 14000, '["Pasaport", "Biyometrik Fotoğraf", "Vize Başvuru Formu", "Biyometri Randevusu", "Banka Hesap Özeti (Son 6 Ay)", "Maaş Bordrosu (Son 6 Ay)", "İşveren Yazısı", "Seyahat Planı", "Konaklama Kanıtı"]')
ON CONFLICT DO NOTHING;

-- Bu noktaya ulaşılmamalıdır. Dosyanın kalan kısmı yalnızca tarihsel kayıttır.
