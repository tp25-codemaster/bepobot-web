-- ============================================================================
-- BepoBot — Multi-tenant eVisitor migracija
-- Pokreni ovu datoteku u Supabase dashboardu: SQL Editor → New query → Run.
-- Sigurno za ponovno pokretanje (svi CREATE/ALTER koriste IF NOT EXISTS).
-- ============================================================================

-- 1) PROFILES -----------------------------------------------------------------
-- Prošireni auth.users s app-specifičnim podacima.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  onboarding_complete boolean NOT NULL DEFAULT false,
  plan text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','starter','pro','business')),
  evisitor_username text,
  -- Password je AES-256-GCM enkriptiran na app sloju i pohranjen kao base64 string.
  -- Ne sprema se nikada u plaintextu.
  evisitor_password text,
  evisitor_connected boolean NOT NULL DEFAULT false,
  evisitor_auto_checkin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-kreiranje profila kad se user registrira.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS za profiles.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_self_insert" ON public.profiles;
CREATE POLICY "profiles_self_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2) EVISITOR LOG -------------------------------------------------------------
-- Povijest svih pokušaja prijave/odjave preko BepoBota.

CREATE TABLE IF NOT EXISTS public.evisitor_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('checkin','checkout','cancel')),
  guest_name text NOT NULL,
  apartment_name text NOT NULL,
  evisitor_id text,
  status text NOT NULL CHECK (status IN ('success','error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evisitor_log_user_id_idx
  ON public.evisitor_log (user_id, created_at DESC);

ALTER TABLE public.evisitor_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evisitor_log_self_select" ON public.evisitor_log;
CREATE POLICY "evisitor_log_self_select" ON public.evisitor_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "evisitor_log_self_insert" ON public.evisitor_log;
CREATE POLICY "evisitor_log_self_insert" ON public.evisitor_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- GOTOVO.
--
-- Verifikacija (pokreni nakon migracije):
--   SELECT * FROM public.profiles LIMIT 1;
--   SELECT * FROM public.evisitor_log LIMIT 1;
--
-- Ako imaš postojeći user koji je registriran PRIJE ove migracije,
-- a nema profile redak, pokreni:
--   INSERT INTO public.profiles (id)
--   SELECT id FROM auth.users
--   WHERE id NOT IN (SELECT id FROM public.profiles)
--   ON CONFLICT DO NOTHING;
-- ============================================================================
