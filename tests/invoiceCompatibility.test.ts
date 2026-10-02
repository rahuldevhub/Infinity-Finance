import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMissingFinalInvoiceColumn,
  invoiceClientSnapshot,
  normalizeInvoiceDiscount,
  withoutFinalInvoiceColumn,
} from '../src/domain/invoiceCompatibility.js';

test('recognises additive invoice columns missing from a legacy database', () => {
  assert.equal(getMissingFinalInvoiceColumn({ code: 'PGRST204', message: "Could not find the 'discount_type' column" }), 'discount_type');
  assert.equal(getMissingFinalInvoiceColumn({ code: '42703', message: 'column client_name_override does not exist' }), 'client_name_override');
  assert.equal(getMissingFinalInvoiceColumn({ code: '42501', message: 'permission denied' }), null);
});

test('reconstructs a legacy percentage discount from stored taxable value and item rates', () => {
  const invoice = normalizeInvoiceDiscount({
    id: 'invoice-1', invoice_number: 'INV-1', invoice_date: '2026-09-27', due_date: null,
    client_id: null, sub_brand: 'Ritera Publishing', place_of_supply: 'Tamil Nadu', place_of_supply_code: '33',
    is_igst: false, items: [{ description: 'Service', hsn_sac: '9983', quantity: 1, unit: 'Nos', rate: 1000,
      taxable_value: 900, gst_rate: 18, cgst: 81, sgst: 81, igst: 0, total: 1062 }],
    taxable_value: 900, cgst_amount: 81, sgst_amount: 81, igst_amount: 0, total_amount: 1062,
    payment_status: 'pending', notes: null, created_at: '', created_by: '',
  });
  assert.equal(invoice.discount_type, 'percent');
  assert.equal(invoice.discount_value, 10);
  assert.equal(invoice.discount_amount, 100);
});

test('removes only the reported optional field', () => {
  const payload = { invoice_number: 'INV-1', discount_type: 'percent', total_amount: 1180 };
  assert.deepEqual(withoutFinalInvoiceColumn(payload, 'discount_type'), { invoice_number: 'INV-1', total_amount: 1180 });
  assert.equal(payload.discount_type, 'percent');
});

test('manual bill-to snapshot works without a client record and keeps GSTIN optional', () => {
  const snapshot = invoiceClientSnapshot({
    id: 'invoice-2', invoice_number: 'INV-2', invoice_date: '2026-09-27', due_date: null,
    client_id: null, client_name_override: 'Manual Client', client_gstin_override: null,
    billing_address_override: 'Chennai', client_state_override: 'Tamil Nadu',
    client_email_override: 'manual@example.com', client_phone_override: null,
    sub_brand: 'Ritera Publishing', place_of_supply: 'Tamil Nadu', place_of_supply_code: '33',
    is_igst: false, items: [], taxable_value: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0,
    total_amount: 0, payment_status: 'pending', notes: null, created_at: '', created_by: '',
  });
  assert.deepEqual(snapshot, {
    name: 'Manual Client', gstin: null, address: 'Chennai', state: 'Tamil Nadu',
    email: 'manual@example.com', phone: null,
  });
});
