import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateFinalInvoice,
  calculateInvoiceSettlement,
  validateInvoiceDiscount,
} from '../src/domain/invoiceCalculations.js';

const item = (overrides = {}) => ({
  description: 'Publishing service', hsn_sac: '9983', quantity: 1, unit: 'Nos', rate: 1000, gst_rate: 18,
  ...overrides,
});

test('GST invoice preserves the existing no-discount CGST and SGST result', () => {
  const result = calculateFinalInvoice([item()], 'percent', 0, false);
  assert.deepEqual(result, {
    items: [{ ...item(), taxable_value: 1000, cgst: 90, sgst: 90, igst: 0, total: 1180 }],
    subtotal: 1000, discountAmount: 0, taxableValue: 1000,
    cgstAmount: 90, sgstAmount: 90, igstAmount: 0, totalAmount: 1180,
  });
});

test('percentage discount is allocated before GST across multiple line items', () => {
  const result = calculateFinalInvoice([item(), item({ description: 'Design', rate: 500 })], 'percent', 10, false);
  assert.equal(result.subtotal, 1500);
  assert.equal(result.discountAmount, 150);
  assert.equal(result.taxableValue, 1350);
  assert.equal(result.cgstAmount, 121.5);
  assert.equal(result.sgstAmount, 121.5);
  assert.equal(result.totalAmount, 1593);
});

test('fixed discount and IGST are calculated on the discounted taxable value', () => {
  const result = calculateFinalInvoice([item()], 'flat', 100, true);
  assert.equal(result.taxableValue, 900);
  assert.equal(result.igstAmount, 162);
  assert.equal(result.totalAmount, 1062);
});

test('non-GST invoice keeps tax amounts at zero', () => {
  const result = calculateFinalInvoice([item({ gst_rate: 0 })], 'percent', 10, false);
  assert.equal(result.taxableValue, 900);
  assert.equal(result.cgstAmount + result.sgstAmount + result.igstAmount, 0);
  assert.equal(result.totalAmount, 900);
});

test('discount validation rejects unsafe values', () => {
  assert.match(validateInvoiceDiscount(1000, 'percent', 101) || '', /cannot exceed 100/);
  assert.match(validateInvoiceDiscount(1000, 'flat', 1001) || '', /cannot exceed the subtotal/);
});

test('settlement uses only positive non-void receipt amounts', () => {
  assert.deepEqual(calculateInvoiceSettlement(50000, [
    { amount_received: 30000 }, { amount_received: 5000, is_void: true }, { amount_received: -20 },
  ]), { advanceReceived: 30000, balanceDue: 20000, paymentStatus: 'partial' });
  assert.deepEqual(calculateInvoiceSettlement(38938.82, [{ amount_received: 38938.82 }]), {
    advanceReceived: 38938.82, balanceDue: 0, paymentStatus: 'paid',
  });
});
