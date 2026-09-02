/*
# Payment Transactions & Status History

1. Overview
This migration creates the payment infrastructure for the bot shop.
It stores every transaction with the full provider response (response_json)
so disputes can be investigated, plus a status history table tracking every
status change over the lifetime of a transaction.

2. New Tables
- `payment_transactions`
  - `id` (uuid PK)
  - `order_id` (uuid FK → orders, nullable — refunds may not tie to a specific order)
  - `provider` (text — 'monobank' | 'liqpay' | 'wayforpay' | 'privat' | 'cod')
  - `payment_id` (text — provider's transaction/payment ID)
  - `invoice_id` (text — provider's invoice ID, if applicable)
  - `status` (text — 'pending' | 'paid' | 'failed' | 'refunded' | 'expired')
  - `amount` (numeric(12,2))
  - `currency` (text, default 'UAH')
  - `signature` (text — provider signature for verification)
  - `response_json` (jsonb — full provider response, for dispute analysis)
  - `created_at`, `updated_at`, `paid_at`, `refunded_at` (timestamptz)
- `payment_status_history`
  - `id` (uuid PK)
  - `transaction_id` (uuid FK → payment_transactions ON DELETE CASCADE)
  - `status` (text)
  - `note` (text, nullable)
  - `created_at` (timestamptz)

3. Security
- RLS enabled on both tables.
- anon+authenticated CRUD (single-tenant app, no sign-in screen — the admin
  panel uses the anon key and the edge function uses the service role key).

4. Notes
- Idempotent (IF NOT EXISTS).
- Indexes on order_id, provider, status, and transaction_id for history.
*/

CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  provider text NOT NULL,
  payment_id text,
  invoice_id text,
  status text NOT NULL DEFAULT 'pending',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UAH',
  signature text,
  response_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  refunded_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_pt_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_pt_provider ON payment_transactions(provider);
CREATE INDEX IF NOT EXISTS idx_pt_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pt_payment_id ON payment_transactions(payment_id);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_payment_transactions" ON payment_transactions;
CREATE POLICY "anon_all_payment_transactions" ON payment_transactions FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_payment_transactions" ON payment_transactions;
CREATE POLICY "anon_insert_payment_transactions" ON payment_transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_payment_transactions" ON payment_transactions;
CREATE POLICY "anon_update_payment_transactions" ON payment_transactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_payment_transactions" ON payment_transactions;
CREATE POLICY "anon_delete_payment_transactions" ON payment_transactions FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS payment_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_psh_transaction ON payment_status_history(transaction_id);

ALTER TABLE payment_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_psh" ON payment_status_history;
CREATE POLICY "anon_all_psh" ON payment_status_history FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_psh" ON payment_status_history;
CREATE POLICY "anon_insert_psh" ON payment_status_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Seed payment provider settings
INSERT INTO bot_settings (key, value, label, description) VALUES
  ('payment_monobank_enabled', 'false', 'Monobank', 'Увімкнути оплату через Monobank'),
  ('payment_liqpay_enabled', 'false', 'LiqPay', 'Увімкнути оплату через LiqPay'),
  ('payment_wayforpay_enabled', 'false', 'WayForPay', 'Увімкнути оплату через WayForPay'),
  ('payment_privat_enabled', 'false', 'PrivatBank', 'Увімкнути оплату через PrivatBank'),
  ('payment_cod_enabled', 'true', 'Післяплата', 'Увімкнути оплату при отриманні (післяплата)')
ON CONFLICT (key) DO NOTHING;