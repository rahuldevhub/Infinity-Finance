import { fromMinorUnits, toMinorUnits } from './paymentCalculations.js'

export type ProformaDiscountType = 'flat' | 'percent'

export interface ProformaTotalsInput {
  subtotal: number
  discountType: ProformaDiscountType
  discountValue: number
  includeGst: boolean
  gstRate: number
  isIgst: boolean
}

export interface ProformaTotals {
  subtotal: number
  discountAmount: number
  taxableValue: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalGst: number
  totalAmount: number
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number`)
  }
}

export function validateProformaDiscount(
  subtotal: number,
  discountType: ProformaDiscountType,
  discountValue: number,
): string | null {
  if (!Number.isFinite(discountValue) || discountValue < 0) return 'Discount cannot be negative or invalid.'
  if (discountType === 'percent' && discountValue > 100) return 'Percentage discount cannot exceed 100%.'
  if (discountType === 'flat' && toMinorUnits(discountValue) > toMinorUnits(Math.max(subtotal, 0))) {
    return 'Fixed discount cannot exceed the subtotal.'
  }
  return null
}

export function calculateProformaTotals(input: ProformaTotalsInput): ProformaTotals {
  assertNonNegativeFinite(input.subtotal, 'Subtotal')
  assertNonNegativeFinite(input.discountValue, 'Discount')
  assertNonNegativeFinite(input.gstRate, 'GST rate')
  if (input.gstRate > 100) throw new Error('GST rate cannot exceed 100%')

  const validationError = validateProformaDiscount(input.subtotal, input.discountType, input.discountValue)
  if (validationError) throw new Error(validationError)

  const subtotalMinor = toMinorUnits(input.subtotal)
  const discountMinor = input.discountType === 'percent'
    ? Math.round((subtotalMinor * input.discountValue) / 100)
    : toMinorUnits(input.discountValue)
  const taxableMinor = subtotalMinor - discountMinor
  const gstMinor = input.includeGst ? Math.round((taxableMinor * input.gstRate) / 100) : 0
  const cgstMinor = input.includeGst && !input.isIgst ? Math.round(gstMinor / 2) : 0
  const sgstMinor = input.includeGst && !input.isIgst ? gstMinor - cgstMinor : 0
  const igstMinor = input.includeGst && input.isIgst ? gstMinor : 0

  return {
    subtotal: fromMinorUnits(subtotalMinor),
    discountAmount: fromMinorUnits(discountMinor),
    taxableValue: fromMinorUnits(taxableMinor),
    cgstAmount: fromMinorUnits(cgstMinor),
    sgstAmount: fromMinorUnits(sgstMinor),
    igstAmount: fromMinorUnits(igstMinor),
    totalGst: fromMinorUnits(gstMinor),
    totalAmount: fromMinorUnits(taxableMinor + gstMinor),
  }
}

export function calculateProformaItemAmount(quantity: number, rate: number): number {
  assertNonNegativeFinite(quantity, 'Quantity')
  assertNonNegativeFinite(rate, 'Rate')
  return fromMinorUnits(toMinorUnits(quantity * rate))
}
