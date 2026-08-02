-- Faz 5.3: personel bazli Google Calendar baglantisi ve CRM olay eslestirmesi.
-- Erisim/yenileme tokenlari yalnizca uygulama sunucusunda sifreli saklanir;
-- tarayici rollerine tablo erisimi verilmez.

BEGIN;

CREATE TABLE public.calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT NOT NULL,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  sync_token TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_connections_provider_valid CHECK (provider = 'google'),
  CONSTRAINT calendar_connections_calendar_id_length CHECK (length(btrim(calendar_id)) BETWEEN 1 AND 255),
  CONSTRAINT calendar_connections_token_ciphertext_length CHECK (
    length(access_token_ciphertext) BETWEEN 32 AND 20000
    AND length(refresh_token_ciphertext) BETWEEN 32 AND 20000
  ),
  CONSTRAINT calendar_connections_error_length CHECK (last_sync_error IS NULL OR length(last_sync_error) <= 240),
  UNIQUE (staff_id, provider)
);
CREATE INDEX calendar_connections_enabled_idx
  ON public.calendar_connections(provider, updated_at)
  WHERE sync_enabled = true;
CREATE TRIGGER calendar_connections_set_updated_at
  BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.calendar_event_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  google_event_etag TEXT,
  remote_updated_at TIMESTAMPTZ,
  remote_deleted_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_event_links_google_event_id_length CHECK (length(btrim(google_event_id)) BETWEEN 1 AND 1024),
  UNIQUE (connection_id, application_id),
  UNIQUE (connection_id, google_event_id)
);
CREATE INDEX calendar_event_links_application_idx
  ON public.calendar_event_links(application_id);
CREATE TRIGGER calendar_event_links_set_updated_at
  BEFORE UPDATE ON public.calendar_event_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.calendar_connections, public.calendar_event_links
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.calendar_connections, public.calendar_event_links TO service_role;

CREATE OR REPLACE FUNCTION public.get_google_calendar_connection_status_v1()
RETURNS TABLE (
  connected BOOLEAN,
  sync_enabled BOOLEAN,
  calendar_id TEXT,
  last_synced_at TIMESTAMPTZ,
  last_sync_error TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
BEGIN
  IF actor_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    true,
    connection.sync_enabled,
    connection.calendar_id,
    connection.last_synced_at,
    connection.last_sync_error
  FROM public.calendar_connections AS connection
  WHERE connection.staff_id = actor_staff_id
    AND connection.provider = 'google'
  UNION ALL
  SELECT false, false, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TEXT
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.calendar_connections AS connection
    WHERE connection.staff_id = actor_staff_id
      AND connection.provider = 'google'
  );
END
$$;

REVOKE ALL ON FUNCTION public.get_google_calendar_connection_status_v1()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_google_calendar_connection_status_v1() TO authenticated;

ALTER TABLE public.operational_events
  DROP CONSTRAINT IF EXISTS operational_events_key_valid;
ALTER TABLE public.operational_events
  ADD CONSTRAINT operational_events_key_valid CHECK (event_key IN (
    'health.readiness.failed',
    'backup.export.failed',
    'backup.restore.failed',
    'backup.stale',
    'backup.scheduled.failed',
    'restore.drill.failed',
    'webhook.google_form.failed',
    'tasks.operational_sync.failed',
    'notifications.task_sync.failed',
    'cron.operations.failed',
    'security.suspicious_login',
    'messages.delivery.failed',
    'calendar.sync.failed',
    'cron.calendar.failed'
  ));

COMMIT;
