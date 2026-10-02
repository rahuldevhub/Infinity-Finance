import type { Invoice } from '../types/index.js';

type DatabaseError = { code?: string; message?: string };

export const OPTIONAL_FINAL_INVOICE_COLUMNS = [
  'company', 'project_id', 'client_name_override', 'client_gstin_override',
  'billing_address_override', 'client_state_override', 'client_email_override',
  'client_phone_override', 'discount_type', 'discount_value', 'discount_amount',
] as const;

export type OptionalFinalInvoiceColumn = (typeof OPTIONAL_FINAL_INVOICE_COLUMNS)[number];

export function getMissingFinalInvoiceColumn(error: DatabaseError | null): OptionalFinalInvoiceColumn | null {
  if (!error || (error.code !== '42703' && error.code !== 'PGRST204')) return null;
  const message = error.message?.toLowerCase() ?? '';
  return OPTIONAL_FINAL_INVOICE_COLUMNS.find((column) => message.includes(column)) ?? null;
}

export function withoutFinalInvoiceColumn<T extends Record<string, unknown>>(
  row: T,
  column: OptionalFinalInvoiceColumn,
): Omit<T, OptionalFinalInvoiceColumn> {
  const copy = { ...row };
  delete copy[column];
  return copy;
}

export function invoiceClientSnapshot(invoice: Invoice) {
  return {
    name: invoice.client_name_override || invoice.client?.name || '',
    gstin: invoice.client_gstin_override ?? invoice.client?.gstin ?? null,
    address: invoice.billing_address_override || invoice.client?.address || '',
    state: invoice.client_state_override || invoice.client?.state || '',
    email: invoice.client_email_override ?? invoice.client?.email ?? null,
    phone: invoice.client_phone_override ?? invoice.client?.phone ?? null,
  };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeInvoiceDiscount(invoice: Invoice): Invoice {
  if (invoice.discount_type && invoice.discount_value !== undefined && invoice.discount_amount !== undefined) return invoice;
  const subtotal = roundMoney((invoice.items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.rate || 0), 0,
  ));
  const discountAmount = Math.max(roundMoney(subtotal - Number(invoice.taxable_value || 0)), 0);
  if (discountAmount === 0 || subtotal === 0) {
    return { ...invoice, discount_type: 'flat', discount_value: 0, discount_amount: 0 };
  }
  const percent = Math.round((discountAmount / subtotal) * 10000) / 100;
  const looksLikePercent = Math.abs(roundMoney((subtotal * percent) / 100) - discountAmount) <= 0.01;
  return {
    ...invoice,
    discount_type: looksLikePercent ? 'percent' : 'flat',
    discount_value: looksLikePercent ? percent : discountAmount,
    discount_amount: discountAmount,
  };
}
