-- Database performance optimizations
-- Phase 7 of scalability migration

-- 1. Reservations: composite index for confirmed + upcoming queries (dashboard)
CREATE INDEX IF NOT EXISTS idx_reservations_user_check_in_confirmed
  ON public.reservations (user_id, check_in)
  WHERE status = 'confirmed';

-- 2. Reservations: index for check_out queries (cleaner reminder, dashboard)
CREATE INDEX IF NOT EXISTS idx_reservations_user_check_out
  ON public.reservations (user_id, check_out)
  WHERE status != 'cancelled';

-- 3. Messages: ensure we have DESC index for pagination (already have user_id+created_at DESC)
-- No-op if already present from original migration

-- 4. Email log: index for gmail_message_id lookup (dedup check in bot-process-email)
CREATE INDEX IF NOT EXISTS idx_email_log_gmail_message
  ON public.email_log (user_id, gmail_message_id)
  WHERE gmail_message_id IS NOT NULL;

-- 5. Pending reservations: index for user_id + status (dashboard fetches pending only)
CREATE INDEX IF NOT EXISTS idx_pending_reservations_user_status
  ON public.pending_reservations (user_id, status);

-- 6. Reservations: guest_email IS NULL index (for "find contacts" query)
CREATE INDEX IF NOT EXISTS idx_reservations_missing_email
  ON public.reservations (user_id)
  WHERE guest_email IS NULL AND tourist_name IS NOT NULL;

-- 7. Apartments: user_id index (already present from original migration, no-op if exists)

-- 8. Analyze tables for query planner
ANALYZE public.reservations;
ANALYZE public.messages;
ANALYZE public.pending_reservations;
ANALYZE public.email_log;
ANALYZE public.profiles;
