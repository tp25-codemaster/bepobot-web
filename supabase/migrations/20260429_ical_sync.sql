-- ============================================================================
-- BepoBot — iCal kalendar sync (Booking.com + Airbnb)
-- ============================================================================

-- 1. Apartments: dodaj iCal URL-ove po platformi
ALTER TABLE public.apartments
  ADD COLUMN IF NOT EXISTS booking_ical_url text,
  ADD COLUMN IF NOT EXISTS airbnb_ical_url text,
  ADD COLUMN IF NOT EXISTS ical_last_synced_at timestamptz;

-- 2. Reservations: dodaj platform + external_id za dedupliciranje
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS platform text CHECK (platform IN ('booking.com','airbnb','direct')) DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS has_conflict boolean NOT NULL DEFAULT false;

-- Unique constraint za dedupliciranje iCal importa
CREATE UNIQUE INDEX IF NOT EXISTS reservations_apartment_external_id_idx
  ON public.reservations (apartment_id, external_id)
  WHERE external_id IS NOT NULL;

-- Index za brze conflict upite po platformi
CREATE INDEX IF NOT EXISTS reservations_apartment_platform_idx
  ON public.reservations (apartment_id, platform, check_in, check_out)
  WHERE status != 'cancelled';

-- 3. Ažuriraj email-parsane rezervacije — postavi platform iz notes
-- (best-effort, neće biti 100% točno ali bolje nego NULL)
UPDATE public.reservations
SET platform = CASE
  WHEN notes ILIKE '%booking.com%' THEN 'booking.com'
  WHEN notes ILIKE '%airbnb%' THEN 'airbnb'
  ELSE 'direct'
END
WHERE platform IS NULL OR platform = 'direct';
