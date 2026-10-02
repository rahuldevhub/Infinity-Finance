import type { PaymentState, ProjectPaymentSummary } from '../types/index.js';

export interface InstallmentPaymentSummary {
  amount: number;
  received: number;
  remaining: number;
  progress: number;
  state: 'pending' | 'partial' | 'paid';
}

function assertFiniteMoney(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
}

export function toMinorUnits(value: number): number {
  assertFiniteMoney(value, 'Money value');
  return Math.round((value + Number.EPSILON) * 100);
}

export function fromMinorUnits(value: number): number {
  return value / 100;
}

export function derivePaymentState(contractMinor: number, receivedMinor: number): PaymentState {
  if (contractMinor <= 0) return 'unconfigured';
  if (receivedMinor <= 0) return 'pending';
  if (receivedMinor < contractMinor) return 'partial';
  return 'paid';
}

export function calculateProjectPaymentSummary(
  projectId: string,
  contractValue: number | null,
  receiptAmounts: number[],
): ProjectPaymentSummary {
  const receivedMinor = receiptAmounts.reduce((total, amount) => {
    assertFiniteMoney(amount, 'Receipt amount');
    return total + toMinorUnits(amount);
  }, 0);

  if (contractValue == null || contractValue <= 0) {
    return {
      project_id: projectId,
      contract_value: contractValue,
      total_received: fromMinorUnits(receivedMinor),
      outstanding: null,
      payment_progress: 0,
      payment_state: 'unconfigured',
    };
  }

  const contractMinor = toMinorUnits(contractValue);
  const outstandingMinor = Math.max(contractMinor - receivedMinor, 0);
  const progress = Math.min((receivedMinor / contractMinor) * 100, 100);

  return {
    project_id: projectId,
    contract_value: fromMinorUnits(contractMinor),
    total_received: fromMinorUnits(receivedMinor),
    outstanding: fromMinorUnits(outstandingMinor),
    payment_progress: Math.round(progress * 100) / 100,
    payment_state: derivePaymentState(contractMinor, receivedMinor),
  };
}

export function calculateInstallmentPaymentSummary(
  installmentAmount: number,
  receiptAmounts: number[],
): InstallmentPaymentSummary {
  const amountMinor = toMinorUnits(installmentAmount);
  if (amountMinor <= 0) throw new Error('Installment amount must be greater than zero');

  const receivedMinor = receiptAmounts.reduce((total, amount) => total + toMinorUnits(amount), 0);
  const remainingMinor = Math.max(amountMinor - receivedMinor, 0);

  return {
    amount: fromMinorUnits(amountMinor),
    received: fromMinorUnits(receivedMinor),
    remaining: fromMinorUnits(remainingMinor),
    progress: Math.round(Math.min((receivedMinor / amountMinor) * 100, 100) * 100) / 100,
    state: receivedMinor <= 0 ? 'pending' : receivedMinor < amountMinor ? 'partial' : 'paid',
  };
}

export function assertPaymentAllowed(
  amount: number,
  projectOutstanding: number,
  installmentRemaining?: number | null,
): void {
  const amountMinor = toMinorUnits(amount);
  if (amountMinor <= 0) throw new Error('Payment amount must be greater than zero');
  if (amountMinor > toMinorUnits(projectOutstanding)) {
    throw new Error('Payment exceeds the project outstanding balance');
  }
  if (installmentRemaining != null && amountMinor > toMinorUnits(installmentRemaining)) {
    throw new Error('Payment exceeds the installment remaining balance');
  }
}

export function allocatePercentageSchedule(
  contractValue: number,
  percentages: number[],
): number[] {
  const contractMinor = toMinorUnits(contractValue);
  if (contractMinor <= 0) throw new Error('Contract value must be greater than zero');
  if (percentages.length === 0) throw new Error('At least one installment is required');

  const percentageTotal = percentages.reduce((sum, percentage) => sum + percentage, 0);
  if (Math.abs(percentageTotal - 100) > 0.0001) {
    throw new Error('Installment percentages must total 100');
  }

  let allocatedMinor = 0;
  return percentages.map((percentage, index) => {
    const installmentMinor = index === percentages.length - 1
      ? contractMinor - allocatedMinor
      : Math.round((contractMinor * percentage) / 100);
    allocatedMinor += installmentMinor;
    return fromMinorUnits(installmentMinor);
  });
}
