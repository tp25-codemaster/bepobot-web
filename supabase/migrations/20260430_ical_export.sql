-- BepoBot — iCal export token per apartment
-- Enables public /api/ical-export?apt=:id&token=:token endpoint
-- so Booking.com and Airbnb can subscribe to BepoBot's direct reservations.

ALTER TABLE public.apartments
  ADD COLUMN IF NOT EXISTS ical_export_token text;

-- Generate a random token for all existing apartments that don't have one yet.
-- New apartments get their token set by the register/insert code path.
UPDATE public.apartments
SET ical_export_token = encode(gen_random_bytes(24), 'hex')
WHERE ical_export_token IS NULL;

-- Non-null going forward (trigger on insert would be cleaner but this is fine for solo-founder scale).
CREATE UNIQUE INDEX IF NOT EXISTS apartments_ical_export_token_idx
  ON public.apartments (ical_export_token);
