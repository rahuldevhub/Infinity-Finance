import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const pdfSource = readFileSync(resolve(process.cwd(), 'src/components/invoice/InvoicePDF.tsx'), 'utf8');
const nonGstPdfSource = readFileSync(resolve(process.cwd(), 'src/components/invoice/NonGSTInvoicePDF.tsx'), 'utf8');
const formSource = readFileSync(resolve(process.cwd(), 'src/pages/CreateInvoice.tsx'), 'utf8');

test('new GST and non-GST invoices default to paid without rewriting edit payloads', () => {
  assert.equal((formSource.match(/createInvoice\(\{ \.\.\.payload, payment_status: 'paid' \}\)/g) || []).length, 2);
  assert.doesNotMatch(formSource, /payment_status:\s*settlement\.paymentStatus/);
});

test('final tax invoice omits collection and settlement content', () => {
  assert.doesNotMatch(pdfSource, /Advance Received|Balance Due|Amount Pending|Outstanding/);
  assert.doesNotMatch(pdfSource, /PAYMENT DETAILS|Account No|IFSC|UPI:/);
});

test('final tax invoice keeps dynamic tax, client, discount, notes, and amount words', () => {
  assert.match(pdfSource, /invoiceClientSnapshot\(invoice\)/);
  assert.match(pdfSource, /CGST \+ SGST \(Intra-State\)/);
  assert.match(pdfSource, /IGST \(Inter-State\)/);
  assert.match(pdfSource, /amountToWords\(invoice\.total_amount\)/);
  assert.match(pdfSource, /invoice\.notes/);
  assert.match(pdfSource, /invoice\.discount_amount/);
});

test('GST and non-GST PDFs render every saved bill-to contact field explicitly', () => {
  for (const source of [pdfSource, nonGstPdfSource]) {
    assert.match(source, /billTo\.address/);
    assert.match(source, /Email: \{billTo\.email\}/);
    assert.match(source, /Phone: \{billTo\.phone\}/);
  }
});
