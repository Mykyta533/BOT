/*
# Bot Settings and Activity Log

## Purpose
Adds two new tables:
1. `bot_settings` — configurable store parameters that admins can change without redeploying code (welcome text, contacts, hours, links, minimum order, free shipping threshold).
2. `activity_log` — a durable journal of key bot events (user started bot, viewed product, placed order, admin changed status, broadcast sent) for debugging and analytics.

## New Tables

### bot_settings
- `id` (uuid, primary key)
- `key` (text, unique) — setting key (e.g. 'welcome_text', 'min_order_amount')
- `value` (text) — setting value
- `label` (text) — human-readable label for admin UI
- `description` (text) — help text for admin UI
- `updated_at` (timestamptz)
- `updated_by` (int4) — telegram_id of admin who made the change

### activity_log
- `id` (uuid, primary key)
- `bot_user_id` (text, nullable) — reference to bot_users.id
- `event_type` (text) — e.g. 'start', 'product_view', 'order_created', 'admin_status_change', 'broadcast_sent'
- `event_data` (jsonb) — event-specific payload
- `created_at` (timestamptz)

## Security
- Both tables have RLS enabled.
- `bot_settings`: readable by anon+authenticated (bot needs to read settings), writable only by authenticated (admin panel).
- `activity_log`: insert by anon+authenticated (bot logs events), read by authenticated only (admin panel).
- No DELETE policies on either table — logs and settings should not be deletable via the API.

## Seed Data
- Inserts default settings: welcome_text, maintenance_message, contacts, working_hours, site_url, instagram_url, facebook_url, min_order_amount, free_delivery_threshold.
*/

CREATE TABLE IF NOT EXISTS bot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  updated_by int4
);

ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_bot_settings" ON bot_settings;
CREATE POLICY "anon_read_bot_settings" ON bot_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_update_bot_settings" ON bot_settings;
CREATE POLICY "auth_update_bot_settings" ON bot_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_insert_bot_settings" ON bot_settings;
CREATE POLICY "auth_insert_bot_settings" ON bot_settings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id text,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_activity_log" ON activity_log;
CREATE POLICY "anon_insert_activity_log" ON activity_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_activity_log" ON activity_log;
CREATE POLICY "auth_read_activity_log" ON activity_log FOR SELECT
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON activity_log (event_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_bot_user_id ON activity_log (bot_user_id);

INSERT INTO bot_settings (key, value, label, description) VALUES
  ('welcome_text', 'Вітаємо в нашому магазині! Оберіть дію з меню нижче.', 'Текст привітання', 'Повідомлення, яке бот надсилає при команді /start'),
  ('maintenance_message', '', 'Повідомлення про технічні роботи', 'Якщо не порожнє — бот показує його замість меню при /start'),
  ('contacts', '📞 Телефон: +380 00 000 00 00\n📍 Адреса: м. Тернопіль', 'Контакти', 'Контактна інформація магазину'),
  ('working_hours', 'Пн-Пт: 9:00-19:00\nСб-Нд: 10:00-16:00', 'Години роботи', 'Графік роботи магазину'),
  ('site_url', '', 'URL сайту', 'Посилання на ваш сайт'),
  ('instagram_url', '', 'Instagram', 'Посилання на Instagram'),
  ('facebook_url', '', 'Facebook', 'Посилання на Facebook'),
  ('min_order_amount', '0', 'Мінімальна сума замовлення (грн)', 'Замовлення з меншою сумою не приймаються'),
  ('free_delivery_threshold', '500', 'Поріг безкоштовної доставки (грн)', 'Безкоштовна доставка при замовленні від цієї суми')
ON CONFLICT (key) DO NOTHING;
