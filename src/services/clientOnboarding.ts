import { supabase } from '../lib/supabase';
import { generateQuotationNumber } from '../hooks/useQuotations';
import type { CompanyCode } from '../domain/company';
import type { OnboardingCommercials, PaymentStageDraft } from '../domain/clientOnboarding';
import { materializePaymentStages, toQuotationDiscountType } from '../domain/clientOnboarding';
import { RITERA_DEFAULT_TERMS } from '../domain/quotationDefaults';

export interface ClientOnboardingInput {
  onboardingKey: string;
  client: { name: string; email: string; phone: string; address: string; state: string; state_code: string; gstin: string; default_company: CompanyCode };
  project: { name: string; description: string; packageId: string; packageName: string; services: Record<string, string[]>; deliverables: string[] };
  commercials: OnboardingCommercials;
  paymentStages: PaymentStageDraft[];
}

export interface ClientOnboardingResult { client_id: string; project_id: string; quotation_id: string }

export type ClientOnboardingStep = 'generate_quotation_number' | 'create_client_project_onboarding';

export class ClientOnboardingError extends Error {
  readonly step: ClientOnboardingStep;
  readonly code?: string;
  readonly details?: string;
  readonly hint?: string;

  constructor(
    step: ClientOnboardingStep,
    message: string,
    code?: string,
    details?: string,
    hint?: string,
  ) {
    super(message);
    this.name = 'ClientOnboardingError';
    this.step = step;
    this.code = code;
    this.details = details;
    this.hint = hint;
  }
}

function asSafeError(step: ClientOnboardingStep, error: unknown): ClientOnboardingError {
  const value = error as { message?: string; code?: string; details?: string; hint?: string } | null;
  return new ClientOnboardingError(step, value?.message || 'Unknown Supabase error', value?.code, value?.details, value?.hint);
}

export function logClientOnboardingError(error: unknown): void {
  if (!import.meta.env.DEV) return;
  const safe = error instanceof ClientOnboardingError ? error : asSafeError('create_client_project_onboarding', error);
  console.error(`Client onboarding failed at: ${safe.step}`, {
    code: safe.code || null,
    message: safe.message,
    details: safe.details || null,
    hint: safe.hint || null,
  });
}

export async function createClientProjectOnboarding(input: ClientOnboardingInput): Promise<ClientOnboardingResult> {
  let quotationNumber: string;
  try {
    quotationNumber = await generateQuotationNumber();
  } catch (error) {
    throw asSafeError('generate_quotation_number', error);
  }
  const stages = materializePaymentStages(input.commercials.proposedTotal, input.paymentStages);
  const packageSnapshot = {
    packageId: input.project.packageId,
    packageName: input.project.packageName,
    services: input.project.services,
    deliverables: input.project.deliverables,
    complementary: [], paidAddons: [], excludedServices: [],
  };
  const snapshot = { package: packageSnapshot, commercials: input.commercials, paymentSchedule: stages, capturedAt: new Date().toISOString() };
  const { data, error } = await supabase.rpc('create_client_project_onboarding', {
    p_client: input.client,
    p_project: {
      name: input.project.name, description: input.project.description,
      onboarding_key: input.onboardingKey,
      sub_brand: input.client.default_company === 'ritera' ? 'Ritera Publishing' : input.client.default_company === 'ratix' ? 'Ratixinfo Tech' : 'Infinity Enterprises',
      service_details: input.project.deliverables.join('\n'), onboarding_snapshot: snapshot,
    },
    p_quotation: {
      quotation_number: quotationNumber,
      date: new Date().toISOString().slice(0, 10), valid_until: null, items: [],
      taxable_value: input.commercials.taxableAmount, include_gst: input.commercials.gstRate > 0,
      gst_rate: input.commercials.gstRate, cgst_amount: input.commercials.cgstAmount,
      sgst_amount: input.commercials.sgstAmount, igst_amount: input.commercials.igstAmount,
      is_igst: input.commercials.isIgst, total_amount: input.commercials.proposedTotal,
      discount_type: toQuotationDiscountType(input.commercials.discountType),
      discount_value: input.commercials.discountValue, discount_amount: input.commercials.discountAmount,
      payment_schedule: stages, notes: JSON.stringify(packageSnapshot), terms: RITERA_DEFAULT_TERMS,
    },
  });
  if (error) throw asSafeError('create_client_project_onboarding', error);
  return data as ClientOnboardingResult;
}
