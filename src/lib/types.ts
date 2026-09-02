export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  brand: string | null;
  description: string | null;
  price: number;
  old_price: number | null;
  stock: number;
  rating: number;
  country: string | null;
  volume: string | null;
  sku: string | null;
  barcode: string | null;
  image_path: string | null;
  is_new: boolean;
  is_hit: boolean;
  is_eco: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  number: string;
  bot_user_id: string | null;
  status: string;
  total: number;
  bonus_used: number;
  delivery_method: string | null;
  payment_method: string | null;
  address: string | null;
  ttn: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
  image_path: string | null;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: string;
  note: string | null;
  created_at: string;
}

export interface Broadcast {
  id: string;
  message: string;
  segment: string;
  status: string;
  created_by: number | null;
  created_at: string;
  sent_count: number;
  failed_count: number;
}

export interface BotUser {
  id: string;
  telegram_id: number;
  user_id: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean;
  is_blocked: boolean;
  last_activity: string;
  created_at: string;
}

export interface LoyaltyAccount {
  id: string;
  bot_user_id: string;
  balance: number;
}

export interface AnalyticsEvent {
  id: string;
  bot_user_id: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

export const STATUS_LABELS: Record<string, string> = {
  new: 'Нове',
  confirmed: 'Підтверджено',
  paid: 'Оплачено',
  shipped: 'Відправлено',
  delivered: 'Доставлено',
  cancelled: 'Скасовано',
};

export const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-cyan-100 text-cyan-700',
  shipped: 'bg-amber-100 text-amber-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};
