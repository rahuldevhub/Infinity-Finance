import assert from 'node:assert/strict';
import test from 'node:test';
import { inferFinancialCompany, scopeDashboardRows } from '../src/domain/dashboardSourceScope.js';

test('legacy sub-brand values map to their workspace without a migration', () => {
  assert.equal(inferFinancialCompany({ company: null, sub_brand: 'Ritera Publishing' }), 'ritera');
  assert.equal(inferFinancialCompany({ company: null, sub_brand: 'Ratix Info Tech' }), 'ratix');
});

test('Infinity aggregates existing records while brand workspaces remain isolated', () => {
  const rows = [
    { id: 'legacy-ritera', company: null, sub_brand: 'Ritera Publishing' },
    { id: 'new-ratix', company: 'ratix' as const, sub_brand: 'Ratixinfo Tech' },
    { id: 'unscoped', company: null, sub_brand: null },
  ];
  assert.deepEqual(scopeDashboardRows(rows, 'infinity').map((row) => row.id), ['legacy-ritera', 'new-ratix', 'unscoped']);
  assert.deepEqual(scopeDashboardRows(rows, 'ritera').map((row) => row.id), ['legacy-ritera']);
  assert.deepEqual(scopeDashboardRows(rows, 'ratix').map((row) => row.id), ['new-ratix']);
});
