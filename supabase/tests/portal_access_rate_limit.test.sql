BEGIN;
SELECT plan(7);

SELECT ok(
  NOT has_function_privilege('anon', 'public.consume_portal_rate_limit_v1(text,text,text)', 'EXECUTE'),
  'anon cannot record portal attempts'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.consume_portal_rate_limit_v1(text,text,text)', 'EXECUTE'),
  'staff cannot record portal attempts'
);
SELECT ok(
  has_function_privilege('service_role', 'public.consume_portal_rate_limit_v1(text,text,text)', 'EXECUTE'),
  'service role records portal attempts'
);

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;

SELECT is(
  (public.consume_portal_rate_limit_v1(repeat('a', 64), repeat('b', 64), 'check')->>'allowed')::boolean,
  true,
  'a fresh portal reference is allowed'
);

SELECT public.consume_portal_rate_limit_v1(repeat('a', 64), repeat('b', 64), 'failure')
FROM generate_series(1, 8);
SELECT is(
  (public.consume_portal_rate_limit_v1(repeat('a', 64), repeat('b', 64), 'check')->>'allowed')::boolean,
  false,
  'eight failures lock that reference'
);
SELECT is(
  (public.consume_portal_rate_limit_v1(repeat('c', 64), repeat('b', 64), 'check')->>'allowed')::boolean,
  true,
  'a different reference on the same address stays open before the address limit'
);

SELECT public.consume_portal_rate_limit_v1(repeat('d', 64), repeat('e', 64), 'failure');
SELECT public.consume_portal_rate_limit_v1(repeat('d', 64), repeat('e', 64), 'success');
SELECT is(
  (public.consume_portal_rate_limit_v1(repeat('d', 64), repeat('e', 64), 'check')->>'allowed')::boolean,
  true,
  'a successful portal read clears that reference counter'
);

SELECT * FROM finish();
ROLLBACK;
