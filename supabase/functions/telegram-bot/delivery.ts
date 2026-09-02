import { supabase, tgSendMessage, logError } from './telegram.ts';
import { backKeyboard } from './keyboards.ts';
import type { Order } from './types.ts';

const DELIVERY_API_URL = 'https://api.novaposhta.ua/v2.0/json/';
const DELIVERY_API_KEY = Deno.env.get('NOVA_POSHTA_API_KEY') || '';

export async function trackDelivery(chatId: number, ttn: string): Promise<void> {
  if (!ttn) {
    await tgSendMessage(chatId, 'ТТН не вказано для цього замовлення.');
    return;
  }
  let statusText = 'Статус невідомий';
  if (DELIVERY_API_KEY) {
    try {
      const resp = await fetch(DELIVERY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: DELIVERY_API_KEY,
          modelName: 'TrackingDocument',
          calledMethod: 'getStatusDocuments',
          methodProperties: { Documents: [{ DocumentNumber: ttn }] },
        }),
      });
      const data = await resp.json();
      if (data?.data?.[0]) {
        const doc = data.data[0];
        statusText = doc.Status || 'В дорозі';
      }
    } catch (err) {
      await logError('nova_poshta', err.message || 'Nova Poshta API error', { context: { ttn } });
      statusText = 'Не вдалося отримати статус';
    }
  } else {
    statusText = 'Інтеграція зі службою доставки не налаштована. Ваш ТТН: ' + ttn;
  }
  await tgSendMessage(
    chatId,
    `📮 <b>Відстеження доставки</b>\n\nТТН: ${ttn}\nСтатус: ${statusText}`,
    backKeyboard('menu'),
  );
}

export async function showTrackingByOrder(chatId: number, orderId: string): Promise<void> {
  const { data: order } = await supabase
    .from('orders')
    .select('ttn, number')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) {
    await tgSendMessage(chatId, 'Замовлення не знайдено.');
    return;
  }
  const o = order as Pick<Order, 'ttn' | 'number'>;
  if (!o.ttn) {
    await tgSendMessage(chatId, `Замовлення №${o.number} ще не відправлено (ТТН відсутній).`);
    return;
  }
  await trackDelivery(chatId, o.ttn);
}
