-- Gmail OAuth fields for profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gmail_access_token text,
  ADD COLUMN IF NOT EXISTS gmail_refresh_token text,
  ADD COLUMN IF NOT EXISTS gmail_connected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gmail_email text;
