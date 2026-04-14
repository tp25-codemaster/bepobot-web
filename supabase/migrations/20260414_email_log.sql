-- ============================================================================
-- BepoBot — email_log tablica za audit trail email parsinga
--
-- Za svaki email koji bot procesuje iz korisnikovog Gmail-a, spremamo red:
--  - što je parsano (structured data)
--  - je li bio prepoznat kao booking email
--  - je li kreirana rezervacija (i koja)
--  - je li bilo konflikta
--  - sirov email za debug
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email metadata
  gmail_message_id text,            -- Google mail API message ID (za dedup)
  email_from text,
  email_subject text,
  email_received_at timestamptz,

  -- Parser output
  is_booking boolean NOT NULL DEFAULT false,
  parsed_data jsonb,                -- structured data vraćen iz Haiku tool call
  parse_error text,

  -- Akcija
  action text CHECK (action IN ('created','conflict','skipped','error','not_booking')),
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  conflict_reservation_ids uuid[],

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index na (user_id, gmail_message_id) da se isti email ne procesira dvaput
CREATE UNIQUE INDEX IF NOT EXISTS email_log_user_message_unique
  ON public.email_log (user_id, gmail_message_id)
  WHERE gmail_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_log_user_created_idx
  ON public.email_log (user_id, created_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_log_self_select" ON public.email_log;
CREATE POLICY "email_log_self_select" ON public.email_log
  FOR SELECT USING (auth.uid() = user_id);

-- Bot service role piše preko getSupabaseAdmin(), RLS zaobiđen.
