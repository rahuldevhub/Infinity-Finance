import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCashFlowAnalysis,
  getComparisonRange,
  getPresetRange,
} from '../src/domain/cashFlowAnalysis.js';
import type { AnalysisTransaction } from '../src/domain/cashFlowAnalysis.js';

function transaction(
  id: string,
  date: string,
  type: 'in' | 'out',
  category: string,
  description: string,
  amount: number,
  subBrand: string | null = null,
): AnalysisTransaction {
  return {
    id,
    date,
    type,
    category,
    description,
    amount,
    payment_mode: 'bank',
    reference: null,
    sub_brand: subBrand,
    created_at: `${date}T10:00:00Z`,
  };
}

test('preset ranges use inclusive local dates', () => {
  const today = new Date(2026, 8, 25);
  assert.deepEqual(getPresetRange('last-7-days', today), { start: '2026-09-19', end: '2026-09-25' });
  assert.deepEqual(getPresetRange('last-15-days', today), { start: '2026-09-11', end: '2026-09-25' });
  assert.deepEqual(getPresetRange('this-month', today), { start: '2026-09-01', end: '2026-09-25' });
  assert.deepEqual(getPresetRange('last-month', today), { start: '2026-08-01', end: '2026-08-31' });
  assert.deepEqual(getPresetRange('this-quarter', today), { start: '2026-07-01', end: '2026-09-25' });
  assert.deepEqual(getPresetRange('last-quarter', today), { start: '2026-04-01', end: '2026-06-30' });
  assert.deepEqual(getPresetRange('last-6-months', today), { start: '2026-04-01', end: '2026-09-25' });
  assert.deepEqual(getPresetRange('this-year', today), { start: '2026-01-01', end: '2026-09-25' });
  assert.deepEqual(getPresetRange('last-year', today), { start: '2025-01-01', end: '2025-12-31' });
});

test('comparison ranges preserve the selected period length', () => {
  assert.deepEqual(
    getComparisonRange({ start: '2026-09-01', end: '2026-09-30' }, 'previous'),
    { start: '2026-08-02', end: '2026-08-31' },
  );
  assert.deepEqual(
    getComparisonRange({ start: '2026-04-01', end: '2026-09-25' }, 'last-year'),
    { start: '2025-04-01', end: '2025-09-25' },
  );
});

test('analysis reconciles opening, inflow, outflow, net and closing balances', () => {
  const current = [
    transaction('1', '2026-07-03', 'in', 'Client Payment', 'Author A', 100_000, 'Ritera Publishing'),
    transaction('2', '2026-07-10', 'out', 'Marketing', 'Meta Ads', 20_000),
    transaction('3', '2026-08-05', 'out', 'Salary', 'Team Salary', 30_000),
    transaction('4', '2026-09-07', 'in', 'Other Income', 'Interest', 5_000),
  ];
  const analysis = buildCashFlowAnalysis({
    transactions: current,
    openingBalance: 12_500,
    range: { start: '2026-07-01', end: '2026-09-30' },
  });
  assert.equal(analysis.totalIn, 105_000);
  assert.equal(analysis.totalOut, 50_000);
  assert.equal(analysis.net, 55_000);
  assert.equal(analysis.closingBalance, 67_500);
  assert.equal(analysis.openingBalance + analysis.totalIn - analysis.totalOut, analysis.closingBalance);
  assert.equal(analysis.expenseIncomeRatio?.toFixed(2), '47.62');
  assert.equal(analysis.timeline.length, 3);
});

test('expense and inflow rankings use structured categories instead of sub-brand labels', () => {
  const analysis = buildCashFlowAnalysis({
    transactions: [
      transaction('1', '2026-08-01', 'in', 'Client Payment', 'Receipt A', 80_000, 'Ritera Publishing'),
      transaction('2', '2026-08-02', 'in', 'Other Income', 'Interest', 20_000),
      transaction('3', '2026-08-03', 'out', 'Marketing', 'Meta Ads', 30_000),
      transaction('4', '2026-08-04', 'out', 'Salary', 'Salary', 10_000),
    ],
    openingBalance: 0,
    range: { start: '2026-08-01', end: '2026-08-31' },
  });
  assert.equal(analysis.expenseCategories[0].name, 'Marketing');
  assert.equal(analysis.expenseCategories[0].percentage, 75);
  assert.equal(analysis.topThreeExpenseAmount, 40_000);
  assert.equal(analysis.topThreeExpenseShare, 100);
  assert.equal(analysis.inflowSources[0].name, 'Client Payment');
  assert.equal(analysis.topOneInflowShare, 80);
  assert.equal(analysis.topThreeInflowShare, 100);
});

test('recurring costs require at least three occurrences across two months', () => {
  const analysis = buildCashFlowAnalysis({
    transactions: [
      transaction('1', '2026-07-01', 'out', 'Software', 'Workspace subscription', 1_000),
      transaction('2', '2026-08-01', 'out', 'Software', 'Workspace subscription', 1_000),
      transaction('3', '2026-09-01', 'out', 'Software', 'Workspace subscription', 1_000),
      transaction('4', '2026-09-05', 'out', 'Office', 'One-off chair', 8_000),
      transaction('5', '2026-09-06', 'out', 'Office', 'One-off desk', 9_000),
    ],
    openingBalance: 0,
    range: { start: '2026-07-01', end: '2026-09-30' },
  });
  assert.equal(analysis.recurringCosts.length, 1);
  assert.equal(analysis.recurringCosts[0].name, 'Workspace subscription');
  assert.equal(analysis.recurringCosts[0].monthlyAverage, 1_000);
  assert.equal(analysis.recurringBusinessCosts.length, 1);
  assert.equal(analysis.estimatedRecurringMonthlyCost, 1_000);
});

test('personal withdrawals are recurring movements but not recurring business cost', () => {
  const analysis = buildCashFlowAnalysis({
    transactions: [
      transaction('1', '2026-07-05', 'out', 'Personal Withdrawal', 'Owner drawing', 10_000),
      transaction('2', '2026-08-05', 'out', 'Personal Withdrawal', 'Owner drawing', 10_000),
      transaction('3', '2026-09-05', 'out', 'Personal Withdrawal', 'Owner drawing', 10_000),
    ],
    openingBalance: 0,
    range: { start: '2026-07-01', end: '2026-09-30' },
  });
  assert.equal(analysis.recurringPersonalMovements.length, 1);
  assert.equal(analysis.recurringBusinessCosts.length, 0);
  assert.equal(analysis.estimatedRecurringMonthlyCost, 0);
  assert.equal(analysis.estimatedRecurringMonthlyPersonal, 10_000);
});

test('description classification is only a fallback for missing or generic categories', () => {
  const analysis = buildCashFlowAnalysis({
    transactions: [
      transaction('1', '2026-09-01', 'in', 'Other', 'Client payment from Acme', 15_000),
      transaction('2', '2026-09-02', 'in', 'Grant', 'Client payment wording', 10_000),
    ],
    openingBalance: 0,
    range: { start: '2026-09-01', end: '2026-09-30' },
  });
  assert.equal(analysis.inflowSources.find((source) => source.name === 'Client Payment')?.amount, 15_000);
  assert.equal(analysis.inflowSources.find((source) => source.name === 'Unclassified')?.amount, 10_000);
});

test('zero inflow never creates NaN or Infinity', () => {
  const analysis = buildCashFlowAnalysis({
    transactions: [transaction('1', '2026-09-10', 'out', 'Rent', 'Office rent', 25_000)],
    openingBalance: 50_000,
    range: { start: '2026-09-01', end: '2026-09-30' },
  });
  assert.equal(analysis.expenseIncomeRatio, null);
  assert.equal(analysis.net, -25_000);
  assert.equal(analysis.closingBalance, 25_000);
  assert.ok(Number.isFinite(analysis.averageMonthlyOutflow));
});

test('empty and inflow-only periods remain mathematically stable with large amounts', () => {
  const empty = buildCashFlowAnalysis({
    transactions: [],
    openingBalance: 9_000,
    range: { start: '2026-09-01', end: '2026-09-30' },
  });
  assert.equal(empty.totalIn, 0);
  assert.equal(empty.totalOut, 0);
  assert.equal(empty.closingBalance, 9_000);
  assert.equal(empty.healthLabel, 'Insufficient data');

  const inflowOnly = buildCashFlowAnalysis({
    transactions: [transaction('large', '2026-09-15', 'in', 'Investment', 'Capital introduced', 987_654_321.98)],
    openingBalance: 1_000,
    range: { start: '2026-09-01', end: '2026-09-30' },
  });
  assert.equal(inflowOnly.totalIn, 987_654_321.98);
  assert.equal(inflowOnly.totalOut, 0);
  assert.equal(inflowOnly.net, 987_654_321.98);
  assert.equal(inflowOnly.closingBalance, 987_655_321.98);
  assert.equal(inflowOnly.expenseIncomeRatio, 0);
});

test('comparison changes retain financial direction semantics', () => {
  const analysis = buildCashFlowAnalysis({
    transactions: [
      transaction('1', '2026-09-01', 'in', 'Other Income', 'Income', 120_000),
      transaction('2', '2026-09-02', 'out', 'Marketing', 'Meta Ads', 30_000),
    ],
    comparisonTransactions: [
      transaction('3', '2026-08-01', 'in', 'Other Income', 'Income', 100_000),
      transaction('4', '2026-08-02', 'out', 'Marketing', 'Meta Ads', 20_000),
    ],
    openingBalance: 0,
    range: { start: '2026-09-01', end: '2026-09-30' },
  });
  assert.equal(analysis.inflowChange, 20);
  assert.equal(analysis.outflowChange, 50);
  assert.equal(analysis.expenseCategories[0].change, 50);
});
