-- Dodaj inquiry support u email_log
-- 1. Proširuje action check constraint da uključi 'inquiry'
-- 2. Dodaje inquiry_summary kolonu

ALTER TABLE public.email_log
  DROP CONSTRAINT IF EXISTS email_log_action_check;

ALTER TABLE public.email_log
  ADD CONSTRAINT email_log_action_check
  CHECK (action IN ('created', 'conflict', 'skipped', 'error', 'not_booking', 'inquiry'));

ALTER TABLE public.email_log
  ADD COLUMN IF NOT EXISTS inquiry_summary text;
