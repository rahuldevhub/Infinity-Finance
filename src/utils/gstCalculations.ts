import { BUSINESS_STATE_CODE } from '../types';

export function calculateGST(taxableValue: number, gstRate: number, isIGST: boolean) {
  const totalGST = (taxableValue * gstRate) / 100;
  if (isIGST) {
    return { cgst: 0, sgst: 0, igst: totalGST };
  } else {
    const half = totalGST / 2;
    return { cgst: half, sgst: half, igst: 0 };
  }
}

export function isInterState(placeOfSupplyCode: string): boolean {
  return placeOfSupplyCode !== BUSINESS_STATE_CODE;
}

export function calculateLineItem(
  quantity: number,
  rate: number,
  gstRate: number,
  isIGST: boolean
) {
  const taxableValue = quantity * rate;
  const { cgst, sgst, igst } = calculateGST(taxableValue, gstRate, isIGST);
  const total = taxableValue + cgst + sgst + igst;
  return { taxableValue, cgst, sgst, igst, total };
}

export function calculateInvoiceTotals(
  items: Array<{ taxable_value: number; cgst: number; sgst: number; igst: number }>
) {
  return items.reduce(
    (acc, item) => ({
      taxable_value: acc.taxable_value + item.taxable_value,
      cgst_amount: acc.cgst_amount + item.cgst,
      sgst_amount: acc.sgst_amount + item.sgst,
      igst_amount: acc.igst_amount + item.igst,
      total_amount:
        acc.total_amount + item.taxable_value + item.cgst + item.sgst + item.igst,
    }),
    { taxable_value: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0 }
  );
}
