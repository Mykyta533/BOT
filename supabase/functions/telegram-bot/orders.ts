import { supabase, tgSendMessage, tgEditMessage, logEvent } from './telegram.ts';
import { paginatedKeyboard, backKeyboard } from './keyboards.ts';
import type { Order, OrderItem, OrderStatusHistory } from './types.ts';

const PER_PAGE = 10;

const STATUS_LABELS: Record<string, string> = {
  new: '🆕 Нове',
  confirmed: '✅ Підтверджено',
  paid: '💳 Оплачено',
  shipped: '📦 Відправлено',
  delivered: '📬 Доставлено',
  cancelled: '❌ Скасовано',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

export async function showOrders(
  chatId: number,
  page: number,
  botUserId: string,
  messageId?: number,
): Promise<void> {
  const { data, count } = await supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('bot_user_id', botUserId)
    .order('created_at', { ascending: false })
    .range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1);
  const orders = (data || []) as Order[];
  const total = count || 0;
  const totalPages = Math.ceil(total / PER_PAGE) || 1;
  if (!orders.length) {
    const text = '📦 <b>Мої замовлення</b>\n\nУ вас поки немає замовлень.';
    if (messageId) {
      await tgEditMessage(chatId, messageId, text, backKeyboard('menu'));
    } else {
      await tgSendMessage(chatId, text, backKeyboard('menu'));
    }
    return;
  }
  const items = orders.map((o) => ({
    id: o.id,
    label: `№${o.number} | ${statusLabel(o.status)} | ${o.total} грн | ${new Date(o.created_at).toLocaleDateString('uk-UA')}`,
  }));
  const kb = paginatedKeyboard(items, page, PER_PAGE, 'order', 'menu');
  const text = `📦 <b>Мої замовлення</b> (${total})\n\nСторінка ${page + 1}/${totalPages}:`;
  if (messageId) {
    await tgEditMessage(chatId, messageId, text, kb);
  } else {
    await tgSendMessage(chatId, text, kb);
  }
}

export async function showOrderDetails(
  chatId: number,
  orderId: string,
  botUserId: string,
  messageId?: number,
): Promise<void> {
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) {
    await tgSendMessage(chatId, 'Замовлення не знайдено.');
    return;
  }
  const o = order as Order;
  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);
  const { data: history } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  const orderItems = (items || []) as OrderItem[];
  const statusHistory = (history || []) as OrderStatusHistory[];
  const itemLines = orderItems
    .map((it) => `  • ${it.name} ×${it.quantity} = ${it.price * it.quantity} грн`)
    .join('\n');
  const historyLines = statusHistory
    .map((h) => `  ${new Date(h.created_at).toLocaleString('uk-UA')} — ${statusLabel(h.status)}${h.note ? ` (${h.note})` : ''}`)
    .join('\n');
  const lines = [
    `📦 <b>Замовлення №${o.number}</b>`,
    `Статус: ${statusLabel(o.status)}`,
    `Дата: ${new Date(o.created_at).toLocaleString('uk-UA')}`,
    '',
    '<b>Товари:</b>',
    itemLines || '  (порожньо)',
    '',
    `💰 Сума: ${o.total} грн${o.bonus_used ? ` (бонуси: -${o.bonus_used} грн)` : ''}`,
    o.delivery_method ? `🚚 Доставка: ${o.delivery_method}` : '',
    o.payment_method ? `💳 Оплата: ${o.payment_method}` : '',
    o.address ? `📍 Адреса: ${o.address}` : '',
    o.ttn ? `📮 ТТН: ${o.ttn}` : '',
    o.customer_name ? `👤 Ім\u2019я: ${o.customer_name}` : '',
    o.customer_phone ? `📞 Телефон: ${o.customer_phone}` : '',
    '',
    '<b>Історія статусів:</b>',
    historyLines || '  (порожньо)',
  ].filter(Boolean);
  const text = lines.join('\n');
  await logEvent(botUserId, 'order_view', { order_id: orderId });
  if (messageId) {
    await tgEditMessage(chatId, messageId, text, backKeyboard('orders:0'));
  } else {
    await tgSendMessage(chatId, text, backKeyboard('orders:0'));
  }
}
