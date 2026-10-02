import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isMissingCashTransactionCompanyColumn,
  withoutCompany,
} from '../src/domain/cashTransactionCompatibility.js';

test('recognises missing company-column errors from PostgreSQL and PostgREST', () => {
  assert.equal(isMissingCashTransactionCompanyColumn({
    code: '42703',
    message: 'column cash_transactions.company does not exist',
  }), true);
  assert.equal(isMissingCashTransactionCompanyColumn({
    code: 'PGRST204',
    message: "Could not find the 'company' column of 'cash_transactions' in the schema cache",
  }), true);
});

test('does not retry unrelated database errors', () => {
  assert.equal(isMissingCashTransactionCompanyColumn({ code: '42501', message: 'permission denied' }), false);
  assert.equal(isMissingCashTransactionCompanyColumn(null), false);
});

test('legacy mutation payload omits only company', () => {
  const payload = { description: 'Printer payment', amount: 2070, company: 'infinity' as const };
  assert.deepEqual(withoutCompany(payload), { description: 'Printer payment', amount: 2070 });
  assert.equal(payload.company, 'infinity');
});
