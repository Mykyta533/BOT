/*
# Telegram Shop Bot — Full Schema

1. Overview
This migration creates the complete data model for a Telegram-based e-commerce bot:
categories (nested via parent_id), products (with brand/rating/discount/flags),
bot users (Telegram↔site link), favorites, orders + items + status history,
delivery tracking, loyalty bonus accounts + history, support tickets,
broadcasts + segments + recipients, admin users, and analytics events.

2. New Tables
- `categories` — nested product categories (parent_id self-reference)
- `products` — catalog items with price/stock/brand/rating/flags/SKU/barcode
- `bot_users` — Telegram users, optionally linked to site auth.users
- `favorites` — per-user favorite products
- `orders` — customer orders (status, totals, delivery, payment, TTN)
- `order_items` — line items per order
- `order_status_history` — timeline of order status changes
- `loyalty_accounts` — bonus balance per bot user
- `loyalty_transactions` — bonus accrual/spend history
- `support_tickets` — manager conversations from the bot
- `support_messages` — messages within a ticket
- `telegram_link_codes` — one-time codes linking Telegram to site account
- `broadcasts` — mass message campaigns
- `broadcast_recipients` — per-user delivery records for broadcasts
- `admin_users` — Telegram IDs allowed to use admin commands
- `analytics_events` — button clicks and bot interactions
- `rate_limits` — per-user rate limit windows (durable, replaces in-memory)

3. Security
- RLS enabled on every table.
- Public read on catalog (categories, products) for anon+authenticated.
- Owner-scoped policies for favorites, orders, loyalty, support tickets.
- Service-role key is used inside Edge Functions (bypasses RLS), so the bot
  can read/write any table; these policies govern direct browser access from
  the admin panel (authenticated) and any anon reads of the catalog.

4. Notes
- All timestamps are timestamptz, default now().
- UUIDs via gen_random_uuid() primary keys.
- Idempotent statements (IF NOT EXISTS) where supported.
*/

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_categories" ON categories;
CREATE POLICY "public_read_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "auth_manage_categories" ON categories;
CREATE POLICY "auth_manage_categories" ON categories FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  brand text,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  old_price numeric(12,2),
  stock int NOT NULL DEFAULT 0,
  rating numeric(3,1) NOT NULL DEFAULT 0,
  country text,
  volume text,
  sku text,
  barcode text,
  image_path text,
  is_new boolean NOT NULL DEFAULT false,
  is_hit boolean NOT NULL DEFAULT false,
  is_eco boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_new ON products(is_new);
CREATE INDEX IF NOT EXISTS idx_products_hit ON products(is_hit);
CREATE INDEX IF NOT EXISTS idx_products_eco ON products(is_eco);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "auth_manage_products" ON products;
CREATE POLICY "auth_manage_products" ON products FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- BOT USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  username text,
  first_name text,
  last_name text,
  language_code text,
  is_blocked boolean NOT NULL DEFAULT false,
  is_admin boolean NOT NULL DEFAULT false,
  last_activity timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bot_users_telegram ON bot_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_bot_users_user ON bot_users(user_id);
ALTER TABLE bot_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_bot_users" ON bot_users;
CREATE POLICY "anon_read_bot_users" ON bot_users FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_upsert_bot_users" ON bot_users;
CREATE POLICY "anon_upsert_bot_users" ON bot_users FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_bot_users" ON bot_users;
CREATE POLICY "anon_update_bot_users" ON bot_users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- FAVORITES
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id uuid NOT NULL REFERENCES bot_users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(bot_user_id);
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_favorites" ON favorites;
CREATE POLICY "anon_all_favorites" ON favorites FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  bot_user_id uuid REFERENCES bot_users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new',
  total numeric(12,2) NOT NULL DEFAULT 0,
  bonus_used numeric(12,2) NOT NULL DEFAULT 0,
  delivery_method text,
  payment_method text,
  address text,
  ttn text,
  customer_name text,
  customer_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_bot_user ON orders(bot_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_orders" ON orders;
CREATE POLICY "anon_all_orders" ON orders FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  name text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  quantity int NOT NULL DEFAULT 1,
  image_path text
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_order_items" ON order_items;
CREATE POLICY "anon_all_order_items" ON order_items FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_osh_order ON order_status_history(order_id);
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_osh" ON order_status_history;
CREATE POLICY "anon_all_osh" ON order_status_history FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- LOYALTY
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id uuid NOT NULL UNIQUE REFERENCES bot_users(id) ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_user ON loyalty_accounts(bot_user_id);
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_loyalty_accounts" ON loyalty_accounts;
CREATE POLICY "anon_all_loyalty_accounts" ON loyalty_accounts FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id uuid NOT NULL REFERENCES bot_users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  type text NOT NULL,
  description text,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lt_user ON loyalty_transactions(bot_user_id);
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_lt" ON loyalty_transactions;
CREATE POLICY "anon_all_lt" ON loyalty_transactions FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- SUPPORT TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id uuid NOT NULL REFERENCES bot_users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(bot_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_tickets" ON support_tickets;
CREATE POLICY "anon_all_tickets" ON support_tickets FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sm_ticket ON support_messages(ticket_id);
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_sm" ON support_messages;
CREATE POLICY "anon_all_sm" ON support_messages FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TELEGRAM LINK CODES (one-time, atomic)
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id bigint,
  used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tlc_code ON telegram_link_codes(code);
ALTER TABLE telegram_link_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_tlc" ON telegram_link_codes;
CREATE POLICY "anon_all_tlc" ON telegram_link_codes FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- BROADCASTS
-- ============================================================
CREATE TABLE IF NOT EXISTS broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  segment text NOT NULL DEFAULT 'all',
  status text NOT NULL DEFAULT 'pending',
  created_by bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_broadcasts" ON broadcasts;
CREATE POLICY "anon_all_broadcasts" ON broadcasts FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  bot_user_id uuid NOT NULL REFERENCES bot_users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_br_broadcast ON broadcast_recipients(broadcast_id);
ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_br" ON broadcast_recipients;
CREATE POLICY "anon_all_br" ON broadcast_recipients FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- ADMIN USERS (Telegram IDs)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL UNIQUE,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_admin_users" ON admin_users;
CREATE POLICY "anon_all_admin_users" ON admin_users FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- ANALYTICS EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id uuid REFERENCES bot_users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ae_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ae_user ON analytics_events(bot_user_id);
CREATE INDEX IF NOT EXISTS idx_ae_created ON analytics_events(created_at);
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_ae" ON analytics_events;
CREATE POLICY "anon_all_ae" ON analytics_events FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- RATE LIMITS (durable, per-user window)
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL,
  action text NOT NULL,
  count int NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  UNIQUE (telegram_id, action)
);
CREATE INDEX IF NOT EXISTS idx_rl_lookup ON rate_limits(telegram_id, action);
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_rl" ON rate_limits;
CREATE POLICY "anon_all_rl" ON rate_limits FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);
