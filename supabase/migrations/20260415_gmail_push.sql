-- Gmail Push Notifications (Pub/Sub) support
-- Phase 3 of scalability migration

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gmail_last_history_id text,
  ADD COLUMN IF NOT EXISTS gmail_watch_expiration timestamptz;

-- Index for fast lookup by email in webhook handler
CREATE INDEX IF NOT EXISTS idx_profiles_gmail_email
  ON public.profiles (gmail_email)
  WHERE gmail_connected = true;

-- Index for cron job renewal query
CREATE INDEX IF NOT EXISTS idx_profiles_gmail_watch_expiration
  ON public.profiles (gmail_watch_expiration)
  WHERE gmail_connected = true;
