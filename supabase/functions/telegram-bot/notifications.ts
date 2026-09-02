import { supabase } from './telegram.ts';
import { tgSendMessage } from './telegram.ts';
import { statusLabel } from './orders.ts';
import type { Order } from './types.ts';

export async function notifyOrderEvent(
  order: Order,
  event: 'created' | 'paid' | 'status' | 'shipped' | 'delivered' | 'cancelled',
  extra?: string,
): Promise<void> {
  if (!order.bot_user_id) return;
  const { data: botUser } = await supabase
    .from('bot_users')
    .select('telegram_id')
    .eq('id', order.bot_user_id)
    .maybeSingle();
  if (!botUser) return;
  const messages: Record<typeof event, string> = {
    created: `🛒 <b>Замовлення №${order.number} створено</b>\n\nСума: ${order.total} грн\nДякуємо за замовлення! Ми скоро зв'яжемося з вами.`,
    paid: `💳 <b>Замовлення №${order.number} оплачено</b>\n\nОплата отримана. Готуємо ваше замовлення до відправки.`,
    status: `📋 <b>Статус замовлення №${order.number} оновлено</b>\n\nНовий статус: ${statusLabel(order.status)}${extra ? `\n${extra}` : ''}`,
    shipped: `📦 <b>Замовлення №${order.number} відправлено</b>\n${order.ttn ? `\n📮 ТТН: ${order.ttn}` : ''}${extra ? `\n${extra}` : ''}`,
    delivered: `📬 <b>Замовлення №${order.number} доставлено</b>\n\nДякуємо за покупку! Будемо раді бачити вас знову.`,
    cancelled: `❌ <b>Замовлення №${order.number} скасовано</b>${extra ? `\n\nПричина: ${extra}` : ''}`,
  };
  await tgSendMessage(botUser.telegram_id, messages[event]);
}

export async function notifyAdminsNewOrder(order: Order): Promise<void> {
  const { data: admins } = await supabase.from('admin_users').select('telegram_id');
  if (!admins) return;
  const text = `🔔 <b>Нове замовлення №${order.number}</b>\n\nСума: ${order.total} грн\nКлієнт: ${order.customer_name || '—'}\nТелефон: ${order.customer_phone || '—'}`;
  for (const admin of admins) {
    await tgSendMessage(admin.telegram_id, text, {
      inline_keyboard: [
        [
          { text: '✅ Підтвердити', callback_data: `admin_confirm:${order.id}` },
          { text: '❌ Скасувати', callback_data: `admin_cancel:${order.id}` },
        ],
        [
          { text: '📦 Відправлено', callback_data: `admin_ship:${order.id}` },
          { text: '📮 Додати ТТН', callback_data: `admin_ttn:${order.id}` },
        ],
      ],
    });
  }
}
