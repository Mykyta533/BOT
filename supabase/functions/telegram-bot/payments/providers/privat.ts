import type {
  PaymentProvider,
  CreateInvoiceParams,
  CreateInvoiceResult,
  CheckStatusResult,
  RefundResult,
} from './payment-provider.ts';
import type { PaymentStatus } from './payment-provider.ts';

const PRIVAT_API = 'https://api.privatbank.ua';

export function createPrivatProvider(): PaymentProvider {
  const merchantId = Deno.env.get('PRIVAT_MERCHANT_ID') || '';
  const merchantPassword = Deno.env.get('PRIVAT_MERCHANT_PASSWORD') || '';

  async function generateSignature(data: string): Promise<string> {
    const bytes = new TextEncoder().encode(`${merchantPassword}${data}${merchantPassword}`);
    const hash = await crypto.subtle.digest('SHA-1', bytes);
    return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  return {
    name: 'privat',
    label: 'PrivatBank',
    enabled: !!merchantId && !!merchantPassword,
    async createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult> {
      try {
        const orderId = params.orderId;
        const amountStr = params.amount.toFixed(2);
        const signature = await generateSignature(`${orderId}${amountStr}${params.currency || 'UAH'}`);
        const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<request version="1.0">
  <merchant>
    <id>${merchantId}</id>
    <signature>${signature}</signature>
  </merchant>
  <data>
    <oper>prp</oper>
    <wait>0</wait>
    <test>0</test>
    <payment id="${orderId}">
      <name>${params.description}</name>
      <sum>${amountStr}</sum>
      <ccy>${params.currency || 'UAH'}</ccy>
    </payment>
    <result_url>${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot</result_url>
  </data>
</request>`;
        const resp = await fetch(`${PRIVAT_API}/api/p24business/rest_p24`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/xml' },
          body: xmlBody,
        });
        const text = await resp.text();
        return {
          ok: resp.ok,
          paymentId: orderId,
          paymentUrl: `https://www.privat24.ua/qr/${orderId}`,
          signature,
          rawResponse: { xml: text },
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
    async checkStatus(paymentId: string): Promise<CheckStatusResult> {
      try {
        const signature = await generateSignature(paymentId);
        const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<request version="1.0">
  <merchant>
    <id>${merchantId}</id>
    <signature>${signature}</signature>
  </merchant>
  <data>
    <oper>prp</oper>
    <id>${paymentId}</id>
  </data>
</request>`;
        const resp = await fetch(`${PRIVAT_API}/api/p24business/rest_p24`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/xml' },
          body: xmlBody,
        });
        const text = await resp.text();
        const status: PaymentStatus = text.includes('<status>ok</status>') ? 'paid' : 'pending';
        return { ok: true, status, rawResponse: { xml: text } };
      } catch (err) {
        return { ok: false, status: 'failed', error: err.message };
      }
    },
    async refund(_paymentId: string, _amount: number): Promise<RefundResult> {
      return { ok: false, error: 'PrivatBank refunds must be processed via merchant portal' };
    },
  };
}
