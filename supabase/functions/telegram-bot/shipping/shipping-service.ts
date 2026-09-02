import type {
  ShippingProvider,
  ShippingProviderName,
  SearchCitiesParams,
  SearchWarehousesParams,
  City,
  Warehouse,
  CreateWaybillParams,
  CreateWaybillResult,
  TrackShipmentResult,
  GetDocumentsResult,
  CancelWaybillResult,
  ShipmentStatus,
} from './shipping-provider.ts';
import { createNovaPoshtaProvider } from './providers/novaposhta.ts';
import { supabase, logError, tgSendMessage } from '../telegram.ts';
import { notifyOrderEvent } from '../notifications.ts';
import type { Order } from '../types.ts';

const providers: Partial<Record<ShippingProviderName, ShippingProvider>> = {};

function getProvider(name: ShippingProviderName): ShippingProvider {
  if (providers[name]) return providers[name]!;
  switch (name) {
    case 'novaposhta':
      providers[name] = createNovaPoshtaProvider();
      break;
  }
  return providers[name]!;
}

export async function getEnabledShippingProviders(): Promise<ShippingProvider[]> {
  const all: ShippingProviderName[] = ['novaposhta'];
  const enabled: ShippingProvider[] = [];
  for (const name of all) {
    const provider = getProvider(name);
    const { data } = await supabase
      .from('bot_settings')
      .select('value')
      .eq('key', `shipping_${name}_enabled`)
      .maybeSingle();
    const settingEnabled = data?.value === 'true';
    if (settingEnabled && provider.enabled) {
      enabled.push(provider);
    }
  }
  return enabled;
}

export async function searchCities(
  providerName: ShippingProviderName,
  params: SearchCitiesParams,
): Promise<{ ok: boolean; cities?: City[]; error?: string }> {
  const provider = getProvider(providerName);
  if (!provider.enabled) return { ok: false, error: 'Службу доставки не налаштовано' };
  return provider.searchCities(params);
}

export async function searchWarehouses(
  providerName: ShippingProviderName,
  params: SearchWarehousesParams,
): Promise<{ ok: boolean; warehouses?: Warehouse[]; error?: string }> {
  const provider = getProvider(providerName);
  if (!provider.enabled) return { ok: false, error: 'Службу доставки не налаштовано' };
  return provider.searchWarehouses(params);
}

export interface CreateShipmentValidation {
  ok: boolean;
  error?: string;
  order?: Order;
}

export async function validateOrderForShipment(orderId: string): Promise<CreateShipmentValidation> {
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: 'Замовлення не знайдено' };
  const o = order as Order;

  if (o.status === 'cancelled') return { ok: false, error: 'Замовлення скасовано' };
  if (o.status === 'delivered') return { ok: false, error: 'Замовлення вже доставлено' };

  const { data: existingShipment } = await supabase
    .from('shipments')
    .select('id, ttn')
    .eq('order_id', orderId)
    .not('status', 'eq', 'cancelled')
    .maybeSingle();
  if (existingShipment) {
    return { ok: false, error: `ТТН вже створена: ${existingShipment.ttn || 'очікує'}` };
  }

  if (!o.delivery_city_ref) return { ok: false, error: 'Не вказано місто доставки' };
  if (!o.delivery_warehouse_ref) return { ok: false, error: 'Не вказано відділення доставки' };
  if (!o.recipient_name && !o.customer_name) return { ok: false, error: 'Не вказано ім\'я отримувача' };
  if (!o.recipient_phone && !o.customer_phone) return { ok: false, error: 'Не вказано телефон отримувача' };
  if (!o.total || Number(o.total) <= 0) return { ok: false, error: 'Сума замовлення некоректна' };

  return { ok: true, order: o };
}

export async function createShipment(
  providerName: ShippingProviderName,
  params: CreateWaybillParams,
): Promise<{ shipmentId: string | null; result: CreateWaybillResult }> {
  const validation = await validateOrderForShipment(params.orderId);
  if (!validation.ok || !validation.order) {
    return { shipmentId: null, result: { ok: false, error: validation.error || 'Помилка валідації' } };
  }

  const provider = getProvider(providerName);
  if (!provider.enabled) {
    return { shipmentId: null, result: { ok: false, error: 'Службу доставки не налаштовано' } };
  }

  const result = await provider.createWaybill(params);
  if (!result.ok) {
    await logError('shipping', `Failed to create waybill: ${result.error || 'unknown'}`, {
      context: { provider: providerName, orderId: params.orderId },
    });
    return { shipmentId: null, result };
  }

  const { data, error } = await supabase
    .from('shipments')
    .insert({
      order_id: params.orderId,
      provider: providerName,
      ttn: result.ttn || null,
      ref: result.ref || null,
      status: 'created',
      cost: result.cost || null,
      response_json: result.rawResponse || null,
    })
    .select('id')
    .single();
  if (error || !data) {
    await logError('shipping', `Failed to save shipment: ${error?.message || 'unknown'}`, {
      context: { provider: providerName, orderId: params.orderId, ttn: result.ttn },
    });
    return { shipmentId: null, result: { ok: false, error: 'Помилка збереження відправлення' } };
  }

  await supabase.from('shipment_status_history').insert({
    shipment_id: data.id,
    status: 'created',
    note: 'Waybill created via API',
  });

  if (result.ttn) {
    await supabase
      .from('orders')
      .update({
        ttn: result.ttn,
        status: 'shipped',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.orderId);
    await supabase.from('order_status_history').insert({
      order_id: params.orderId,
      status: 'shipped',
      note: `TTN: ${result.ttn} (${providerName})`,
    });
    await supabase.from('activity_log').insert({
      event_type: 'shipment_created',
      event_data: { order_id: params.orderId, ttn: result.ttn, provider: providerName },
    });

    const order = validation.order;
    order.ttn = result.ttn;
    order.status = 'shipped';
    await notifyOrderEvent(order, 'shipped', `Номер декларації: ${result.ttn}`);
  }

  return { shipmentId: data.id, result };
}

export async function updateShipmentStatus(
  shipmentId: string,
  status: ShipmentStatus,
  rawResponse?: Record<string, unknown>,
  note?: string,
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
  };
  if (rawResponse) {
    updates.response_json = rawResponse;
    if ((rawResponse as Record<string, unknown>).StatusCode) {
      updates.provider_status_code = (rawResponse as Record<string, unknown>).StatusCode;
    }
    if ((rawResponse as Record<string, unknown>).Status) {
      updates.provider_status_text = (rawResponse as Record<string, unknown>).Status;
    }
  }
  if (status === 'delivered') updates.delivered_at = new Date().toISOString();
  await supabase.from('shipments').update(updates).eq('id', shipmentId);
  await supabase.from('shipment_status_history').insert({
    shipment_id: shipmentId,
    status,
    note: note || null,
  });
}

const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  created: 'Створено',
  in_transit: '🚚 У дорозі',
  arrived: '🏤 Прибуло у відділення',
  delivered: '✅ Доставлено',
  refused: '❌ Відмова',
  cancelled: 'Скасовано',
  error: 'Помилка',
};

export async function trackShipment(shipmentId: string): Promise<TrackShipmentResult> {
  const { data: shipment } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', shipmentId)
    .maybeSingle();
  if (!shipment) return { ok: false, status: 'error', error: 'Відправлення не знайдено' };
  const provider = getProvider(shipment.provider as ShippingProviderName);
  if (!shipment.ttn) return { ok: false, status: 'error', error: 'TTN відсутня' };

  const result = await provider.trackShipment(shipment.ttn);

  await supabase
    .from('shipments')
    .update({ last_checked_at: new Date().toISOString() })
    .eq('id', shipmentId);

  if (result.ok && result.status !== shipment.status) {
    await updateShipmentStatus(shipmentId, result.status, result.rawResponse, result.statusText || 'Status check');

    if (shipment.order_id) {
      if (result.status === 'delivered') {
        await supabase
          .from('orders')
          .update({ status: 'delivered', updated_at: new Date().toISOString() })
          .eq('id', shipment.order_id);
        await supabase.from('order_status_history').insert({
          order_id: shipment.order_id,
          status: 'delivered',
          note: 'Auto: shipment delivered',
        });
      } else if (result.status === 'refused') {
        await supabase
          .from('orders')
          .update({ status: 'new', updated_at: new Date().toISOString() })
          .eq('id', shipment.order_id);
        await supabase.from('order_status_history').insert({
          order_id: shipment.order_id,
          status: 'new',
          note: 'Auto: shipment refused',
        });
      }

      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', shipment.order_id)
        .maybeSingle();
      if (order) {
        const o = order as Order;
        if (result.status === 'arrived') {
          const { data: botUser } = await supabase
            .from('bot_users')
            .select('telegram_id')
            .eq('id', o.bot_user_id)
            .maybeSingle();
          if (botUser) {
            await tgSendMessage(
              botUser.telegram_id,
              `📦 <b>Ваша посилка вже у відділенні!</b>\n\nTTN: ${shipment.ttn}\n\nНе забудьте забрати замовлення.`,
            );
          }
        } else if (result.status === 'in_transit' || result.status === 'delivered') {
          await notifyOrderEvent(o, result.status === 'delivered' ? 'delivered' : 'status',
            `Статус доставки: ${SHIPMENT_STATUS_LABELS[result.status]}\nTTN: ${shipment.ttn}`);
        }
      }
    }
  }
  return result;
}

export async function getShipmentDocuments(shipmentId: string): Promise<GetDocumentsResult> {
  const { data: shipment } = await supabase
    .from('shipments')
    .select('provider, ttn')
    .eq('id', shipmentId)
    .maybeSingle();
  if (!shipment) return { ok: false, error: 'Відправлення не знайдено' };
  const provider = getProvider(shipment.provider as ShippingProviderName);
  if (!shipment.ttn) return { ok: false, error: 'TTN відсутня' };
  return provider.getDocuments(shipment.ttn);
}

export async function cancelShipment(shipmentId: string): Promise<CancelWaybillResult> {
  const { data: shipment } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', shipmentId)
    .maybeSingle();
  if (!shipment) return { ok: false, error: 'Відправлення не знайдено' };
  if (shipment.status === 'delivered' || shipment.status === 'cancelled') {
    return { ok: false, error: `Відправлення вже ${shipment.status === 'delivered' ? 'доставлено' : 'скасовано'}` };
  }
  const provider = getProvider(shipment.provider as ShippingProviderName);
  if (!shipment.ref) return { ok: false, error: 'Ref накладної відсутній' };
  const result = await provider.cancelWaybill(shipment.ref);
  if (result.ok) {
    await updateShipmentStatus(shipmentId, 'cancelled', result.rawResponse, 'Waybill cancelled via API');
  }
  return result;
}

export async function trackShipmentByTtn(ttn: string): Promise<TrackShipmentResult> {
  const { data: shipment } = await supabase
    .from('shipments')
    .select('id')
    .eq('ttn', ttn)
    .maybeSingle();
  if (shipment) return trackShipment(shipment.id);
  const provider = getProvider('novaposhta');
  return provider.trackShipment(ttn);
}

export { getProvider };
export type {
  ShippingProvider,
  ShippingProviderName,
  ShipmentStatus,
  SearchCitiesParams,
  SearchWarehousesParams,
  City,
  Warehouse,
  CreateWaybillParams,
  CreateWaybillResult,
  TrackShipmentResult,
  GetDocumentsResult,
  CancelWaybillResult,
};
