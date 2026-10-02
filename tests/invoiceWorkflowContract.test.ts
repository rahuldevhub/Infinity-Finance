import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const createInvoice = readFileSync(resolve(process.cwd(), 'src/pages/CreateInvoice.tsx'), 'utf8');
const useInvoices = readFileSync(resolve(process.cwd(), 'src/hooks/useInvoices.ts'), 'utf8');

test('new final invoices omit due-date input and persist no due date', () => {
  assert.doesNotMatch(createInvoice, /Due Date/);
  assert.doesNotMatch(createInvoice, /type="date"[^>]*due/i);
  assert.match(createInvoice, /due_date:\s*null/g);
});

test('final invoice form keeps manual bill-to and optional saved-client reuse', () => {
  assert.match(createInvoice, /Enter invoice details directly\. A saved client is optional\./);
  assert.match(createInvoice, /label="Client Name" required/);
  assert.match(createInvoice, /GSTIN \(optional\)/);
  assert.match(createInvoice, /Billing Address \(optional\)/);
  assert.match(createInvoice, /client_id:\s*selectedClient\?\.id \|\| null/);
});

test('final invoice notes use the requested editable default', () => {
  assert.match(createInvoice, /Thank you for choosing Ritera Publishing\. This tax invoice is issued for the services provided as described above\./);
  assert.match(createInvoice, /onChange=\{e => setNotes\(e\.target\.value\)\}/);
});

test('legacy schemas preserve bill-to details for manual and saved clients on create and edit', () => {
  assert.equal((useInvoices.match(/payload\.client_id\s*=\s*await ensureLegacyInvoiceClient/g) || []).length, 2);
  assert.equal((useInvoices.match(/!legacyClientEnsured && missingColumn\.includes\('override'\)/g) || []).length, 2);
  assert.doesNotMatch(useInvoices, /!payload\.client_id && missingColumn\.includes\('override'\)/);
  assert.doesNotMatch(useInvoices, /Manual invoice clients require the final invoice database migration/);
});
