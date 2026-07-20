-- ESKİ RLS DOSYASI: staff tablosuna recursive politika gönderebilir.
-- Güncel politika: migrations/202607200002_phase0_role_based_rls.sql
DO $$
BEGIN
  RAISE EXCEPTION 'Güvenlik engeli: apply_rls_policies.sql eski; sürümlü migration kullanın.';
END
$$;

-- ==========================================
-- 1. DROP EXISTING POLICIES
-- ==========================================
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

-- ==========================================
-- 2. CREATE NEW ROLE-BASED POLICIES
-- ==========================================

-- Tenants
CREATE POLICY "Tenants All" ON tenants FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
);

-- Staff
CREATE POLICY "Staff All" ON staff FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
);

-- Countries
CREATE POLICY "Countries All" ON countries FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
);

-- Customers
CREATE POLICY "Customers Select" ON customers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
  OR assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid())
);
CREATE POLICY "Customers Insert" ON customers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
);
CREATE POLICY "Customers Update" ON customers FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
);
CREATE POLICY "Customers Delete" ON customers FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
);

-- Applications
CREATE POLICY "Applications All" ON applications FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
  OR assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid())
  OR customer_id IN (SELECT id FROM customers WHERE assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid()))
);

-- Documents
CREATE POLICY "Documents All" ON documents FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
  OR application_id IN (
    SELECT id FROM applications 
    WHERE assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid())
       OR customer_id IN (SELECT id FROM customers WHERE assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid()))
  )
);

-- Notes
CREATE POLICY "Notes All" ON notes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
  OR application_id IN (
    SELECT id FROM applications 
    WHERE assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid())
       OR customer_id IN (SELECT id FROM customers WHERE assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid()))
  )
);

-- Payments
CREATE POLICY "Payments All" ON payments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
  OR application_id IN (
    SELECT id FROM applications 
    WHERE assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid())
       OR customer_id IN (SELECT id FROM customers WHERE assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid()))
  )
);

-- Activity Log
CREATE POLICY "Activity Log All" ON activity_log FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
  OR customer_id IN (SELECT id FROM customers WHERE assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid()))
  OR application_id IN (
    SELECT id FROM applications 
    WHERE assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid())
  )
);

-- Communications
CREATE POLICY "Communications All" ON communications FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
  OR customer_id IN (SELECT id FROM customers WHERE assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid()))
  OR application_id IN (
    SELECT id FROM applications 
    WHERE assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid())
  )
);

-- Visa History
CREATE POLICY "Visa History All" ON visa_history FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
  OR customer_id IN (SELECT id FROM customers WHERE assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid()))
);

-- Family Members
CREATE POLICY "Family Members All" ON family_members FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.role = 'admin')
  OR customer_id IN (SELECT id FROM customers WHERE assigned_staff_id = (SELECT id FROM staff WHERE user_id = auth.uid()))
);
