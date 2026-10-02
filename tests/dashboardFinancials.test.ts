import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDashboardFinancialData,
  type DashboardCashTransactionRow,
  type DashboardDataState,
  type DashboardExpenseRow,
  type DashboardInvoiceRow,
  type DashboardReceiptRow,
} from '../src/domain/dashboardFinancials.js';
import type { CompanyCode } from '../src/domain/company.js';

const period = { start: '2026-09-01', end: '2026-09-30', asOf: '2026-09-25' };
const trendMonths = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];

function source<T>(rows: T[], state: DashboardDataState = rows.length ? 'success' : 'empty', reason?: string) {
  return { rows, state, ...(reason ? { reason } : {}) };
}

function invoice(overrides: Partial<DashboardInvoiceRow> = {}): DashboardInvoiceRow {
  return {
    id: 'invoice-1', invoice_date: '2026-09-05', due_date: '2026-09-20', taxable_value: 1_000,
    cgst_amount: 90, sgst_amount: 90, igst_amount: 0, total_amount: 1_180,
    payment_status: 'pending', invoice_type: 'gst', company: 'ritera', ...overrides,
  };
}

function receipt(overrides: Partial<DashboardReceiptRow> = {}): DashboardReceiptRow {
  return { id: 'receipt-1', date: '2026-09-10', amount_received: 500, invoice_id: 'invoice-1', is_void: false, company: 'ritera', ...overrides };
}

function expense(overrides: Partial<DashboardExpenseRow> = {}): DashboardExpenseRow {
  return { id: 'expense-1', date: '2026-09-08', taxable_amount: 400, gst_amount: 72, total_amount: 472, is_itc_eligible: true, company: 'ritera', ...overrides };
}

function cash(overrides: Partial<DashboardCashTransactionRow> = {}): DashboardCashTransactionRow {
  return { id: 'cash-1', date: '2026-09-10', type: 'in', amount: 500, company: 'ritera', ...overrides };
}

function build(input: {
  entity?: CompanyCode;
  invoices?: DashboardInvoiceRow[];
  receipts?: DashboardReceiptRow[];
  expenses?: DashboardExpenseRow[];
  cashTransactions?: DashboardCashTransactionRow[];
  states?: Partial<Record<'invoices' | 'receipts' | 'expenses' | 'cashTransactions', DashboardDataState>>;
  selectedPeriod?: typeof period;
} = {}) {
  const invoices = input.invoices ?? [];
  const receipts = input.receipts ?? [];
  const expenses = input.expenses ?? [];
  const cashTransactions = input.cashTransactions ?? [];
  return buildDashboardFinancialData({
    entity: input.entity ?? 'ritera', period: input.selectedPeriod ?? period, trendMonths,
    invoices: source(invoices, input.states?.invoices ?? (invoices.length ? 'success' : 'empty')),
    receipts: source(receipts, input.states?.receipts ?? (receipts.length ? 'success' : 'empty')),
    expenses: source(expenses, input.states?.expenses ?? (expenses.length ? 'success' : 'empty')),
    cashTransactions: source(cashTransactions, input.states?.cashTransactions ?? (cashTransactions.length ? 'success' : 'empty')),
    now: '2026-09-25T12:00:00.000Z',
  });
}

test('workspace A and B never share financial rows', () => {
  const invoices = [invoice(), invoice({ id: 'ratix-invoice', company: 'ratix', taxable_value: 9_000, total_amount: 10_620 })];
  assert.equal(build({ entity: 'ritera', invoices }).financialSnapshot.revenue.value, 1_000);
  assert.equal(build({ entity: 'ratix', invoices }).financialSnapshot.revenue.value, 9_000);
});

test('empty data is distinct from unavailable current cash', () => {
  const result = build();
  assert.equal(result.dashboardContext.state, 'empty');
  assert.equal(result.financialSnapshot.revenue.value, 0);
  assert.equal(result.financialSnapshot.revenue.state, 'empty');
  assert.equal(result.financialSnapshot.currentCash.value, null);
  assert.equal(result.financialSnapshot.currentCash.state, 'unavailable');
});

test('normal transactions keep cash and accrual concepts separate', () => {
  const result = build({ invoices: [invoice({ invoice_number: 'INV-1', client: { name: 'Acme' } })], receipts: [receipt({ receipt_number: 'RCP-1', client: { name: 'Acme' } })], expenses: [expense({ vendor_name: 'Vendor Co' })], cashTransactions: [cash(), cash({ id: 'cash-out', type: 'out', amount: 200 })] });
  assert.equal(result.financialSnapshot.cashCollected.value, 500);
  assert.equal(result.financialSnapshot.cashIn.value, 500);
  assert.equal(result.financialSnapshot.cashOut.value, 200);
  assert.equal(result.financialSnapshot.netCashMovement.value, 300);
  assert.equal(result.financialSnapshot.revenue.value, 1_000);
  assert.equal(result.financialSnapshot.operatingExpenses.value, 400);
  assert.equal(result.financialSnapshot.operatingResult.value, 600);
  assert.equal(result.financialSnapshot.operatingMargin.value, 60);
  assert.equal(result.receivables.priorityItems[0].customer, 'Acme');
  assert.equal(result.receivables.priorityItems[0].timing, 'overdue');
  assert.deepEqual(result.recentActivity.slice(0, 2).map((item) => item.type), ['payment-received', 'cash-transaction']);
});

test('cash comparison is shown only when a comparable prior period exists', () => {
  const currentOnly = build({ cashTransactions: [cash()] });
  assert.equal(currentOnly.financialSnapshot.netCashMovementComparison.value, null);
  assert.equal(currentOnly.financialSnapshot.netCashMovementComparison.state, 'unavailable');

  const comparable = build({ cashTransactions: [cash(), cash({ id: 'aug-cash', date: '2026-08-10', amount: 300 })] });
  assert.equal(comparable.financialSnapshot.netCashMovementComparison.value, 200);
  assert.equal(comparable.financialSnapshot.netCashMovementComparison.state, 'success');
});

test('voided receipts are excluded from cash collected and receivables reconciliation', () => {
  const result = build({ invoices: [invoice()], receipts: [receipt({ is_void: true, amount_received: 1_180 })] });
  assert.equal(result.financialSnapshot.cashCollected.value, 0);
  assert.equal(result.receivables.totalOutstanding.value, 1_180);
});

test('fully paid invoices never appear in receivables', () => {
  const result = build({ invoices: [invoice({ payment_status: 'paid' })] });
  assert.equal(result.receivables.totalOutstanding.value, 0);
  assert.equal(result.receivables.overdueCount, 0);
});

test('partially paid invoices use invoice total less valid linked receipts', () => {
  const result = build({ invoices: [invoice({ payment_status: 'partial' })], receipts: [receipt()] });
  assert.equal(result.receivables.totalOutstanding.value, 680);
});

test('overdue and future-due invoices are aged independently', () => {
  const invoices = [invoice(), invoice({ id: 'future', due_date: '2026-10-05', total_amount: 2_000 })];
  const result = build({ invoices });
  assert.equal(result.receivables.overdueAmount.value, 1_180);
  assert.equal(result.receivables.overdueCount, 1);
  assert.equal(result.receivables.dueSoonAmount.value, 2_000);
  assert.equal(result.receivables.dueSoonCount, 1);
});

test('GST liability uses output GST invoiced less recorded eligible ITC', () => {
  const result = build({ invoices: [invoice()], expenses: [expense()] });
  assert.equal(result.gst.outputGstInvoiced.value, 180);
  assert.equal(result.gst.itcRecorded.value, 72);
  assert.equal(result.obligations.netGstPayable.value, 108);
});

test('no GST activity is a valid empty result, not a filing-readiness claim', () => {
  const result = build({ invoices: [invoice({ invoice_type: 'non_gst', cgst_amount: 0, sgst_amount: 0 })] });
  assert.equal(result.obligations.netGstPayable.value, 0);
  assert.equal(result.obligations.gstFilingStatus, 'unavailable');
  assert.equal(result.obligations.gstDueDate, null);
});

test('database/query failure is not converted to zero', () => {
  const result = build({ states: { invoices: 'error' } });
  assert.equal(result.financialSnapshot.revenue.value, null);
  assert.equal(result.financialSnapshot.revenue.state, 'error');
  assert.equal(result.receivables.totalOutstanding.value, null);
  assert.equal(result.dashboardContext.state, 'partial');
});

test('month changes include only records inside the selected period', () => {
  const invoices = [invoice(), invoice({ id: 'aug', invoice_date: '2026-08-20', taxable_value: 700 })];
  assert.equal(build({ invoices }).financialSnapshot.revenue.value, 1_000);
  const august = { start: '2026-08-01', end: '2026-08-31', asOf: '2026-08-31' };
  assert.equal(build({ invoices, selectedPeriod: august }).financialSnapshot.revenue.value, 700);
});

test('current-month snapshot stops at today while historical month uses month end', () => {
  const invoices = [invoice(), invoice({ id: 'future-current', invoice_date: '2026-09-28', taxable_value: 5_000 })];
  assert.equal(build({ invoices }).financialSnapshot.revenue.value, 1_000);
  const historical = { start: '2026-09-01', end: '2026-09-30', asOf: '2026-09-30' };
  assert.equal(build({ invoices, selectedPeriod: historical }).financialSnapshot.revenue.value, 6_000);
});

test('missing due dates produce a partial receivables state instead of guessed aging', () => {
  const result = build({ invoices: [invoice({ due_date: null })] });
  assert.equal(result.receivables.totalOutstanding.value, 1_180);
  assert.equal(result.receivables.state, 'partial');
  assert.equal(result.receivables.overdueAmount.value, 0);
});

test('invalid cash transactions are ignored and opening history contributes to current cash', () => {
  const result = build({ cashTransactions: [cash({ id: 'opening', date: '2026-08-01', amount: 1_000 }), cash(), cash({ id: 'invalid', amount: -50 })] });
  assert.equal(result.financialSnapshot.currentCash.value, 1_500);
  assert.equal(result.financialSnapshot.cashIn.value, 500);
});
