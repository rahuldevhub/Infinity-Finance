import type { InvoiceItem } from '../types/index.js';
import { calculateGST, calculateInvoiceTotals, calculateLineItem } from '../utils/gstCalculations.js';

export type InvoiceDiscountType = 'percent' | 'flat';

export interface InvoiceItemInput {
  description: string;
  hsn_sac?: string;
  quantity: number;
  unit: string;
  rate: number;
  gst_rate: number;
}

export interface InvoiceCalculationResult {
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface SettlementReceipt {
  amount_received: number;
  is_void?: boolean | null;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function validateInvoiceDiscount(
  subtotal: number,
  discountType: InvoiceDiscountType,
  discountValue: number,
): string | null {
  if (!Number.isFinite(discountValue) || discountValue < 0) return 'Discount cannot be negative or invalid.';
  if (discountType === 'percent' && discountValue > 100) return 'Percentage discount cannot exceed 100%.';
  if (discountType === 'flat' && roundMoney(discountValue) > roundMoney(Math.max(subtotal, 0))) {
    return 'Fixed discount cannot exceed the subtotal.';
  }
  return null;
}

export function calculateFinalInvoice(
  inputs: InvoiceItemInput[],
  discountType: InvoiceDiscountType,
  discountValue: number,
  isIgst: boolean,
): InvoiceCalculationResult {
  const baseValues = inputs.map((item) => item.quantity * item.rate);
  const subtotal = roundMoney(baseValues.reduce((sum, value) => sum + value, 0));
  const validationError = validateInvoiceDiscount(subtotal, discountType, discountValue);
  if (validationError) throw new Error(validationError);

  const discountAmount = discountType === 'percent'
    ? roundMoney((subtotal * discountValue) / 100)
    : roundMoney(discountValue);

  let allocatedDiscount = 0;
  const items = inputs.map((item, index): InvoiceItem => {
    const baseTaxable = baseValues[index];
    let lineDiscount = 0;
    if (discountAmount > 0 && subtotal > 0) {
      lineDiscount = index === inputs.length - 1
        ? roundMoney(discountAmount - allocatedDiscount)
        : roundMoney((discountAmount * baseTaxable) / subtotal);
      allocatedDiscount = roundMoney(allocatedDiscount + lineDiscount);
    }

    if (discountAmount === 0) {
      const line = calculateLineItem(item.quantity, item.rate, item.gst_rate, isIgst);
      return {
        ...item,
        hsn_sac: item.hsn_sac || '',
        taxable_value: line.taxableValue,
        cgst: line.cgst,
        sgst: line.sgst,
        igst: line.igst,
        total: line.total,
      };
    }

    const taxableValue = roundMoney(Math.max(baseTaxable - lineDiscount, 0));
    const gst = calculateGST(taxableValue, item.gst_rate, isIgst);
    const cgst = roundMoney(gst.cgst);
    const sgst = roundMoney(gst.sgst);
    const igst = roundMoney(gst.igst);
    return {
      ...item,
      hsn_sac: item.hsn_sac || '',
      taxable_value: taxableValue,
      cgst,
      sgst,
      igst,
      total: roundMoney(taxableValue + cgst + sgst + igst),
    };
  });

  const totals = calculateInvoiceTotals(items);
  return {
    items,
    subtotal,
    discountAmount,
    taxableValue: roundMoney(totals.taxable_value),
    cgstAmount: roundMoney(totals.cgst_amount),
    sgstAmount: roundMoney(totals.sgst_amount),
    igstAmount: roundMoney(totals.igst_amount),
    totalAmount: roundMoney(totals.total_amount),
  };
}

export function calculateInvoiceSettlement(totalAmount: number, receipts: SettlementReceipt[]) {
  const advanceReceived = roundMoney(receipts.reduce((sum, receipt) => {
    if (receipt.is_void) return sum;
    const amount = Number(receipt.amount_received);
    return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
  }, 0));
  const balanceDue = roundMoney(Math.max(Number(totalAmount) - advanceReceived, 0));
  const paymentStatus = balanceDue === 0 && advanceReceived > 0
    ? 'paid' as const
    : advanceReceived > 0
      ? 'partial' as const
      : 'pending' as const;
  return { advanceReceived, balanceDue, paymentStatus };
}
