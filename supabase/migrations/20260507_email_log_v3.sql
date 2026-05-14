-- Shadow mode table for Gmail Push v3 pipeline.
-- Runs alongside email_log (n8n) to verify parity before cutting over.
-- Row lifecycle: webhook inserts (nulls for from/subject), worker updates terminal fields.

CREATE TABLE email_log_v3 (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_message_id    text,
  source              text        NOT NULL DEFAULT 'gmail_push',
  email_from          text,
  email_subject       text,
  parsed_booking      boolean,
  reservation_created boolean,
  error               text,
  raw_payload         jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Dedup: same message never logged twice per user
CREATE UNIQUE INDEX email_log_v3_dedup
  ON email_log_v3 (user_id, gmail_message_id)
  WHERE gmail_message_id IS NOT NULL;

CREATE INDEX email_log_v3_user_created ON email_log_v3 (user_id, created_at DESC);

ALTER TABLE email_log_v3 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_log_v3_self" ON email_log_v3
  FOR ALL USING (auth.uid() = user_id);
