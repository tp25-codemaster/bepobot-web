-- Background jobs table for QStash workers
-- Phase 4 of scalability migration

CREATE TABLE IF NOT EXISTS public.background_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN (
    'evisitor_import',
    'evisitor_find_contacts',
    'evisitor_checkin',
    'email_process'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'running',
    'completed',
    'failed'
  )),
  progress integer DEFAULT 0, -- 0-100
  total integer DEFAULT 0,
  processed integer DEFAULT 0,
  message text,
  error text,
  payload jsonb,
  result jsonb,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_user
  ON public.background_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_background_jobs_status
  ON public.background_jobs (status) WHERE status IN ('pending', 'running');

ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own jobs"
  ON public.background_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own jobs"
  ON public.background_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
