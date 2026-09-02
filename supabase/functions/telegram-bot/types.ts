export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: {
    id: number;
    type: string;
  };
  text?: string;
  photo?: { file_id: string; file_size: number; width: number; height: number }[];
  contact?: { phone_number: string; first_name: string };
}

export interface TelegramCallback {
  id: string;
  from: TelegramUser;
  message: TelegramMessage;
  data: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallback;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
}

export interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  web_app?: { url: string };
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  resize_keyboard: boolean;
  one_time_keyboard?: boolean;
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
}

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
  delivery_city_ref: string | null;
  delivery_city_name: string | null;
  delivery_warehouse_ref: string | null;
  delivery_warehouse_name: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
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
