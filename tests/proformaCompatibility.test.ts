import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMissingProformaColumn,
  normalizeProformaDiscount,
  withoutProformaColumn,
} from '../src/domain/proformaCompatibility.js';

test('recognises only supported missing proforma columns', () => {
  assert.equal(getMissingProformaColumn({
    code: 'PGRST204',
    message: "Could not find the 'discount_type' column of 'proforma_invoices' in the schema cache",
  }), 'discount_type');
  assert.equal(getMissingProformaColumn({
    code: '42703',
    message: 'column proforma_invoices.project_id does not exist',
  }), 'project_id');
  assert.equal(getMissingProformaColumn({ code: '42501', message: 'permission denied' }), null);
  assert.equal(getMissingProformaColumn({ code: 'PGRST204', message: "Could not find the 'status' column" }), null);
});

test('legacy payload removal does not mutate the original object', () => {
  const payload = { proforma_number: 'PRF-260901', discount_type: 'percent', total_amount: 35044.94 };
  assert.deepEqual(withoutProformaColumn(payload, 'discount_type'), {
    proforma_number: 'PRF-260901',
    total_amount: 35044.94,
  });
  assert.equal(payload.discount_type, 'percent');
});

test('reconstructs a percentage discount from legacy financial values', () => {
  const normalized = normalizeProformaDiscount({
    items: [{ description: 'Custom Package', quantity: 1, unit: 'Nos', rate: 32999, amount: 32999 }],
    taxable_value: 29699.1,
  });

  assert.equal(normalized.discount_type, 'percent');
  assert.equal(normalized.discount_value, 10);
  assert.equal(normalized.discount_amount, 3299.9);
});

test('keeps an irregular legacy discount as a flat amount', () => {
  const normalized = normalizeProformaDiscount({
    items: [{ description: 'Service', quantity: 1, unit: 'Nos', rate: 32999, amount: 32999 }],
    taxable_value: 32899,
  });

  assert.equal(normalized.discount_type, 'flat');
  assert.equal(normalized.discount_value, 100);
  assert.equal(normalized.discount_amount, 100);
});
