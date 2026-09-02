import type {
  PaymentProvider,
  PaymentProviderName,
  CreateInvoiceParams,
  CreateInvoiceResult,
  CheckStatusResult,
  RefundResult,
  PaymentStatus,
} from './payment-provider.ts';
import { createMonobankProvider } from './providers/monobank.ts';
import { createLiqPayProvider } from './providers/liqpay.ts';
import { createWayForPayProvider } from './providers/wayforpay.ts';
import { createPrivatProvider } from './providers/privat.ts';
import { supabase } from '../telegram.ts';

const providers: Partial<Record<PaymentProviderName, PaymentProvider>> = {};

function getProvider(name: PaymentProviderName): PaymentProvider {
  if (providers[name]) return providers[name]!;
  switch (name) {
    case 'monobank': providers[name] = createMonobankProvider(); break;
    case 'liqpay': providers[name] = createLiqPayProvider(); break;
    case 'wayforpay': providers[name] = createWayForPayProvider(); break;
    case 'privat': providers[name] = createPrivatProvider(); break;
    case 'cod': providers[name] = createCodProvider(); break;
  }
  return providers[name]!;
}

function createCodProvider(): PaymentProvider {
  return {
    name: 'cod',
    label: 'Післяплата',
    enabled: true,
    async createInvoice(_params: CreateInvoiceParams): Promise<CreateInvoiceResult> {
      return { ok: true, paymentId: 'cod', invoiceId: 'cod' };
    },
    async checkStatus(_paymentId: string): Promise<CheckStatusResult> {
      return { ok: true, status: 'pending' };
    },
    async refund(_paymentId: string, _amount: number): Promise<RefundResult> {
      return { ok: false, error: 'COD refunds are handled manually' };
    },
  };
}

export async function getEnabledProviders(): Promise<PaymentProvider[]> {
  const all: PaymentProviderName[] = ['monobank', 'liqpay', 'wayforpay', 'privat', 'cod'];
  const enabled: PaymentProvider[] = [];
  for (const name of all) {
    const provider = getProvider(name);
    const { data } = await supabase
      .from('bot_settings')
      .select('value')
      .eq('key', `payment_${name}_enabled`)
      .maybeSingle();
    const settingEnabled = data?.value === 'true';
    if (settingEnabled && (provider.enabled || name === 'cod')) {
      enabled.push(provider);
    }
  }
  return enabled;
}

export async function createPayment(
  providerName: PaymentProviderName,
  params: CreateInvoiceParams,
): Promise<{ transactionId: string | null; result: CreateInvoiceResult }> {
  const provider = getProvider(providerName);
  const result = await provider.createInvoice(params);
  if (!result.ok) {
    return { transactionId: null, result };
  }
  const { data, error } = await supabase
    .from('payment_transactions')
    .insert({
      order_id: params.orderId,
      provider: providerName,
      payment_id: result.paymentId || null,
      invoice_id: result.invoiceId || null,
      status: 'pending',
      amount: params.amount,
      currency: params.currency || 'UAH',
      signature: result.signature || null,
      response_json: result.rawResponse || null,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { transactionId: null, result: { ok: false, error: error?.message || 'Failed to create transaction' } };
  }
  await supabase.from('payment_status_history').insert({
    transaction_id: data.id,
    status: 'pending',
    note: 'Invoice created',
  });
  return { transactionId: data.id, result };
}

export async function updatePaymentStatus(
  transactionId: string,
  status: PaymentStatus,
  rawResponse?: Record<string, unknown>,
  note?: string,
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (rawResponse) updates.response_json = rawResponse;
  if (status === 'paid') updates.paid_at = new Date().toISOString();
  if (status === 'refunded') updates.refunded_at = new Date().toISOString();
  await supabase.from('payment_transactions').update(updates).eq('id', transactionId);
  await supabase.from('payment_status_history').insert({
    transaction_id: transactionId,
    status,
    note: note || null,
  });
}

export async function checkPaymentStatus(transactionId: string): Promise<CheckStatusResult> {
  const { data: txn } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('id', transactionId)
    .maybeSingle();
  if (!txn) return { ok: false, status: 'failed', error: 'Transaction not found' };
  const provider = getProvider(txn.provider as PaymentProviderName);
  const result = await provider.checkStatus(txn.payment_id || txn.invoice_id || '');
  if (result.ok && result.status !== txn.status) {
    await updatePaymentStatus(transactionId, result.status, result.rawResponse, 'Status check');
  }
  return result;
}

export async function refundPayment(transactionId: string, amount: number): Promise<RefundResult> {
  const { data: txn } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('id', transactionId)
    .maybeSingle();
  if (!txn) return { ok: false, error: 'Transaction not found' };
  if (txn.status !== 'paid') return { ok: false, error: 'Transaction is not in paid status' };
  const provider = getProvider(txn.provider as PaymentProviderName);
  const result = await provider.refund(txn.payment_id || txn.invoice_id || '', amount);
  if (result.ok) {
    await updatePaymentStatus(transactionId, 'refunded', result.rawResponse, 'Refund processed');
  }
  return result;
}

export { getProvider };
export type { PaymentProvider, PaymentProviderName, PaymentStatus, CreateInvoiceParams, CreateInvoiceResult, CheckStatusResult, RefundResult };
