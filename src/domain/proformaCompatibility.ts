import type { ProformaInvoice, ProformaItem } from '../types';

type DatabaseError = {
  code?: string;
  message?: string;
};

export const OPTIONAL_PROFORMA_COLUMNS = [
  'company',
  'project_id',
  'discount_type',
  'discount_value',
  'discount_amount',
] as const;

export type OptionalProformaColumn = (typeof OPTIONAL_PROFORMA_COLUMNS)[number];

export function getMissingProformaColumn(error: DatabaseError | null): OptionalProformaColumn | null {
  if (!error || (error.code !== '42703' && error.code !== 'PGRST204')) return null;

  const message = error.message?.toLowerCase() ?? '';
  return OPTIONAL_PROFORMA_COLUMNS.find((column) => message.includes(column)) ?? null;
}

export function withoutProformaColumn<T extends Record<string, unknown>>(
  row: T,
  column: OptionalProformaColumn,
): Omit<T, OptionalProformaColumn> {
  const copy = { ...row };
  delete copy[column];
  return copy;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function itemSubtotal(items: ProformaItem[]): number {
  return roundMoney(items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
}

/**
 * Older deployments stored the post-discount taxable value but not the three
 * discount metadata columns. Reconstruct that metadata so legacy rows remain
 * editable and render consistently after a compatibility save.
 */
export function normalizeProformaDiscount<T extends Partial<ProformaInvoice>>(row: T): T {
  if (row.discount_type && row.discount_value !== undefined && row.discount_amount !== undefined) {
    return row;
  }

  const items = Array.isArray(row.items) ? row.items : [];
  const subtotal = itemSubtotal(items);
  const taxableValue = Number(row.taxable_value || 0);
  const discountAmount = Math.max(roundMoney(subtotal - taxableValue), 0);

  if (discountAmount === 0 || subtotal === 0) {
    return {
      ...row,
      discount_type: row.discount_type ?? 'flat',
      discount_value: row.discount_value ?? 0,
      discount_amount: row.discount_amount ?? 0,
    };
  }

  const rawPercent = (discountAmount / subtotal) * 100;
  const roundedPercent = Math.round(rawPercent * 100) / 100;
  const amountAtRoundedPercent = roundMoney((subtotal * roundedPercent) / 100);
  const looksLikePercent = Math.abs(amountAtRoundedPercent - discountAmount) <= 0.01;

  return {
    ...row,
    discount_type: row.discount_type ?? (looksLikePercent ? 'percent' : 'flat'),
    discount_value: row.discount_value ?? (looksLikePercent ? roundedPercent : discountAmount),
    discount_amount: row.discount_amount ?? discountAmount,
  };
}
