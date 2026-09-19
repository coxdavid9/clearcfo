-- Step 4c: per-company email schedule preferences.
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS alert_delivery_time TEXT NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS weekly_report_time TEXT NOT NULL DEFAULT '07:30',
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  ADD COLUMN IF NOT EXISTS last_alert_delivery_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_weekly_delivery_at TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_preferences_alert_time_fmt') THEN
    ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_alert_time_fmt CHECK (alert_delivery_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_preferences_weekly_time_fmt') THEN
    ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_weekly_time_fmt CHECK (weekly_report_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notification_preferences' AND rowsecurity) THEN
    ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;
