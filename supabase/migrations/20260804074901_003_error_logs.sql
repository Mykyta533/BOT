/*
# Error Logs Table

## Purpose
Durable storage for error events from the Telegram bot and edge functions.
Separate from activity_log (which tracks user actions) — this table tracks
system errors for debugging and monitoring.

## New Tables

### error_logs
- `id` (uuid, primary key)
- `module` (text) — which part of the system: 'telegram_api', 'ai', 'payments', 'database', 'edge_function', 'nova_poshta'
- `error_message` (text) — the error text
- `error_stack` (text, nullable) — stack trace for internal debugging
- `bot_user_id` (text, nullable) — affected user if known
- `severity` (text) — 'error' or 'warning'
- `context` (jsonb) — additional context (request data, order id, etc.)
- `created_at` (timestamptz)

## Security
- RLS enabled.
- INSERT by anon+authenticated (bot logs errors).
- SELECT by authenticated only (admin panel).
- No DELETE — errors should not be removable via API.
*/

CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  error_message text NOT NULL,
  error_stack text,
  bot_user_id text,
  severity text NOT NULL DEFAULT 'error',
  context jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_error_logs" ON error_logs;
CREATE POLICY "anon_insert_error_logs" ON error_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_error_logs" ON error_logs;
CREATE POLICY "auth_read_error_logs" ON error_logs FOR SELECT
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_module ON error_logs (module);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs (severity);
