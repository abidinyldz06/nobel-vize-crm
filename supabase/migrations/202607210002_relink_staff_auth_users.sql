-- Production hotfix: reconnect existing staff rows to their Supabase Auth users.
-- Matching is intentionally limited to one normalized e-mail on each side.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.staff
    WHERE NULLIF(btrim(email), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'staff_auth_relink_blank_staff_email';
  END IF;

  IF EXISTS (
    SELECT lower(btrim(email))
    FROM public.staff
    GROUP BY lower(btrim(email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'staff_auth_relink_duplicate_staff_email';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.staff AS staff_row
    WHERE (
      SELECT count(*)
      FROM auth.users AS auth_user
      WHERE lower(btrim(auth_user.email)) = lower(btrim(staff_row.email))
    ) <> 1
  ) THEN
    RAISE EXCEPTION 'staff_auth_relink_requires_exactly_one_auth_match';
  END IF;
END
$$;

-- Clear only incorrect links first so crossed user ids cannot violate the
-- partial unique index while the correct links are restored in this transaction.
UPDATE public.staff AS staff_row
SET user_id = NULL
WHERE staff_row.user_id IS DISTINCT FROM (
  SELECT auth_user.id
  FROM auth.users AS auth_user
  WHERE lower(btrim(auth_user.email)) = lower(btrim(staff_row.email))
);

UPDATE public.staff AS staff_row
SET user_id = auth_user.id
FROM auth.users AS auth_user
WHERE lower(btrim(auth_user.email)) = lower(btrim(staff_row.email))
  AND staff_row.user_id IS DISTINCT FROM auth_user.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.staff AS staff_row
    LEFT JOIN auth.users AS auth_user
      ON auth_user.id = staff_row.user_id
     AND lower(btrim(auth_user.email)) = lower(btrim(staff_row.email))
    WHERE auth_user.id IS NULL
  ) THEN
    RAISE EXCEPTION 'staff_auth_relink_postcondition_failed';
  END IF;
END
$$;

COMMIT;
