import test from 'node:test';
import assert from 'node:assert/strict';
import { inheritDocumentCompany, inheritProjectCompany, requireNewClientCompany } from '../src/domain/company.js';
import { renderTemplate, unresolvedPlaceholders } from '../src/domain/templateRenderer.js';
import { calculateOnboardingCommercials, materializePaymentStages, packageDeliverables, toQuotationDiscountType } from '../src/domain/clientOnboarding.js';

test('new clients require a valid company and default UI company is accepted', () => {
  assert.equal(requireNewClientCompany('ritera'), 'ritera');
  assert.throws(() => requireNewClientCompany(null));
});

test('legacy clients remain compatible and new projects inherit safely', () => {
  assert.equal(inheritProjectCompany(null), 'ritera');
  assert.equal(inheritProjectCompany('ratix'), 'ratix');
  assert.equal(inheritProjectCompany('ratix', 'infinity'), 'infinity');
});

test('documents inherit company from project while standalone historical records remain possible', () => {
  assert.equal(inheritDocumentCompany('ratix'), 'ratix');
  assert.equal(inheritDocumentCompany(null), 'ritera');
});

test('agreement/email placeholders render without evaluating content', () => {
  const result = renderTemplate('Hello {{ client_name }} — {{project_name}}', { client_name: '<Client>', project_name: 'Book' });
  assert.equal(result, 'Hello <Client> — Book');
  assert.deepEqual(unresolvedPlaceholders(result), []);
});

test('Ritera package deliverables are copied into a stable editable snapshot', () => {
  const services = { Publishing: ['ISBN', 'Formatting'] };
  const snapshot = packageDeliverables(services, ['Author Interview']);
  services.Publishing.push('Later global change');
  assert.deepEqual(snapshot, ['ISBN', 'Formatting', 'Author Interview']);
});

test('onboarding discount and GST match quotation arithmetic using safe minor units', () => {
  const result = calculateOnboardingCommercials(60000, 'percentage', 10, 18, false);
  assert.equal(result.discountAmount, 6000);
  assert.equal(result.taxableAmount, 54000);
  assert.equal(result.gstAmount, 9720);
  assert.equal(result.cgstAmount, 4860);
  assert.equal(result.sgstAmount, 4860);
  assert.equal(result.proposedTotal, 63720);
});

test('32999 onboarding example reconciles GST and 30/30/30/10 rounding exactly', () => {
  const result = calculateOnboardingCommercials(32_999, 'percentage', 10, 18, false);
  assert.equal(result.discountAmount, 3_299.90);
  assert.equal(result.taxableAmount, 29_699.10);
  assert.equal(result.gstAmount, 5_345.84);
  assert.equal(result.proposedTotal, 35_044.94);

  const rows = materializePaymentStages(result.proposedTotal, [
    { label: 'Advance', percentage: 30 },
    { label: 'Second Payment', percentage: 30 },
    { label: 'Third Payment', percentage: 30 },
    { label: 'Final Payment', percentage: 10 },
  ]);
  assert.deepEqual(rows.map((row) => row.amount), [10_513.48, 10_513.48, 10_513.48, 3_504.50]);
  assert.equal(rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0), 3_504_494);
});

test('draft onboarding payment split preserves labels and allocates rounding exactly', () => {
  const rows = materializePaymentStages(60000.01, [
    { label: 'Advance', percentage: 40 },
    { label: 'Second Payment', percentage: 30 },
    { label: 'Final Payment', percentage: 30 },
  ]);
  assert.equal(rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0), 6000001);
  assert.deepEqual(rows.map((row) => row.label), ['Advance', 'Second Payment', 'Final Payment']);
});

test('onboarding maps percentage discount to the existing quotation constraint value', () => {
  assert.equal(toQuotationDiscountType('percentage'), 'percent');
  assert.equal(toQuotationDiscountType('flat'), 'flat');
  assert.equal(toQuotationDiscountType('none'), 'flat');
});
