-- ============================================================================
-- BepoBot — Telegram pairing za multi-user Telegram bot
--
-- Svaki BepoBot user može povezati svoj Telegram account:
--  1. U web app-u klikne "Poveži Telegram" → generira se pairing kod
--  2. Pošalje /start <code> @bepo25bot
--  3. Bot razriješi kod, sprema telegram_user_id u profil, briše kod
--  4. Idući put bot zna tko je tko po telegram_user_id
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_user_id bigint,
  ADD COLUMN IF NOT EXISTS telegram_pairing_code text,
  ADD COLUMN IF NOT EXISTS telegram_pairing_expires_at timestamptz;

-- Unique tako da jedan Telegram account = max jedan BepoBot profil
CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_user_id_unique
  ON public.profiles (telegram_user_id)
  WHERE telegram_user_id IS NOT NULL;

-- Brz lookup po pairing kodu (aktivni pairing-ovi)
CREATE INDEX IF NOT EXISTS profiles_telegram_pairing_code_idx
  ON public.profiles (telegram_pairing_code)
  WHERE telegram_pairing_code IS NOT NULL;
