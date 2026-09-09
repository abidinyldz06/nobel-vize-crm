-- Internal SECURITY DEFINER helper: only the owning sync function calls it.
-- Revoking PUBLIC alone does not remove explicit Supabase role grants.
BEGIN;

REVOKE ALL ON FUNCTION public.upsert_data_quality_task_v1(
  TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, UUID, UUID
) FROM PUBLIC, anon, authenticated;

COMMIT;
