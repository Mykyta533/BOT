export type PaymentProviderName = 'monobank' | 'liqpay' | 'wayforpay' | 'privat' | 'cod';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'expired';

export interface CreateInvoiceParams {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  botUserId: string;
  chatId: number;
}

export interface CreateInvoiceResult {
  ok: boolean;
  paymentId?: string;
  invoiceId?: string;
  paymentUrl?: string;
  signature?: string;
  rawResponse?: Record<string, unknown>;
  error?: string;
}

export interface CheckStatusResult {
  ok: boolean;
  status: PaymentStatus;
  rawResponse?: Record<string, unknown>;
  error?: string;
}

export interface RefundResult {
  ok: boolean;
  rawResponse?: Record<string, unknown>;
  error?: string;
}

export interface PaymentProvider {
  name: PaymentProviderName;
  label: string;
  enabled: boolean;
  createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult>;
  checkStatus(paymentId: string): Promise<CheckStatusResult>;
  refund(paymentId: string, amount: number): Promise<RefundResult>;
}
