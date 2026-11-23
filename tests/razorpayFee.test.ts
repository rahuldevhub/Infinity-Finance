import assert from 'node:assert/strict';
import test from 'node:test';
import { cashEntriesWithRazorpayFee } from '../src/domain/razorpayFee.js';

const payment = { type: 'in' as const, payment_mode: 'razorpay', amount: 8259, description: 'Client payment', category: 'Client Payment', date: '2026-11-23', reference: 'pay_test', company: 'infinity', sub_brand: null, created_by: 'test-user' };

test('Razorpay gross payment and fee produce two matching entries and the correct net', () => {
  const rows = cashEntriesWithRazorpayFee(payment, '194.91');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], payment);
  assert.deepEqual(rows[1], { ...payment, type: 'out', amount: 194.91, category: 'Payment Gateway Fees', description: 'Razorpay fee — Client payment' });
  assert.equal(Math.round((rows[0].amount - rows[1].amount) * 100), 806409);
});

test('blank and zero fees keep a single entry', () => {
  for (const fee of ['', ' ', '0', '0.00']) assert.deepEqual(cashEntriesWithRazorpayFee(payment, fee), [payment]);
});

test('other modes and Money OUT ignore stale fee inputs', () => {
  const bank = { ...payment, payment_mode: 'bank' };
  const outgoing = { ...payment, type: 'out' as const };
  assert.deepEqual(cashEntriesWithRazorpayFee(bank, '100'), [bank]);
  assert.deepEqual(cashEntriesWithRazorpayFee(outgoing, '100'), [outgoing]);
});

test('invalid fees fail before creating any entries', () => {
  for (const fee of ['-1', 'NaN', 'Infinity', '10abc', '0.001', '8260']) assert.throws(() => cashEntriesWithRazorpayFee(payment, fee));
  assert.equal(cashEntriesWithRazorpayFee(payment, '8259').length, 2);
});

test('fee identity stays stable across edits and separates different payments', async () => {
  const { razorpayFeeId } = await import('../src/domain/razorpayFee.js');
  const id = await razorpayFeeId('payment-one');
  assert.equal(await razorpayFeeId('payment-one'), id);
  assert.notEqual(await razorpayFeeId('payment-two'), id);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('older paired fees are recognized without confusing separately entered expenses', async () => {
  const { legacyRazorpayFee } = await import('../src/domain/razorpayFee.js');
  const original = { ...payment, id: 'payment', created_at: '2026-11-23T10:00:00Z' };
  const fee = { ...original, id: 'fee', type: 'out' as const, category: 'Payment Gateway Fees', description: `Razorpay fee — ${original.description}`, amount: 214.4 };
  assert.equal(legacyRazorpayFee(original, [fee]), fee);
  assert.equal(legacyRazorpayFee(original, [{ ...fee, created_at: '2026-11-23T11:00:00Z' }]), null);
  assert.throws(() => legacyRazorpayFee(original, [fee, { ...fee, id: 'other' }]));
});
