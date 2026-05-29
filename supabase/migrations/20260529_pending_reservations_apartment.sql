-- Dodaj apartment_id u pending_reservations za auto-matching iz email parsera
ALTER TABLE public.pending_reservations
  ADD COLUMN IF NOT EXISTS apartment_id uuid REFERENCES public.apartments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pending_reservations_apartment_id
  ON public.pending_reservations (apartment_id)
  WHERE apartment_id IS NOT NULL;
