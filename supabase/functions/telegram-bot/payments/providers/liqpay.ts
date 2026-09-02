import type {
  PaymentProvider,
  CreateInvoiceParams,
  CreateInvoiceResult,
  CheckStatusResult,
  RefundResult,
} from './payment-provider.ts';
import type { PaymentStatus } from './payment-provider.ts';

const LIQPAY_API = 'https://api.liqpay.ua/api/3';

async function base64Encode(str: string): Promise<string> {
  const bytes = new TextEncoder().encode(str);
  const binStr = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binStr);
}

async function sha1Base64(str: string): Promise<string> {
  const bytes = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-1', bytes);
  const binStr = Array.from(new Uint8Array(hash), (b) => String.fromCharCode(b)).join('');
  return btoa(binStr);
}

export function createLiqPayProvider(): PaymentProvider {
  const publicKey = Deno.env.get('LIQPAY_PUBLIC_KEY') || '';
  const privateKey = Deno.env.get('LIQPAY_PRIVATE_KEY') || '';

  return {
    name: 'liqpay',
    label: 'LiqPay',
    enabled: !!publicKey && !!privateKey,
    async createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult> {
      try {
        const data = {
          public_key: publicKey,
          action: 'pay',
          version: 3,
          amount: params.amount,
          currency: params.currency || 'UAH',
          description: params.description,
          order_id: params.orderId,
          result_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot`,
          server_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot`,
        };
        const dataB64 = await base64Encode(JSON.stringify(data));
        const signature = await sha1Base64(privateKey + dataB64 + privateKey);
        const resp = await fetch(`${LIQPAY_API}/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${dataB64}&signature=${signature}`,
        });
        const result = await resp.json();
        if (result.status === 'error' || result.status === 'failure') {
          return { ok: false, error: result.err_description || result.err_code };
        }
        const paymentUrl = `https://www.liqpay.ua/api/3/checkout?data=${dataB64}&signature=${signature}`;
        return {
          ok: true,
          paymentId: params.orderId,
          signature,
          paymentUrl,
          rawResponse: result,
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
    async checkStatus(paymentId: string): Promise<CheckStatusResult> {
      try {
        const data = {
          public_key: publicKey,
          action: 'status',
          version: 3,
          order_id: paymentId,
        };
        const dataB64 = await base64Encode(JSON.stringify(data));
        const signature = await sha1Base64(privateKey + dataB64 + privateKey);
        const resp = await fetch(`${LIQPAY_API}/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${dataB64}&signature=${signature}`,
        });
        const result = await resp.json();
        if (result.status === 'error') {
          return { ok: false, status: 'failed', error: result.err_description };
        }
        const status: PaymentStatus =
          result.status === 'success' || result.status === 'sandbox' ? 'paid' :
          result.status === 'failure' ? 'failed' :
          result.status === 'refunded' ? 'refunded' :
          result.status === 'expired' ? 'expired' : 'pending';
        return { ok: true, status, rawResponse: result };
      } catch (err) {
        return { ok: false, status: 'failed', error: err.message };
      }
    },
    async refund(paymentId: string, amount: number): Promise<RefundResult> {
      try {
        const data = {
          public_key: publicKey,
          action: 'refund',
          version: 3,
          order_id: paymentId,
          amount,
          currency: 'UAH',
        };
        const dataB64 = await base64Encode(JSON.stringify(data));
        const signature = await sha1Base64(privateKey + dataB64 + privateKey);
        const resp = await fetch(`${LIQPAY_API}/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${dataB64}&signature=${signature}`,
        });
        const result = await resp.json();
        if (result.status === 'error') {
          return { ok: false, error: result.err_description };
        }
        return { ok: true, rawResponse: result };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  };
}
