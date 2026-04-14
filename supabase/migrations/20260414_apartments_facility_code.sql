-- ============================================================================
-- BepoBot — dodaj eVisitor Facility kod na apartmane
-- Pokreni u Supabase SQL editoru.
-- ============================================================================

-- 1) Dodaj kolonu (idempotentno)
ALTER TABLE public.apartments
  ADD COLUMN IF NOT EXISTS evisitor_facility_code text;

-- 2) RLS za apartments (ako već nije uključen)
ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apartments_self_select" ON public.apartments;
CREATE POLICY "apartments_self_select" ON public.apartments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "apartments_self_insert" ON public.apartments;
CREATE POLICY "apartments_self_insert" ON public.apartments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "apartments_self_update" ON public.apartments;
CREATE POLICY "apartments_self_update" ON public.apartments
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "apartments_self_delete" ON public.apartments;
CREATE POLICY "apartments_self_delete" ON public.apartments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- Verifikacija:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'apartments' AND column_name = 'evisitor_facility_code';
-- ============================================================================
