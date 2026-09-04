/*
# Lock Down RLS Policies — Security Fix (retry)

Fixes critical security vulnerabilities where all tables had
USING(true) policies allowing anyone with the public anon key to
read, modify, and delete all data.

Catalog tables (categories, products, bot_settings): keep public SELECT.
All other tables: authenticated only (Edge Function uses service role key, bypasses RLS).
*/

-- CATEGORIES
DROP POLICY IF EXISTS "public_read_categories" ON categories;
DROP POLICY IF EXISTS "auth_manage_categories" ON categories;
DROP POLICY IF EXISTS "auth_insert_categories" ON categories;
DROP POLICY IF EXISTS "auth_update_categories" ON categories;
DROP POLICY IF EXISTS "auth_delete_categories" ON categories;
CREATE POLICY "public_read_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "auth_insert_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_categories" ON categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_categories" ON categories FOR DELETE
  TO authenticated USING (true);

-- PRODUCTS
DROP POLICY IF EXISTS "public_read_products" ON products;
DROP POLICY IF EXISTS "auth_manage_products" ON products;
DROP POLICY IF EXISTS "auth_insert_products" ON products;
DROP POLICY IF EXISTS "auth_update_products" ON products;
DROP POLICY IF EXISTS "auth_delete_products" ON products;
CREATE POLICY "public_read_products" ON products FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "auth_insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_products" ON products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_products" ON products FOR DELETE
  TO authenticated USING (true);

-- BOT USERS
DROP POLICY IF EXISTS "anon_read_bot_users" ON bot_users;
DROP POLICY IF EXISTS "anon_upsert_bot_users" ON bot_users;
DROP POLICY IF EXISTS "anon_update_bot_users" ON bot_users;
DROP POLICY IF EXISTS "auth_select_bot_users" ON bot_users;
DROP POLICY IF EXISTS "auth_insert_bot_users" ON bot_users;
DROP POLICY IF EXISTS "auth_update_bot_users" ON bot_users;
DROP POLICY IF EXISTS "auth_delete_bot_users" ON bot_users;
CREATE POLICY "auth_select_bot_users" ON bot_users FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_bot_users" ON bot_users FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_bot_users" ON bot_users FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_bot_users" ON bot_users FOR DELETE
  TO authenticated USING (true);

-- FAVORITES
DROP POLICY IF EXISTS "anon_all_favorites" ON favorites;
DROP POLICY IF EXISTS "auth_select_favorites" ON favorites;
DROP POLICY IF EXISTS "auth_insert_favorites" ON favorites;
DROP POLICY IF EXISTS "auth_update_favorites" ON favorites;
DROP POLICY IF EXISTS "auth_delete_favorites" ON favorites;
CREATE POLICY "auth_select_favorites" ON favorites FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_favorites" ON favorites FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_favorites" ON favorites FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_favorites" ON favorites FOR DELETE
  TO authenticated USING (true);

-- ORDERS
DROP POLICY IF EXISTS "anon_all_orders" ON orders;
DROP POLICY IF EXISTS "auth_select_orders" ON orders;
DROP POLICY IF EXISTS "auth_insert_orders" ON orders;
DROP POLICY IF EXISTS "auth_update_orders" ON orders;
DROP POLICY IF EXISTS "auth_delete_orders" ON orders;
CREATE POLICY "auth_select_orders" ON orders FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_orders" ON orders FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_orders" ON orders FOR DELETE
  TO authenticated USING (true);

-- ORDER ITEMS
DROP POLICY IF EXISTS "anon_all_order_items" ON order_items;
DROP POLICY IF EXISTS "auth_select_order_items" ON order_items;
DROP POLICY IF EXISTS "auth_insert_order_items" ON order_items;
DROP POLICY IF EXISTS "auth_update_order_items" ON order_items;
DROP POLICY IF EXISTS "auth_delete_order_items" ON order_items;
CREATE POLICY "auth_select_order_items" ON order_items FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_order_items" ON order_items FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_order_items" ON order_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_order_items" ON order_items FOR DELETE
  TO authenticated USING (true);

-- ORDER STATUS HISTORY
DROP POLICY IF EXISTS "anon_all_osh" ON order_status_history;
DROP POLICY IF EXISTS "auth_select_osh" ON order_status_history;
DROP POLICY IF EXISTS "auth_insert_osh" ON order_status_history;
DROP POLICY IF EXISTS "auth_update_osh" ON order_status_history;
DROP POLICY IF EXISTS "auth_delete_osh" ON order_status_history;
CREATE POLICY "auth_select_osh" ON order_status_history FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_osh" ON order_status_history FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_osh" ON order_status_history FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_osh" ON order_status_history FOR DELETE
  TO authenticated USING (true);

-- LOYALTY ACCOUNTS
DROP POLICY IF EXISTS "anon_all_loyalty_accounts" ON loyalty_accounts;
DROP POLICY IF EXISTS "auth_select_loyalty_accounts" ON loyalty_accounts;
DROP POLICY IF EXISTS "auth_insert_loyalty_accounts" ON loyalty_accounts;
DROP POLICY IF EXISTS "auth_update_loyalty_accounts" ON loyalty_accounts;
DROP POLICY IF EXISTS "auth_delete_loyalty_accounts" ON loyalty_accounts;
CREATE POLICY "auth_select_loyalty_accounts" ON loyalty_accounts FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_loyalty_accounts" ON loyalty_accounts FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_loyalty_accounts" ON loyalty_accounts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_loyalty_accounts" ON loyalty_accounts FOR DELETE
  TO authenticated USING (true);

-- LOYALTY TRANSACTIONS
DROP POLICY IF EXISTS "anon_all_lt" ON loyalty_transactions;
DROP POLICY IF EXISTS "auth_select_lt" ON loyalty_transactions;
DROP POLICY IF EXISTS "auth_insert_lt" ON loyalty_transactions;
DROP POLICY IF EXISTS "auth_update_lt" ON loyalty_transactions;
DROP POLICY IF EXISTS "auth_delete_lt" ON loyalty_transactions;
CREATE POLICY "auth_select_lt" ON loyalty_transactions FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_lt" ON loyalty_transactions FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_lt" ON loyalty_transactions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_lt" ON loyalty_transactions FOR DELETE
  TO authenticated USING (true);

-- SUPPORT TICKETS
DROP POLICY IF EXISTS "anon_all_tickets" ON support_tickets;
DROP POLICY IF EXISTS "auth_select_tickets" ON support_tickets;
DROP POLICY IF EXISTS "auth_insert_tickets" ON support_tickets;
DROP POLICY IF EXISTS "auth_update_tickets" ON support_tickets;
DROP POLICY IF EXISTS "auth_delete_tickets" ON support_tickets;
CREATE POLICY "auth_select_tickets" ON support_tickets FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_tickets" ON support_tickets FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_tickets" ON support_tickets FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_tickets" ON support_tickets FOR DELETE
  TO authenticated USING (true);

-- SUPPORT MESSAGES
DROP POLICY IF EXISTS "anon_all_sm" ON support_messages;
DROP POLICY IF EXISTS "auth_select_sm" ON support_messages;
DROP POLICY IF EXISTS "auth_insert_sm" ON support_messages;
DROP POLICY IF EXISTS "auth_update_sm" ON support_messages;
DROP POLICY IF EXISTS "auth_delete_sm" ON support_messages;
CREATE POLICY "auth_select_sm" ON support_messages FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_sm" ON support_messages FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_sm" ON support_messages FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_sm" ON support_messages FOR DELETE
  TO authenticated USING (true);

-- TELEGRAM LINK CODES
DROP POLICY IF EXISTS "anon_all_tlc" ON telegram_link_codes;
DROP POLICY IF EXISTS "auth_select_tlc" ON telegram_link_codes;
DROP POLICY IF EXISTS "auth_insert_tlc" ON telegram_link_codes;
DROP POLICY IF EXISTS "auth_update_tlc" ON telegram_link_codes;
DROP POLICY IF EXISTS "auth_delete_tlc" ON telegram_link_codes;
CREATE POLICY "auth_select_tlc" ON telegram_link_codes FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_tlc" ON telegram_link_codes FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_tlc" ON telegram_link_codes FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_tlc" ON telegram_link_codes FOR DELETE
  TO authenticated USING (true);

-- BROADCASTS
DROP POLICY IF EXISTS "anon_all_broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "auth_select_broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "auth_insert_broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "auth_update_broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "auth_delete_broadcasts" ON broadcasts;
CREATE POLICY "auth_select_broadcasts" ON broadcasts FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_broadcasts" ON broadcasts FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_broadcasts" ON broadcasts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_broadcasts" ON broadcasts FOR DELETE
  TO authenticated USING (true);

-- BROADCAST RECIPIENTS
DROP POLICY IF EXISTS "anon_all_br" ON broadcast_recipients;
DROP POLICY IF EXISTS "auth_select_br" ON broadcast_recipients;
DROP POLICY IF EXISTS "auth_insert_br" ON broadcast_recipients;
DROP POLICY IF EXISTS "auth_update_br" ON broadcast_recipients;
DROP POLICY IF EXISTS "auth_delete_br" ON broadcast_recipients;
CREATE POLICY "auth_select_br" ON broadcast_recipients FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_br" ON broadcast_recipients FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_br" ON broadcast_recipients FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_br" ON broadcast_recipients FOR DELETE
  TO authenticated USING (true);

-- ADMIN USERS
DROP POLICY IF EXISTS "anon_all_admin_users" ON admin_users;
DROP POLICY IF EXISTS "auth_select_admin_users" ON admin_users;
DROP POLICY IF EXISTS "auth_insert_admin_users" ON admin_users;
DROP POLICY IF EXISTS "auth_update_admin_users" ON admin_users;
DROP POLICY IF EXISTS "auth_delete_admin_users" ON admin_users;
CREATE POLICY "auth_select_admin_users" ON admin_users FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_admin_users" ON admin_users FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_admin_users" ON admin_users FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_admin_users" ON admin_users FOR DELETE
  TO authenticated USING (true);

-- ANALYTICS EVENTS
DROP POLICY IF EXISTS "anon_all_ae" ON analytics_events;
DROP POLICY IF EXISTS "auth_select_ae" ON analytics_events;
DROP POLICY IF EXISTS "auth_insert_ae" ON analytics_events;
DROP POLICY IF EXISTS "auth_update_ae" ON analytics_events;
DROP POLICY IF EXISTS "auth_delete_ae" ON analytics_events;
CREATE POLICY "auth_select_ae" ON analytics_events FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_ae" ON analytics_events FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_ae" ON analytics_events FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_ae" ON analytics_events FOR DELETE
  TO authenticated USING (true);

-- RATE LIMITS
DROP POLICY IF EXISTS "anon_all_rl" ON rate_limits;
DROP POLICY IF EXISTS "auth_select_rl" ON rate_limits;
DROP POLICY IF EXISTS "auth_insert_rl" ON rate_limits;
DROP POLICY IF EXISTS "auth_update_rl" ON rate_limits;
DROP POLICY IF EXISTS "auth_delete_rl" ON rate_limits;
CREATE POLICY "auth_select_rl" ON rate_limits FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_rl" ON rate_limits FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_rl" ON rate_limits FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_rl" ON rate_limits FOR DELETE
  TO authenticated USING (true);

-- BOT SETTINGS — public read, authenticated write
DROP POLICY IF EXISTS "anon_all_bot_settings" ON bot_settings;
DROP POLICY IF EXISTS "public_read_bot_settings" ON bot_settings;
DROP POLICY IF EXISTS "auth_insert_bot_settings" ON bot_settings;
DROP POLICY IF EXISTS "auth_update_bot_settings" ON bot_settings;
DROP POLICY IF EXISTS "auth_delete_bot_settings" ON bot_settings;
CREATE POLICY "public_read_bot_settings" ON bot_settings FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "auth_insert_bot_settings" ON bot_settings FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_bot_settings" ON bot_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_bot_settings" ON bot_settings FOR DELETE
  TO authenticated USING (true);

-- ACTIVITY LOG
DROP POLICY IF EXISTS "anon_all_activity_log" ON activity_log;
DROP POLICY IF EXISTS "auth_select_activity_log" ON activity_log;
DROP POLICY IF EXISTS "auth_insert_activity_log" ON activity_log;
DROP POLICY IF EXISTS "auth_update_activity_log" ON activity_log;
DROP POLICY IF EXISTS "auth_delete_activity_log" ON activity_log;
CREATE POLICY "auth_select_activity_log" ON activity_log FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_activity_log" ON activity_log FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_activity_log" ON activity_log FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_activity_log" ON activity_log FOR DELETE
  TO authenticated USING (true);

-- ERROR LOGS
DROP POLICY IF EXISTS "anon_all_error_logs" ON error_logs;
DROP POLICY IF EXISTS "auth_select_error_logs" ON error_logs;
DROP POLICY IF EXISTS "auth_insert_error_logs" ON error_logs;
DROP POLICY IF EXISTS "auth_update_error_logs" ON error_logs;
DROP POLICY IF EXISTS "auth_delete_error_logs" ON error_logs;
CREATE POLICY "auth_select_error_logs" ON error_logs FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_error_logs" ON error_logs FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_error_logs" ON error_logs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_error_logs" ON error_logs FOR DELETE
  TO authenticated USING (true);

-- PAYMENT TRANSACTIONS
DROP POLICY IF EXISTS "anon_all_payment_transactions" ON payment_transactions;
DROP POLICY IF EXISTS "auth_select_payment_transactions" ON payment_transactions;
DROP POLICY IF EXISTS "auth_insert_payment_transactions" ON payment_transactions;
DROP POLICY IF EXISTS "auth_update_payment_transactions" ON payment_transactions;
DROP POLICY IF EXISTS "auth_delete_payment_transactions" ON payment_transactions;
CREATE POLICY "auth_select_payment_transactions" ON payment_transactions FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_payment_transactions" ON payment_transactions FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_payment_transactions" ON payment_transactions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_payment_transactions" ON payment_transactions FOR DELETE
  TO authenticated USING (true);

-- PAYMENT STATUS HISTORY
DROP POLICY IF EXISTS "anon_all_payment_status_history" ON payment_status_history;
DROP POLICY IF EXISTS "auth_select_payment_status_history" ON payment_status_history;
DROP POLICY IF EXISTS "auth_insert_payment_status_history" ON payment_status_history;
DROP POLICY IF EXISTS "auth_update_payment_status_history" ON payment_status_history;
DROP POLICY IF EXISTS "auth_delete_payment_status_history" ON payment_status_history;
CREATE POLICY "auth_select_payment_status_history" ON payment_status_history FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_payment_status_history" ON payment_status_history FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_payment_status_history" ON payment_status_history FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_payment_status_history" ON payment_status_history FOR DELETE
  TO authenticated USING (true);

-- SHIPMENTS
DROP POLICY IF EXISTS "anon_all_shipments" ON shipments;
DROP POLICY IF EXISTS "auth_select_shipments" ON shipments;
DROP POLICY IF EXISTS "auth_insert_shipments" ON shipments;
DROP POLICY IF EXISTS "auth_update_shipments" ON shipments;
DROP POLICY IF EXISTS "auth_delete_shipments" ON shipments;
CREATE POLICY "auth_select_shipments" ON shipments FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_shipments" ON shipments FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_shipments" ON shipments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_shipments" ON shipments FOR DELETE
  TO authenticated USING (true);

-- SHIPMENT STATUS HISTORY
DROP POLICY IF EXISTS "anon_all_ssh" ON shipment_status_history;
DROP POLICY IF EXISTS "auth_select_ssh" ON shipment_status_history;
DROP POLICY IF EXISTS "auth_insert_ssh" ON shipment_status_history;
DROP POLICY IF EXISTS "auth_update_ssh" ON shipment_status_history;
DROP POLICY IF EXISTS "auth_delete_ssh" ON shipment_status_history;
CREATE POLICY "auth_select_ssh" ON shipment_status_history FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_ssh" ON shipment_status_history FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_ssh" ON shipment_status_history FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_ssh" ON shipment_status_history FOR DELETE
  TO authenticated USING (true);

-- MISSING INDEXES
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_product ON favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating DESC);
