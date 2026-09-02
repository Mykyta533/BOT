/*
# Shipping — Stage 2: Constraints & Tracking Fields

1. Overview
This migration completes the shipments schema from migration 005 by adding:
- UNIQUE constraint on ttn (prevents duplicate shipments for the same TTN)
- last_checked_at timestamp (tracks last status poll)
- provider_status_code / provider_status_text (cached raw provider status)
- Dedup protection on shipment_status_history (prevents duplicate webhook inserts)
- CHECK constraint on shipments.status to enforce valid status values

2. Changes to existing tables (all additive, no data loss)
- shipments: ADD COLUMN last_checked_at, provider_status_code, provider_status_text
- shipments: ADD UNIQUE partial index on ttn WHERE ttn IS NOT NULL
- shipments: ADD CHECK constraint on status
- shipment_status_history: ADD UNIQUE index on (shipment_id, status, created_at)

3. Notes
- Idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
- No API keys stored in DB — all credentials are Edge Function secrets.
*/

-- Add tracking fields to shipments
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS provider_status_code text;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS provider_status_text text;

-- Unique TTN: prevents creating two shipments with the same tracking number
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_ttn_unique
  ON shipments(ttn) WHERE ttn IS NOT NULL;

-- CHECK constraint for valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipments_status_check'
  ) THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_status_check
      CHECK (status IN ('created', 'in_transit', 'arrived', 'delivered', 'refused', 'cancelled', 'error'));
  END IF;
END $$;

-- Dedup protection: prevent identical status entries at the same timestamp
-- (protects against duplicate webhook callbacks racing into the table)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ssh_dedup
  ON shipment_status_history(shipment_id, status, created_at);

-- Index for efficient "last status" lookups per shipment
CREATE INDEX IF NOT EXISTS idx_ssh_shipment_created
  ON shipment_status_history(shipment_id, created_at DESC);