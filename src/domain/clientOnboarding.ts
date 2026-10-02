import { allocatePercentageSchedule, fromMinorUnits, toMinorUnits } from './paymentCalculations.js';

export type DiscountType = 'none' | 'percentage' | 'flat';

export interface PaymentStageDraft { label: string; percentage: number; milestone?: string }

export interface OnboardingCommercials {
  basePrice: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  isIgst: boolean;
  proposedTotal: number;
}

export function toQuotationDiscountType(type: DiscountType): 'flat' | 'percent' {
  return type === 'percentage' ? 'percent' : 'flat';
}

export function packageDeliverables(services: Record<string, string[]>, complementary: string[] = []): string[] {
  return [...Object.values(services).flat(), ...complementary];
}

export function calculateOnboardingCommercials(
  basePrice: number,
  discountType: DiscountType,
  discountValue: number,
  gstRate: number,
  isIgst: boolean,
): OnboardingCommercials {
  const baseMinor = toMinorUnits(basePrice);
  if (baseMinor <= 0) throw new Error('Base price must be greater than zero');
  if (discountValue < 0) throw new Error('Discount cannot be negative');
  const discountMinor = discountType === 'percentage'
    ? Math.min(Math.round(baseMinor * Math.min(discountValue, 100) / 100), baseMinor)
    : discountType === 'flat' ? Math.min(toMinorUnits(discountValue), baseMinor) : 0;
  const taxableMinor = baseMinor - discountMinor;
  const gstMinor = Math.round(taxableMinor * gstRate / 100);
  const cgstMinor = isIgst ? 0 : Math.round(gstMinor / 2);
  const sgstMinor = isIgst ? 0 : gstMinor - cgstMinor;
  return {
    basePrice: fromMinorUnits(baseMinor), discountType, discountValue,
    discountAmount: fromMinorUnits(discountMinor), taxableAmount: fromMinorUnits(taxableMinor),
    gstRate, gstAmount: fromMinorUnits(gstMinor), cgstAmount: fromMinorUnits(cgstMinor),
    sgstAmount: fromMinorUnits(sgstMinor), igstAmount: isIgst ? fromMinorUnits(gstMinor) : 0,
    isIgst, proposedTotal: fromMinorUnits(taxableMinor + gstMinor),
  };
}

export function materializePaymentStages(total: number, stages: PaymentStageDraft[]) {
  if (stages.some((stage) => !stage.label.trim() || stage.percentage <= 0)) throw new Error('Every payment stage needs a label and positive percentage');
  const amounts = allocatePercentageSchedule(total, stages.map((stage) => stage.percentage));
  return stages.map((stage, index) => ({ ...stage, label: stage.label.trim(), amount: amounts[index] }));
}
