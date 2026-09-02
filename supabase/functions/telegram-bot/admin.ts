import { supabase, tgSendMessage } from './telegram.ts';
import { backKeyboard } from './keyboards.ts';
import { notifyOrderEvent } from './notifications.ts';
import type { Order } from './types.ts';

const pendingTtn = new Map<number, string>();

export async function adminConfirmOrder(chatId: number, orderId: string): Promise<void> {
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
  if (o.status === 'confirmed' || o.status === 'shipped' || o.status === 'delivered') {
    await tgSendMessage(chatId, `⚠️ Замовлення №${o.number} вже має статус «${o.status}».`);
    return;
  }
  if (o.status === 'cancelled') {
    await tgSendMessage(chatId, `❌ Замовлення №${o.number} скасовано. Його не можна підтвердити.`);
    return;
  }
  await supabase.from('orders').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', orderId);
  await supabase.from('order_status_history').insert({ order_id: orderId, status: 'confirmed' });
  await notifyOrderEvent(o, 'status', 'Замовлення підтверджено. Очікуйте на відправку.');
  await tgSendMessage(chatId, `✅ Замовлення №${o.number} підтверджено.`);
}

export async function adminShipOrder(chatId: number, orderId: string): Promise<void> {
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
  if (o.status === 'shipped' || o.status === 'delivered') {
    await tgSendMessage(chatId, `⚠️ Замовлення №${o.number} вже відправлено (статус: ${o.status}).`);
    return;
  }
  if (o.status === 'cancelled') {
    await tgSendMessage(chatId, `❌ Замовлення №${o.number} скасовано. Його не можна відправити.`);
    return;
  }
  await supabase.from('orders').update({ status: 'shipped', updated_at: new Date().toISOString() }).eq('id', orderId);
  await supabase.from('order_status_history').insert({ order_id: orderId, status: 'shipped' });
  await notifyOrderEvent(o, 'shipped', o.ttn ? `Відправка: ${o.ttn}` : undefined);
  await tgSendMessage(chatId, `📦 Замовлення №${o.number} позначено як відправлене.`);
}

export async function adminCancelOrder(chatId: number, orderId: string): Promise<void> {
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
  if (o.status === 'cancelled') {
    await tgSendMessage(chatId, `⚠️ Замовлення №${o.number} вже скасовано.`);
    return;
  }
  if (o.status === 'delivered') {
    await tgSendMessage(chatId, `⚠️ Замовлення №${o.number} вже доставлено. Його не можна скасувати.`);
    return;
  }
  await supabase.from('orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', orderId);
  await supabase.from('order_status_history').insert({ order_id: orderId, status: 'cancelled' });
  await notifyOrderEvent(o, 'cancelled');
  await tgSendMessage(chatId, `❌ Замовлення №${o.number} скасовано.`);
}

export async function adminStartTtn(chatId: number, orderId: string): Promise<void> {
  const { data: order } = await supabase
    .from('orders')
    .select('status, number')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) {
    await tgSendMessage(chatId, 'Замовлення не знайдено.');
    return;
  }
  const o = order as Pick<Order, 'status' | 'number'>;
  if (o.status === 'cancelled') {
    await tgSendMessage(chatId, `❌ Замовлення №${o.number} скасовано. ТТН не можна додати.`);
    return;
  }
  if (o.status === 'delivered') {
    await tgSendMessage(chatId, `⚠️ Замовлення №${o.number} вже доставлено.`);
    return;
  }
  pendingTtn.set(chatId, orderId);
  await tgSendMessage(
    chatId,
    '📮 Введіть номер ТТН (декларації):',
    backKeyboard('admin_cancel_ttn'),
  );
}

export async function adminSetTtn(chatId: number, ttn: string): Promise<boolean> {
  const orderId = pendingTtn.get(chatId);
  if (!orderId) return false;
  pendingTtn.delete(chatId);
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return true;
  const o = order as Order;
  if (o.status === 'cancelled') {
    await tgSendMessage(chatId, `❌ Замовлення №${o.number} скасовано. ТТН не можна додати.`);
    return true;
  }
  await supabase.from('orders').update({ ttn, updated_at: new Date().toISOString() }).eq('id', orderId);
  await supabase.from('order_status_history').insert({ order_id: orderId, status: 'shipped', note: `ТТН: ${ttn}` });
  await notifyOrderEvent({ ...o, ttn }, 'shipped', `Номер декларації: ${ttn}`);
  await tgSendMessage(chatId, `✅ ТТН ${ttn} додано до замовлення №${o.number}.`);
  return true;
}

export function isPendingTtn(chatId: number): boolean {
  return pendingTtn.has(chatId);
}

export function cancelTtn(chatId: number): boolean {
  return pendingTtn.delete(chatId);
}
