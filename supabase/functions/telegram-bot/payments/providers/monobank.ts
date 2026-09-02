import type {
  PaymentProvider,
  PaymentProviderName,
  CreateInvoiceParams,
  CreateInvoiceResult,
  CheckStatusResult,
  RefundResult,
} from './payment-provider.ts';

const MONOBANK_API = 'https://api.monobank.ua/api/merchant';

export function createMonobankProvider(): PaymentProvider {
  const token = Deno.env.get('MONOBANK_TOKEN') || '';
  return {
    name: 'monobank',
    label: 'Monobank',
    enabled: !!token,
    async createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult> {
      try {
        const resp = await fetch(`${MONOBANK_API}/invoice/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Token': token,
          },
          body: JSON.stringify({
            amount: Math.round(params.amount * 100),
            ccy: 980,
            merchantPayInfo: {
              reference: params.orderId,
              destination: params.description,
            },
            redirectUrl: params.returnUrl,
            webHookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot`,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          return { ok: false, error: data?.errText || `HTTP ${resp.status}` };
        }
        return {
          ok: true,
          invoiceId: data.invoiceId,
          paymentId: data.invoiceId,
          paymentUrl: `https://pay.monobank.ua/?bill=${data.invoiceId}`,
          rawResponse: data,
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
    async checkStatus(paymentId: string): Promise<CheckStatusResult> {
      try {
        const resp = await fetch(`${MONOBANK_API}/invoice/status?invoice=${paymentId}`, {
          headers: { 'X-Token': token },
        });
        const data = await resp.json();
        if (!resp.ok) return { ok: false, status: 'failed', error: data?.errText || `HTTP ${resp.status}` };
        const status: PaymentStatus =
          data.status === 'success' ? 'paid' :
          data.status === 'processing' ? 'pending' :
          data.status === 'failure' ? 'failed' :
          data.status === 'expired' ? 'expired' : 'pending';
        return { ok: true, status, rawResponse: data };
      } catch (err) {
        return { ok: false, status: 'failed', error: err.message };
      }
    },
    async refund(paymentId: string, _amount: number): Promise<RefundResult> {
      return { ok: false, error: 'Monobank refunds must be processed via merchant portal' };
    },
  };
}
