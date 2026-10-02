import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocatePercentageSchedule,
  assertPaymentAllowed,
  calculateInstallmentPaymentSummary,
  calculateProjectPaymentSummary,
} from '../src/domain/paymentCalculations.js';

const PROJECT_ID = 'project-60000';

test('allocates the 40/30/30 schedule exactly to the contract value', () => {
  const schedule = allocatePercentageSchedule(60_000, [40, 30, 30]);
  assert.deepEqual(schedule, [24_000, 18_000, 18_000]);
  assert.equal(schedule.reduce((sum, amount) => sum + amount, 0), 60_000);
});

test('A: no payment is pending at zero percent', () => {
  assert.deepEqual(calculateProjectPaymentSummary(PROJECT_ID, 60_000, []), {
    project_id: PROJECT_ID,
    contract_value: 60_000,
    total_received: 0,
    outstanding: 60_000,
    payment_progress: 0,
    payment_state: 'pending',
  });
});

test('B: first installment produces 40 percent partial state', () => {
  const result = calculateProjectPaymentSummary(PROJECT_ID, 60_000, [24_000]);
  assert.equal(result.total_received, 24_000);
  assert.equal(result.outstanding, 36_000);
  assert.equal(result.payment_progress, 40);
  assert.equal(result.payment_state, 'partial');
});

test('C and D: partial installment becomes paid after its balance arrives', () => {
  const partialProject = calculateProjectPaymentSummary(PROJECT_ID, 60_000, [24_000, 10_000]);
  assert.equal(partialProject.total_received, 34_000);
  assert.equal(partialProject.outstanding, 26_000);
  assert.equal(partialProject.payment_progress, 56.67);
  assert.equal(partialProject.payment_state, 'partial');

  const partialInstallment = calculateInstallmentPaymentSummary(18_000, [10_000]);
  assert.equal(partialInstallment.remaining, 8_000);
  assert.equal(partialInstallment.state, 'partial');

  const paidInstallment = calculateInstallmentPaymentSummary(18_000, [10_000, 8_000]);
  assert.equal(paidInstallment.remaining, 0);
  assert.equal(paidInstallment.state, 'paid');

  const result = calculateProjectPaymentSummary(PROJECT_ID, 60_000, [24_000, 10_000, 8_000]);
  assert.equal(result.total_received, 42_000);
  assert.equal(result.outstanding, 18_000);
  assert.equal(result.payment_progress, 70);
});

test('E: final payment produces paid state', () => {
  const result = calculateProjectPaymentSummary(PROJECT_ID, 60_000, [24_000, 10_000, 8_000, 18_000]);
  assert.equal(result.total_received, 60_000);
  assert.equal(result.outstanding, 0);
  assert.equal(result.payment_progress, 100);
  assert.equal(result.payment_state, 'paid');
});

test('F and G: overpayment, zero, and negative payments are rejected', () => {
  assert.throws(() => assertPaymentAllowed(1, 0), /outstanding balance/);
  assert.throws(() => assertPaymentAllowed(0, 60_000), /greater than zero/);
  assert.throws(() => assertPaymentAllowed(-1, 60_000), /greater than zero/);
});

test('H: allocation cannot exceed installment remaining', () => {
  assert.throws(() => assertPaymentAllowed(8_001, 26_000, 8_000), /installment remaining/);
  assert.doesNotThrow(() => assertPaymentAllowed(8_000, 26_000, 8_000));
});

test('money calculations use integer minor units for decimal-safe totals', () => {
  const schedule = allocatePercentageSchedule(100, [33.33, 33.33, 33.34]);
  assert.deepEqual(schedule, [33.33, 33.33, 33.34]);
  assert.equal(schedule.reduce((sum, amount) => sum + amount, 0), 100);
});

test('sequential stale attempts are rejected after the remaining balance is consumed', () => {
  assert.doesNotThrow(() => assertPaymentAllowed(5_000, 5_000));
  assert.throws(() => assertPaymentAllowed(5_000, 0), /outstanding balance/);
});
