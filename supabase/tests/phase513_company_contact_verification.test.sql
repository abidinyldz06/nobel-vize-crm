BEGIN;
SELECT plan(18);

SELECT has_function(
  'public', 'verify_company_contact_v1', ARRAY['text', 'text', 'text', 'text'],
  'controlled company contact verification function exists'
);
SELECT has_function(
  'public', 'update_tenant_security_settings_v1', ARRAY['boolean'],
  'controlled tenant security settings function exists'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.verify_company_contact_v1(text, text, text, text)',
    'EXECUTE'
  ),
  'authenticated users can invoke the controlled contact function'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.verify_company_contact_v1(text, text, text, text)',
    'EXECUTE'
  ),
  'anonymous users cannot invoke the controlled contact function'
);

INSERT INTO auth.users (id, email, role, aud, email_confirmed_at)
VALUES
  ('51300000-0000-0000-0000-000000000001', 'phase513-admin@example.test', 'authenticated', 'authenticated', now()),
  ('51300000-0000-0000-0000-000000000002', 'phase513-consultant@example.test', 'authenticated', 'authenticated', now());

INSERT INTO public.staff (id, user_id, full_name, email, role, is_active)
VALUES
  ('51300000-0000-0000-0000-000000000011', '51300000-0000-0000-0000-000000000001', 'Faz 5.1.3 Yönetici', 'phase513-admin@example.test', 'admin', true),
  ('51300000-0000-0000-0000-000000000012', '51300000-0000-0000-0000-000000000002', 'Faz 5.1.3 Danışman', 'phase513-consultant@example.test', 'consultant', true);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"51300000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ SELECT public.verify_company_contact_v1(
    'Nobel Vize',
    'contact@example.test',
    '0544 328 40 75',
    'https://www.nobelvize.com/iletisim/'
  ) $$,
  'admin can verify company contact information'
);
SELECT is(
  (SELECT email FROM public.tenants),
  'contact@example.test',
  'verified email is stored on the single company record'
);
SELECT is(
  (SELECT phone FROM public.tenants),
  '0544 328 40 75',
  'verified phone is stored on the single company record'
);
SELECT is(
  (SELECT contact_source_url FROM public.tenants),
  'https://www.nobelvize.com/iletisim/',
  'official source URL is stored with the verified contact'
);
SELECT is(
  (SELECT contact_verified_by_staff_id FROM public.tenants),
  '51300000-0000-0000-0000-000000000011'::UUID,
  'verifying admin is retained on the company record'
);
SELECT ok(
  (SELECT contact_verified_at IS NOT NULL FROM public.tenants),
  'company contact verification time is retained'
);
SELECT is(
  (SELECT count(*)::BIGINT FROM public.activity_log
    WHERE type = 'settings'
      AND action = 'Şirket iletişim bilgileri resmî kaynaktan doğrulandı — Faz 5.1.3 Yönetici'),
  1::BIGINT,
  'company contact verification is retained in the audit log'
);
SELECT throws_ok(
  $$ UPDATE public.tenants SET email = 'direct-update@example.test' $$,
  '42501',
  'permission denied for table tenants',
  'direct company contact update is denied outside the controlled workflow'
);
SELECT is(
  (SELECT email FROM public.tenants),
  'contact@example.test',
  'direct update cannot bypass the verified contact workflow'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"51300000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.verify_company_contact_v1(
    'Nobel Vize',
    'consultant@example.test',
    '0544 328 40 75',
    'https://www.nobelvize.com/iletisim/'
  ) $$,
  '42501',
  'admin_required',
  'consultant cannot verify company contact information'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"51300000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.verify_company_contact_v1(
    'Nobel Vize',
    'invalid-email',
    '0544 328 40 75',
    'https://www.nobelvize.com/iletisim/'
  ) $$,
  '22023',
  'invalid_company_email',
  'invalid email is rejected'
);
SELECT throws_ok(
  $$ SELECT public.verify_company_contact_v1(
    'Nobel Vize',
    'contact@example.test',
    '12',
    'https://www.nobelvize.com/iletisim/'
  ) $$,
  '22023',
  'invalid_company_phone',
  'invalid phone is rejected'
);
SELECT ok(
  public.update_tenant_security_settings_v1(true),
  'admin can still update the consultant MFA policy through its controlled function'
);
SELECT ok(
  (SELECT consultant_mfa_required FROM public.tenants),
  'controlled security setting update persists'
);

SELECT * FROM finish();
ROLLBACK;
