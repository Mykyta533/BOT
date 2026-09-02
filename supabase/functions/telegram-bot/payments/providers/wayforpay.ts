import type {
  PaymentProvider,
  CreateInvoiceParams,
  CreateInvoiceResult,
  CheckStatusResult,
  RefundResult,
} from './payment-provider.ts';
import type { PaymentStatus } from './payment-provider.ts';

const WFP_API = 'https://api.wayforpay.com/api';

export function createWayForPayProvider(): PaymentProvider {
  const merchantAccount = Deno.env.get('WAYFORPAY_MERCHANT_ACCOUNT') || '';
  const merchantSecretKey = Deno.env.get('WAYFORPAY_MERCHANT_SECRET_KEY') || '';

  async function generateSignature(data: Record<string, string | number>): Promise<string> {
    const values = Object.values(data).join('|');
    const bytes = new TextEncoder().encode(`${merchantSecretKey}|${values}`);
    const hash = await crypto.subtle.digest('MD5', bytes);
    return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  return {
    name: 'wayforpay',
    label: 'WayForPay',
    enabled: !!merchantAccount && !!merchantSecretKey,
    async createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult> {
      try {
        const orderDate = Math.floor(Date.now() / 1000);
        const requestData = {
          transactionType: 'CREATE',
          merchantAccount,
          merchantAuthType: 'simpleSignature',
          merchantDomainName: Deno.env.get('WAYFORPAY_DOMAIN') || '',
          orderReference: params.orderId,
          orderDate,
          amount: params.amount,
          currency: params.currency || 'UAH',
          productName: [params.description],
          productPrice: [params.amount],
          productCount: [1],
          serviceUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot`,
          returnUrl: params.returnUrl,
        };
        const signature = await generateSignature(requestData);
        const resp = await fetch(`${WFP_API}/v2/invoice/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...requestData, merchantSignature: signature }),
        });
        const result = await resp.json();
        if (result.transactionStatus !== 'Approved' && !result.invoiceUrl) {
          return { ok: false, error: result.reason || `HTTP ${resp.status}` };
        }
        return {
          ok: true,
          invoiceId: result.invoiceReference,
          paymentId: params.orderId,
          paymentUrl: result.invoiceUrl,
          signature,
          rawResponse: result,
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
    async checkStatus(paymentId: string): Promise<CheckStatusResult> {
      try {
        const requestData = {
          transactionType: 'STATUS',
          merchantAccount,
          orderReference: paymentId,
        };
        const signature = await generateSignature(requestData);
        const resp = await fetch(`${WFP_API}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...requestData, merchantSignature: signature }),
        });
        const result = await resp.json();
        const status: PaymentStatus =
          result.transactionStatus === 'Approved' ? 'paid' :
          result.transactionStatus === 'Declined' ? 'failed' :
          result.transactionStatus === 'Refunded' ? 'refunded' :
          result.transactionStatus === 'InProcessing' ? 'pending' : 'pending';
        return { ok: true, status, rawResponse: result };
      } catch (err) {
        return { ok: false, status: 'failed', error: err.message };
      }
    },
    async refund(paymentId: string, amount: number): Promise<RefundResult> {
      try {
        const requestData = {
          transactionType: 'REFUND',
          merchantAccount,
          orderReference: paymentId,
          amount,
          currency: 'UAH',
        };
        const signature = await generateSignature(requestData);
        const resp = await fetch(`${WFP_API}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...requestData, merchantSignature: signature }),
        });
        const result = await resp.json();
        if (result.transactionStatus !== 'Approved') {
          return { ok: false, error: result.reason || 'Refund failed' };
        }
        return { ok: true, rawResponse: result };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  };
}
