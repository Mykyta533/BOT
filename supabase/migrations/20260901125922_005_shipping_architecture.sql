/*
# Shipping Integration — Nova Poshta Architecture

1. Overview
This migration adds the shipping infrastructure, mirroring the payment layer.
It expands the `orders` table with structured delivery details (city, warehouse,
recipient info) and creates a `shipments` table to track TTNs created via carrier
APIs, plus a `shipment_status_history` table for the full audit trail.

2. Changes to existing tables
- `orders`: ADD COLUMN
  - `delivery_city_ref` text  — Nova Poshta city ref
  - `delivery_city_name` text — city name (cached for display)
  - `delivery_warehouse_ref` text — warehouse/parcel locker ref
  - `delivery_warehouse_name` text — warehouse name (cached for display)
  - `recipient_name` text — full name for the waybill
  - `recipient_phone` text — phone for the waybill
  All nullable; existing rows are unaffected.

3. New Tables
- `shipments`
  - `id` (uuid PK)
  - `order_id` (uuid FK → orders ON DELETE SET NULL)
  - `provider` (text — 'novaposhta' | future providers)
  - `ttn` (text — tracking number / декларація)
  - `ref` (text — provider's internal document ref)
  - `status` (text — 'created' | 'in_transit' | 'arrived' | 'delivered' | 'refused' | 'cancelled' | 'error')
  - `cost` (numeric(12,2), nullable — estimated delivery cost)
  - `response_json` (jsonb — full provider response)
  - `created_at`, `updated_at`, `delivered_at` (timestamptz)
- `shipment_status_history`
  - `id` (uuid PK)
  - `shipment_id` (uuid FK → shipments ON DELETE CASCADE)
  - `status` (text)
  - `note` (text, nullable)
  - `created_at` (timestamptz)

4. Security
- RLS enabled on both new tables.
- anon+authenticated CRUD (same pattern as payment_transactions).

5. Notes
- Idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
- No data is lost — all new columns are nullable.
*/

-- Expand orders table with structured delivery info
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_city_ref text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_city_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_warehouse_ref text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_warehouse_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_phone text;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_city ON orders(delivery_city_ref);

-- ============================================================
-- SHIPMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'novaposhta',
  ttn text,
  ref text,
  status text NOT NULL DEFAULT 'created',
  cost numeric(12,2),
  response_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_provider ON shipments(provider);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_ttn ON shipments(ttn);

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_shipments" ON shipments;
CREATE POLICY "anon_all_shipments" ON shipments FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_shipments" ON shipments;
CREATE POLICY "anon_insert_shipments" ON shipments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_shipments" ON shipments;
CREATE POLICY "anon_update_shipments" ON shipments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_shipments" ON shipments;
CREATE POLICY "anon_delete_shipments" ON shipments FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- SHIPMENT STATUS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS shipment_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ssh_shipment ON shipment_status_history(shipment_id);

ALTER TABLE shipment_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_ssh" ON shipment_status_history;
CREATE POLICY "anon_all_ssh" ON shipment_status_history FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_ssh" ON shipment_status_history;
CREATE POLICY "anon_insert_ssh" ON shipment_status_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Seed shipping provider settings
INSERT INTO bot_settings (key, value, label, description) VALUES
  ('shipping_novaposhta_enabled', 'false', 'Nova Poshta', 'Увімкнути інтеграцію з Новою поштою')
ON CONFLICT (key) DO NOTHING;