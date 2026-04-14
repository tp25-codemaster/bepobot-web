-- ============================================================================
-- BepoBot — Nadogradnja postojeće reservations tablice za self-checkin flow
--
-- Postojeća shema (host CRUD): guest_name, guest_contact, guests_count,
-- check_in, check_out, status, notes.
--
-- Dodajemo:
--  - token (unguessable public link)
--  - tourist_* (podaci koje gost sam popuni kroz link)
--  - guest_email / guest_phone (kontakt gosta)
--  - completed_at (trenutak kad je gost popunio)
--  - evisitor_* (rezultat eVisitor prijave)
-- ============================================================================

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS token text UNIQUE;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS tourist_name text,
  ADD COLUMN IF NOT EXISTS tourist_surname text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS citizenship text,
  ADD COLUMN IF NOT EXISTS city_of_residence text,
  ADD COLUMN IF NOT EXISTS residence_address text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_phone text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS evisitor_checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS evisitor_tourist_id text,
  ADD COLUMN IF NOT EXISTS evisitor_error text;

CREATE INDEX IF NOT EXISTS reservations_token_idx
  ON public.reservations (token) WHERE token IS NOT NULL;

-- RLS (idempotentno — dodaj ako još nije uključen)
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservations_self_select" ON public.reservations;
CREATE POLICY "reservations_self_select" ON public.reservations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reservations_self_insert" ON public.reservations;
CREATE POLICY "reservations_self_insert" ON public.reservations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reservations_self_update" ON public.reservations;
CREATE POLICY "reservations_self_update" ON public.reservations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reservations_self_delete" ON public.reservations;
CREATE POLICY "reservations_self_delete" ON public.reservations
  FOR DELETE USING (auth.uid() = user_id);
