import type {
  ShippingProvider,
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
} from '../shipping-provider.ts';
import { logError } from '../../telegram.ts';

const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/';
const API_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

function mapNpStatus(code: string): ShipmentStatus {
  const codeUpper = code.toUpperCase();
  if (codeUpper.includes('DELIVERED') || codeUpper === '106') return 'delivered';
  if (codeUpper.includes('REFUS') || codeUpper === '108') return 'refused';
  if (codeUpper.includes('CANCEL')) return 'cancelled';
  if (codeUpper.includes('ARRIVED') || codeUpper === '105' || codeUpper === '7' || codeUpper === '8') return 'arrived';
  if (codeUpper.includes('IN_TRANSIT') || codeUpper === '3' || codeUpper === '4' || codeUpper === '5' || codeUpper === '6' || codeUpper === '101' || codeUpper === '102' || codeUpper === '103' || codeUpper === '104') return 'in_transit';
  if (codeUpper.includes('ERROR')) return 'error';
  return 'in_transit';
}

function userFriendlyError(errors: string[] | undefined): string {
  if (!errors || errors.length === 0) return 'Служба доставки тимчасово недоступна. Спробуйте пізніше.';
  const msg = errors[0];
  if (msg.includes('API key')) return 'Помилка авторизації служби доставки. Зверніться до адміністратора.';
  if (msg.includes('timeout') || msg.includes('Timeout')) return 'Час очікування відповіді вичерпано. Спробуйте ще раз.';
  if (msg.includes('network') || msg.includes('Network')) return 'Мережева помилка. Перевірте підключення та спробуйте ще раз.';
  return 'Помилка служби доставки. Спробуйте пізніше.';
}

async function callApi(
  apiKey: string,
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      const resp = await fetch(NP_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await resp.json();
      if (!resp.ok) {
        await logError('novaposhta', `HTTP ${resp.status} from ${modelName}.${calledMethod}`, {
          context: { modelName, calledMethod, statusCode: resp.status },
        });
        return { success: false, errors: [`HTTP ${resp.status}`], data: [] };
      }
      return data;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      const isAbort = err.name === 'AbortError';
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
      await logError('novaposhta', `${isAbort ? 'Timeout' : 'Network error'} on ${modelName}.${calledMethod} (attempt ${attempt + 1})`, {
        context: { modelName, calledMethod, error: err.message },
        severity: isAbort ? 'warning' : 'error',
      });
    }
  }
  return {
    success: false,
    errors: [lastError?.name === 'AbortError' ? 'timeout' : 'network'],
    data: [],
  };
}

export function createNovaPoshtaProvider(): ShippingProvider {
  const apiKey = Deno.env.get('NOVA_POSHTA_API_KEY') || '';

  return {
    name: 'novaposhta',
    label: 'Nova Poshta',
    enabled: !!apiKey,

    async searchCities(params: SearchCitiesParams): Promise<{ ok: boolean; cities?: City[]; error?: string }> {
      if (!apiKey) return { ok: false, error: 'Nova Poshta не налаштована' };
      try {
        const data = await callApi(apiKey, 'Address', 'searchSettlements', {
          CityName: params.query,
          Limit: params.limit || 20,
        });
        if (!data.success) {
          return { ok: false, error: userFriendlyError(data.errors as string[]) };
        }
        const items = (data.data as Array<Array<Record<string, unknown>>>)?.[0]?.Addresses || [];
        const cities: City[] = items.map((item: Record<string, unknown>) => ({
          ref: item.Ref as string,
          name: item.Present as string,
          area: item.RegionDescription as string,
        }));
        return { ok: true, cities };
      } catch (err) {
        await logError('novaposhta', `searchCities unexpected: ${err.message}`, { context: { query: params.query } });
        return { ok: false, error: 'Помилка пошуку міст. Спробуйте пізніше.' };
      }
    },

    async searchWarehouses(params: SearchWarehousesParams): Promise<{ ok: boolean; warehouses?: Warehouse[]; error?: string }> {
      if (!apiKey) return { ok: false, error: 'Nova Poshta не налаштована' };
      try {
        const methodProperties: Record<string, unknown> = {
          CityName: params.cityRef,
          Language: 'UA',
        };
        if (params.type === 'parcel_locker') {
          methodProperties.TypeOfWarehouseRef = 'f9e07680-5f1a-11ee-b745-b42e99130c09';
        }
        if (params.query) {
          methodProperties.WarehouseName = params.query;
        }
        if (params.limit) {
          methodProperties.Limit = params.limit;
        }
        const data = await callApi(apiKey, 'AddressGeneral', 'getWarehouses', methodProperties);
        if (!data.success) {
          return { ok: false, error: userFriendlyError(data.errors as string[]) };
        }
        const items = (data.data as Array<Record<string, unknown>>) || [];
        const warehouses: Warehouse[] = items.map((item) => {
          const isLocker = item.TypeOfWarehouse === 'Поштомат' || !!item.PostFinance;
          return {
            ref: item.Ref as string,
            name: item.Description as string || item.DescriptionRu as string,
            cityRef: item.CityRef as string,
            cityName: item.CityDescription as string,
            type: isLocker ? 'parcel_locker' : 'warehouse',
            address: item.ShortAddress as string,
            number: item.Number as string,
          };
        });
        return { ok: true, warehouses };
      } catch (err) {
        await logError('novaposhta', `searchWarehouses unexpected: ${err.message}`, { context: { cityRef: params.cityRef } });
        return { ok: false, error: 'Помилка пошуку відділень. Спробуйте пізніше.' };
      }
    },

    async createWaybill(params: CreateWaybillParams): Promise<CreateWaybillResult> {
      if (!apiKey) return { ok: false, error: 'Nova Poshta не налаштована' };
      try {
        const senderRef = Deno.env.get('NOVA_POSHTA_SENDER_REF') || '';
        const senderCityRef = Deno.env.get('NOVA_POSHTA_SENDER_CITY_REF') || '';
        const senderWarehouseRef = Deno.env.get('NOVA_POSHTA_SENDER_WAREHOUSE_REF') || '';

        if (!senderRef || !senderCityRef || !senderWarehouseRef) {
          await logError('novaposhta', 'Cannot create waybill: sender details not configured', {
            context: { orderId: params.orderId },
          });
          return { ok: false, error: 'Дані відправника не налаштовані. Зверніться до адміністратора.' };
        }

        const phoneDigits = params.recipientPhone.replace(/[^0-9+]/g, '');
        const phone = phoneDigits.startsWith('+') ? phoneDigits : `+${phoneDigits}`;

        const data = await callApi(apiKey, 'InternetDocument', 'save', {
          PayerType: params.payerType,
          PaymentMethod: 'Cash',
          CargoType: 'Parcel',
          Weight: params.weight || 1,
          SeatsAmount: params.seatsAmount || 1,
          Description: params.description,
          Cost: params.cost,
          CitySender: senderCityRef,
          Sender: senderRef,
          SenderAddress: senderWarehouseRef,
          CityRecipient: params.cityRef,
          RecipientName: params.recipientName,
          RecipientType: 'PrivatePerson',
          RecipientPhone: phone,
          ServiceType: 'WarehouseWarehouse',
          RecipientAddress: params.warehouseRef,
          NewAddress: '1',
        });

        if (!data.success) {
          return { ok: false, error: userFriendlyError(data.errors as string[]), rawResponse: data };
        }

        const doc = (data.data as Array<Record<string, unknown>>)?.[0];
        if (!doc) {
          return { ok: false, error: 'Нової поштою не повернено документ', rawResponse: data };
        }

        return {
          ok: true,
          ttn: doc.IntDocNumber as string,
          ref: doc.Ref as string,
          cost: doc.CostOnSite ? Number(doc.CostOnSite) : undefined,
          rawResponse: data,
        };
      } catch (err) {
        await logError('novaposhta', `createWaybill unexpected: ${err.message}`, {
          context: { orderId: params.orderId },
        });
        return { ok: false, error: 'Не вдалося створити накладну. Спробуйте пізніше.' };
      }
    },

    async trackShipment(ttn: string): Promise<TrackShipmentResult> {
      if (!apiKey) return { ok: false, status: 'error', error: 'Nova Poshta не налаштована' };
      try {
        const data = await callApi(apiKey, 'TrackingDocument', 'getStatusDocuments', {
          Documents: [{ DocumentNumber: ttn }],
        });
        if (!data.success) {
          return { ok: false, status: 'error', error: userFriendlyError(data.errors as string[]) };
        }
        const doc = (data.data as Array<Record<string, unknown>>)?.[0];
        if (!doc) {
          return { ok: false, status: 'error', error: 'Дані відстеження відсутні' };
        }
        const statusCode = (doc.StatusCode as string) || '';
        const statusText = (doc.Status as string) || '';
        return {
          ok: true,
          status: mapNpStatus(statusCode),
          statusCode,
          statusText,
          rawResponse: doc,
        };
      } catch (err) {
        await logError('novaposhta', `trackShipment unexpected: ${err.message}`, { context: { ttn } });
        return { ok: false, status: 'error', error: 'Не вдалося отримати статус' };
      }
    },

    async getDocuments(ttn: string): Promise<GetDocumentsResult> {
      if (!apiKey) return { ok: false, error: 'Nova Poshta не налаштована' };
      try {
        const data = await callApi(apiKey, 'InternetDocument', 'generateReport', {
          DocumentRefs: ttn,
          Type: 'pdf',
        });
        if (!data.success) {
          return { ok: false, error: userFriendlyError(data.errors as string[]) };
        }
        const doc = (data.data as Array<Record<string, unknown>>)?.[0];
        if (!doc) {
          return { ok: false, error: 'Документи відсутні' };
        }
        const url = (doc.Url as string) || '';
        const fileData = (doc.Data as string) || '';
        return {
          ok: true,
          documents: [{ type: 'pdf', url, data: fileData }],
          rawResponse: doc,
        };
      } catch (err) {
        await logError('novaposhta', `getDocuments unexpected: ${err.message}`, { context: { ttn } });
        return { ok: false, error: 'Не вдалося отримати документи' };
      }
    },

    async cancelWaybill(ref: string): Promise<CancelWaybillResult> {
      if (!apiKey) return { ok: false, error: 'Nova Poshta не налаштована' };
      try {
        const data = await callApi(apiKey, 'InternetDocument', 'delete', {
          DocumentRefs: ref,
        });
        if (!data.success) {
          return { ok: false, error: userFriendlyError(data.errors as string[]) };
        }
        return { ok: true, rawResponse: data };
      } catch (err) {
        await logError('novaposhta', `cancelWaybill unexpected: ${err.message}`, { context: { ref } });
        return { ok: false, error: 'Не вдалося скасувати накладну' };
      }
    },
  };
}

export async function checkNovaPoshtaHealth(): Promise<{ ok: boolean; detail: string }> {
  const apiKey = Deno.env.get('NOVA_POSHTA_API_KEY');
  if (!apiKey) return { ok: false, detail: 'not configured' };
  const senderRef = Deno.env.get('NOVA_POSHTA_SENDER_REF');
  const senderCityRef = Deno.env.get('NOVA_POSHTA_SENDER_CITY_REF');
  const senderWarehouseRef = Deno.env.get('NOVA_POSHTA_SENDER_WAREHOUSE_REF');
  if (!senderRef || !senderCityRef || !senderWarehouseRef) {
    return { ok: false, detail: 'API key set but sender details missing' };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(NP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        modelName: 'Common',
        calledMethod: 'getMessageCodeText',
        methodProperties: {},
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) return { ok: false, detail: `HTTP ${resp.status}` };
    const data = await resp.json();
    return { ok: !!data.success, detail: data.success ? 'connected' : 'API returned error' };
  } catch (err) {
    return { ok: false, detail: err.name === 'AbortError' ? 'timeout' : err.message };
  }
}
