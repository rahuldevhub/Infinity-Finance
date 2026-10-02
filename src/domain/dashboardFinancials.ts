import type { CompanyCode } from './company.js';

export type DashboardDataState = 'success' | 'empty' | 'error' | 'stale' | 'partial' | 'unavailable';
export type AccountingBasis = 'cash' | 'accrual' | 'ledger' | 'estimated-tax';

export interface DashboardMetric {
  value: number | null;
  state: DashboardDataState;
  basis: AccountingBasis;
  definition: string;
  reason?: string;
}

export interface DashboardInvoiceRow {
  id: string;
  invoice_date: string;
  due_date: string | null;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  payment_status: 'paid' | 'pending' | 'partial';
  invoice_type?: 'gst' | 'non_gst' | null;
  company: CompanyCode | null;
  sub_brand?: string | null;
  invoice_number?: string;
  client?: { name?: string | null } | null;
}

export interface DashboardReceiptRow {
  id: string;
  date: string;
  amount_received: number;
  invoice_id: string | null;
  is_void?: boolean | null;
  company: CompanyCode | null;
  sub_brand?: string | null;
  client_name_override?: string | null;
  receipt_number?: string;
  towards?: string | null;
  client?: { name?: string | null } | null;
}

export interface DashboardExpenseRow {
  id: string;
  date: string;
  taxable_amount: number;
  gst_amount: number;
  total_amount: number;
  is_itc_eligible: boolean;
  company: CompanyCode | null;
  sub_brand?: string | null;
  vendor_name?: string;
  description?: string;
}

export interface DashboardCashTransactionRow {
  id: string;
  date: string;
  type: 'in' | 'out';
  amount: number;
  company: CompanyCode | null;
  sub_brand?: string | null;
  description?: string;
  category?: string;
}

export interface DashboardDataset<T> {
  state: DashboardDataState;
  rows: T[];
  reason?: string;
}

export interface DashboardPeriod {
  start: string;
  end: string;
  asOf: string;
}

export interface DashboardAttentionItem {
  type: 'receivables' | 'cash' | 'gst' | 'data-quality';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  impact: number | null;
  dueDate: string | null;
  action: string;
}

export interface DashboardTrendPoint {
  month: string;
  collections: number;
  revenue: number;
  operatingExpenses: number;
  operatingResult: number;
}

export interface DashboardReceivableItem {
  id: string;
  invoiceNumber: string;
  customer: string;
  invoiceTotal: number;
  outstanding: number;
  dueDate: string | null;
  timing: 'paid' | 'overdue' | 'due-soon' | 'later' | 'unclassified';
  daysFromDue: number | null;
}

export interface DashboardActivityItem {
  id: string;
  type: 'payment-received' | 'invoice-issued' | 'expense-recorded' | 'cash-transaction';
  date: string;
  title: string;
  counterparty: string;
  amount: number;
  direction: 'in' | 'out' | 'neutral';
  href: string;
}

export interface DashboardFinancialData {
  dashboardContext: {
    entity: CompanyCode;
    period: DashboardPeriod;
    accountingBasis: {
      cash: 'cash_transactions ledger';
      revenue: 'invoice-date accrual, excluding GST';
      expenses: 'expense-date accrual, net of eligible ITC';
    };
    lastUpdated: string;
    state: DashboardDataState;
  };
  financialSnapshot: {
    currentCash: DashboardMetric;
    cashCollected: DashboardMetric;
    cashCollectedComparison: DashboardMetric;
    cashIn: DashboardMetric;
    cashOut: DashboardMetric;
    netCashMovement: DashboardMetric;
    revenue: DashboardMetric;
    operatingExpenses: DashboardMetric;
    operatingResult: DashboardMetric;
    operatingMargin: DashboardMetric;
    netCashMovementComparison: DashboardMetric;
  };
  receivables: {
    totalOutstanding: DashboardMetric;
    overdueAmount: DashboardMetric;
    dueSoonAmount: DashboardMetric;
    overdueCount: number | null;
    dueSoonCount: number | null;
    state: DashboardDataState;
    priorityItems: DashboardReceivableItem[];
  };
  obligations: {
    dueSoon: DashboardMetric;
    netGstPayable: DashboardMetric;
    gstDueDate: string | null;
    gstFilingStatus: DashboardDataState;
    gstDataQuality: DashboardDataState;
  };
  gst: {
    outputGstInvoiced: DashboardMetric;
    itcRecorded: DashboardMetric;
  };
  attention: DashboardAttentionItem[];
  performanceTrend: DashboardTrendPoint[];
  recentActivity: DashboardActivityItem[];
}

const DEFINITIONS = {
  currentCash: 'Closing balance of valid cash_transactions for the entity through the snapshot date.',
  cashCollected: 'Non-void payment receipts dated inside the selected period.',
  cashIn: 'Valid inbound cash_transactions dated inside the selected period.',
  cashOut: 'Valid outbound cash_transactions dated inside the selected period.',
  netCashMovement: 'Cash In minus Cash Out for the selected period.',
  revenue: 'Taxable value of invoices issued in the selected period, excluding GST.',
  operatingExpenses: 'Recorded expenses in the selected period, excluding GST marked eligible for ITC.',
  operatingResult: 'Revenue minus Operating Expenses on an invoice/expense-date accrual basis.',
  operatingMargin: 'Operating Result divided by Revenue.',
  receivables: 'Invoice total less non-void, invoice-linked receipts through the snapshot date.',
  outputGst: 'GST charged on GST invoices issued in the selected period.',
  itc: 'GST on recorded expenses marked eligible for ITC in the selected period.',
  netGst: 'Output GST Invoiced minus recorded eligible ITC; an estimate, not a filed liability.',
} as const;

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function sum(values: number[]): number {
  return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
}

function metric(
  value: number | null,
  state: DashboardDataState,
  basis: AccountingBasis,
  definition: string,
  reason?: string,
): DashboardMetric {
  return { value, state, basis, definition, ...(reason ? { reason } : {}) };
}

function stateFor(rows: unknown[], source: DashboardDataset<unknown>): DashboardDataState {
  if (source.state === 'error' || source.state === 'unavailable' || source.state === 'stale') return source.state;
  if (source.state === 'partial') return 'partial';
  return rows.length === 0 ? 'empty' : 'success';
}

function inPeriod(date: string, period: DashboardPeriod): boolean {
  return date >= period.start && date <= period.asOf;
}

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateUtc(dateString: string): number {
  const [year, month, day] = dateString.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(from: string, to: string): number {
  return Math.round((dateUtc(to) - dateUtc(from)) / 86_400_000);
}

function previousComparablePeriod(period: DashboardPeriod): { start: string; end: string } {
  const [year, month] = period.start.split('-').map(Number);
  const previousStart = new Date(year, month - 2, 1);
  const previousLastDay = new Date(year, month - 1, 0).getDate();
  const elapsedDays = daysBetween(period.start, period.asOf) + 1;
  const endDay = Math.min(elapsedDays, previousLastDay);
  const start = `${previousStart.getFullYear()}-${String(previousStart.getMonth() + 1).padStart(2, '0')}-01`;
  const end = `${previousStart.getFullYear()}-${String(previousStart.getMonth() + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  return { start, end };
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function sourceFailureMetric(source: DashboardDataset<unknown>, basis: AccountingBasis, definition: string): DashboardMetric | null {
  if (source.state === 'error' || source.state === 'unavailable' || source.state === 'stale') {
    return metric(null, source.state, basis, definition, source.reason);
  }
  return null;
}

export function buildDashboardFinancialData(input: {
  entity: CompanyCode;
  period: DashboardPeriod;
  invoices: DashboardDataset<DashboardInvoiceRow>;
  receipts: DashboardDataset<DashboardReceiptRow>;
  expenses: DashboardDataset<DashboardExpenseRow>;
  cashTransactions: DashboardDataset<DashboardCashTransactionRow>;
  trendMonths: string[];
  now?: string;
}): DashboardFinancialData {
  const { entity, period } = input;
  const scopedInvoices = input.invoices.rows.filter((row) => row.company === entity && row.invoice_date <= period.asOf);
  const scopedReceipts = input.receipts.rows.filter((row) => (
    row.company === entity && row.date <= period.asOf && row.is_void !== true && isFiniteNonNegative(Number(row.amount_received)) && Number(row.amount_received) > 0
  ));
  const scopedExpenses = input.expenses.rows.filter((row) => row.company === entity && row.date <= period.asOf);
  const scopedCash = input.cashTransactions.rows.filter((row) => (
    row.company === entity && row.date <= period.asOf && isFiniteNonNegative(Number(row.amount)) && Number(row.amount) > 0
  ));

  const periodInvoices = scopedInvoices.filter((row) => inPeriod(row.invoice_date, period));
  const periodReceipts = scopedReceipts.filter((row) => inPeriod(row.date, period));
  const periodExpenses = scopedExpenses.filter((row) => inPeriod(row.date, period));
  const periodCash = scopedCash.filter((row) => inPeriod(row.date, period));

  const revenueFailure = sourceFailureMetric(input.invoices, 'accrual', DEFINITIONS.revenue);
  const expenseFailure = sourceFailureMetric(input.expenses, 'accrual', DEFINITIONS.operatingExpenses);
  const receiptFailure = sourceFailureMetric(input.receipts, 'cash', DEFINITIONS.cashCollected);
  const cashFailure = sourceFailureMetric(input.cashTransactions, 'ledger', DEFINITIONS.currentCash);

  const revenueValue = sum(periodInvoices.filter((row) => isFiniteNonNegative(Number(row.taxable_value))).map((row) => Number(row.taxable_value)));
  const operatingExpenseValue = sum(periodExpenses
    .filter((row) => isFiniteNonNegative(Number(row.total_amount)) && isFiniteNonNegative(Number(row.gst_amount)))
    .map((row) => Math.max(0, Number(row.total_amount) - (row.is_itc_eligible ? Number(row.gst_amount) : 0))));
  const cashInValue = sum(periodCash.filter((row) => row.type === 'in').map((row) => Number(row.amount)));
  const cashOutValue = sum(periodCash.filter((row) => row.type === 'out').map((row) => Number(row.amount)));
  const previousPeriod = previousComparablePeriod(period);
  const previousCash = scopedCash.filter((row) => row.date >= previousPeriod.start && row.date <= previousPeriod.end);
  const previousNetCash = sum(previousCash.map((row) => row.type === 'in' ? Number(row.amount) : -Number(row.amount)));
  const previousReceipts = scopedReceipts.filter((row) => row.date >= previousPeriod.start && row.date <= previousPeriod.end);
  const previousCollected = sum(previousReceipts.map((row) => Number(row.amount_received)));
  const currentCashValue = sum(scopedCash.map((row) => row.type === 'in' ? Number(row.amount) : -Number(row.amount)));
  const cashCollectedValue = sum(periodReceipts.map((row) => Number(row.amount_received)));
  const operatingResultValue = Math.round((revenueValue - operatingExpenseValue) * 100) / 100;
  const operatingMarginValue = revenueValue > 0 ? Math.round((operatingResultValue / revenueValue) * 10_000) / 100 : null;

  const invoiceReceipts = new Map<string, number>();
  scopedReceipts.forEach((receipt) => {
    if (!receipt.invoice_id) return;
    invoiceReceipts.set(receipt.invoice_id, (invoiceReceipts.get(receipt.invoice_id) ?? 0) + Number(receipt.amount_received));
  });
  const receivableRows = scopedInvoices.map((invoice) => {
    const total = isFiniteNonNegative(Number(invoice.total_amount)) ? Number(invoice.total_amount) : 0;
    const received = invoiceReceipts.get(invoice.id) ?? 0;
    const outstanding = invoice.payment_status === 'paid' ? 0 : Math.max(0, total - received);
    return { invoice, outstanding };
  }).filter((row) => row.outstanding > 0);
  const dueSoonEnd = addDays(period.asOf, 30);
  const overdueRows = receivableRows.filter(({ invoice }) => Boolean(invoice.due_date && invoice.due_date < period.asOf));
  const dueSoonRows = receivableRows.filter(({ invoice }) => Boolean(invoice.due_date && invoice.due_date >= period.asOf && invoice.due_date <= dueSoonEnd));
  const priorityItems: DashboardReceivableItem[] = scopedInvoices
    .map((invoice) => {
      const invoiceTotal = isFiniteNonNegative(Number(invoice.total_amount)) ? Number(invoice.total_amount) : 0;
      const received = invoiceReceipts.get(invoice.id) ?? 0;
      const outstanding = invoice.payment_status === 'paid' ? 0 : Math.max(0, invoiceTotal - received);
      const timing: DashboardReceivableItem['timing'] = outstanding === 0 || invoice.payment_status === 'paid' ? 'paid'
        : !invoice.due_date ? 'unclassified'
          : invoice.due_date < period.asOf ? 'overdue'
            : invoice.due_date <= dueSoonEnd ? 'due-soon' : 'later';
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number || 'Invoice',
        customer: invoice.client?.name || 'Customer unavailable',
        invoiceTotal,
        outstanding,
        dueDate: invoice.due_date,
        timing,
        daysFromDue: invoice.due_date ? Math.abs(daysBetween(invoice.due_date, period.asOf)) : null,
        invoiceDate: invoice.invoice_date,
      };
    })
    .sort((left, right) => {
      const rank = { overdue: 0, 'due-soon': 1, unclassified: 2, later: 3, paid: 4 };
      return rank[left.timing] - rank[right.timing]
        || (left.timing === 'paid' ? right.invoiceDate.localeCompare(left.invoiceDate) : right.outstanding - left.outstanding);
    })
    .map(({ invoiceDate: _invoiceDate, ...item }) => item)
    .slice(0, 4);
  const receivablesUnavailable = sourceFailureMetric(input.invoices, 'accrual', DEFINITIONS.receivables)
    ?? sourceFailureMetric(input.receipts, 'cash', DEFINITIONS.receivables);
  const missingDueDates = receivableRows.some(({ invoice }) => !invoice.due_date);
  const receivablesState: DashboardDataState = receivablesUnavailable
    ? receivablesUnavailable.state
    : missingDueDates || input.invoices.state === 'partial' || input.receipts.state === 'partial'
      ? 'partial'
      : receivableRows.length === 0 ? 'empty' : 'success';
  const receivablesReason = missingDueDates
    ? 'Some outstanding invoices have no due date and cannot be aged.'
    : undefined;

  const gstInvoices = periodInvoices.filter((row) => row.invoice_type !== 'non_gst');
  const outputGstValue = sum(gstInvoices.map((row) => (
    Number(row.cgst_amount || 0) + Number(row.sgst_amount || 0) + Number(row.igst_amount || 0)
  )));
  const itcValue = sum(periodExpenses.filter((row) => row.is_itc_eligible).map((row) => Number(row.gst_amount || 0)));
  const netGstValue = Math.round((outputGstValue - itcValue) * 100) / 100;
  const gstSourceFailure = revenueFailure ?? expenseFailure;
  const gstState: DashboardDataState = gstSourceFailure?.state
    ?? (input.invoices.state === 'partial' || input.expenses.state === 'partial' ? 'partial' : (gstInvoices.length || periodExpenses.length ? 'success' : 'empty'));

  const trend = input.trendMonths.map((month) => {
    const monthCollections = sum(scopedReceipts.filter((row) => monthKey(row.date) === month).map((row) => Number(row.amount_received)));
    const monthRevenue = sum(scopedInvoices.filter((row) => monthKey(row.invoice_date) === month).map((row) => Number(row.taxable_value || 0)));
    const monthExpenses = sum(scopedExpenses.filter((row) => monthKey(row.date) === month).map((row) => (
      Math.max(0, Number(row.total_amount || 0) - (row.is_itc_eligible ? Number(row.gst_amount || 0) : 0))
    )));
    return { month, collections: monthCollections, revenue: monthRevenue, operatingExpenses: monthExpenses, operatingResult: Math.round((monthRevenue - monthExpenses) * 100) / 100 };
  });

  const recentActivity: DashboardActivityItem[] = [
    ...scopedReceipts.map((row) => ({
      id: `receipt-${row.id}`,
      type: 'payment-received' as const,
      date: row.date,
      title: row.receipt_number ? `Payment ${row.receipt_number}` : 'Payment received',
      counterparty: row.client?.name || row.client_name_override || row.towards || 'Customer payment',
      amount: Number(row.amount_received),
      direction: 'in' as const,
      href: `/receipts/${row.id}/edit`,
    })),
    ...scopedInvoices.map((row) => ({
      id: `invoice-${row.id}`,
      type: 'invoice-issued' as const,
      date: row.invoice_date,
      title: row.invoice_number ? `Invoice ${row.invoice_number}` : 'Invoice issued',
      counterparty: row.client?.name || 'Customer unavailable',
      amount: Number(row.total_amount),
      direction: 'neutral' as const,
      href: `/invoices/${row.id}/edit`,
    })),
    ...scopedExpenses.map((row) => ({
      id: `expense-${row.id}`,
      type: 'expense-recorded' as const,
      date: row.date,
      title: 'Expense recorded',
      counterparty: row.vendor_name || row.description || 'Business expense',
      amount: Number(row.total_amount),
      direction: 'out' as const,
      href: '/expenses',
    })),
    ...scopedCash.filter((row) => !scopedReceipts.some((receipt) => receipt.date === row.date && Number(receipt.amount_received) === Number(row.amount))).map((row) => ({
      id: `cash-${row.id}`,
      type: 'cash-transaction' as const,
      date: row.date,
      title: row.type === 'in' ? 'Cash inflow recorded' : 'Cash outflow recorded',
      counterparty: row.description || row.category || 'Cash ledger',
      amount: Number(row.amount),
      direction: row.type === 'in' ? 'in' as const : 'out' as const,
      href: '/cash-flow',
    })),
  ].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 8);

  const attention: DashboardAttentionItem[] = [];
  const overdueAmount = sum(overdueRows.map((row) => row.outstanding));
  if (overdueAmount > 0) attention.push({
    type: 'receivables', severity: 'warning', title: `${overdueRows.length} overdue invoice${overdueRows.length === 1 ? '' : 's'}`,
    impact: overdueAmount, dueDate: null, action: 'Review overdue invoices',
  });
  if (cashFailure) attention.push({
    type: 'cash', severity: 'warning', title: 'Cash position is unavailable', impact: null, dueDate: null, action: 'Review cash ledger',
  });
  if (!cashFailure && scopedCash.length > 0 && currentCashValue < 0) attention.push({
    type: 'cash', severity: 'critical', title: 'Cash ledger balance is negative', impact: Math.abs(currentCashValue), dueDate: null, action: 'Review cash transactions',
  });
  if (!gstSourceFailure && netGstValue > 0) attention.push({
    type: 'gst', severity: 'info', title: 'Estimated net GST payable', impact: netGstValue, dueDate: null, action: 'Review GST Summary',
  });
  if (receivablesState === 'partial') attention.push({
    type: 'data-quality', severity: 'warning', title: 'Receivables data needs review', impact: null, dueDate: null, action: 'Review invoice dates and receipt links',
  });

  const sourceStates = [input.invoices.state, input.receipts.state, input.expenses.state, input.cashTransactions.state];
  const overallState: DashboardDataState = sourceStates.every((state) => state === 'error') ? 'error'
    : sourceStates.some((state) => state === 'error' || state === 'partial' || state === 'unavailable') ? 'partial'
      : sourceStates.some((state) => state === 'stale') ? 'stale'
        : periodInvoices.length || periodReceipts.length || periodExpenses.length || periodCash.length ? 'success' : 'empty';

  const cashState = cashFailure ? cashFailure.state : stateFor(periodCash, input.cashTransactions);
  const currentCashState: DashboardDataState = cashFailure ? cashFailure.state : scopedCash.length ? 'success' : 'unavailable';
  const currentCashReason = scopedCash.length ? undefined : 'No entity-scoped cash ledger entries are available; a current balance cannot be asserted.';
  const revenueState = revenueFailure ? revenueFailure.state : stateFor(periodInvoices, input.invoices);
  const expenseState = expenseFailure ? expenseFailure.state : stateFor(periodExpenses, input.expenses);

  return {
    dashboardContext: {
      entity,
      period,
      accountingBasis: {
        cash: 'cash_transactions ledger',
        revenue: 'invoice-date accrual, excluding GST',
        expenses: 'expense-date accrual, net of eligible ITC',
      },
      lastUpdated: input.now ?? new Date().toISOString(),
      state: overallState,
    },
    financialSnapshot: {
      currentCash: cashFailure ?? metric(scopedCash.length ? currentCashValue : null, currentCashState, 'ledger', DEFINITIONS.currentCash, currentCashReason),
      cashCollected: receiptFailure ?? metric(cashCollectedValue, stateFor(periodReceipts, input.receipts), 'cash', DEFINITIONS.cashCollected),
      cashCollectedComparison: receiptFailure ?? metric(
        previousCollected > 0 ? Math.round(((cashCollectedValue - previousCollected) / previousCollected) * 10_000) / 100 : null,
        previousCollected > 0 ? 'success' : 'unavailable',
        'cash',
        'Percentage change in valid payment receipts versus the immediately preceding comparable period.',
        previousCollected > 0 ? undefined : 'No comparable prior-period collections.',
      ),
      cashIn: cashFailure ? { ...cashFailure, definition: DEFINITIONS.cashIn } : metric(cashInValue, cashState, 'ledger', DEFINITIONS.cashIn),
      cashOut: cashFailure ? { ...cashFailure, definition: DEFINITIONS.cashOut } : metric(cashOutValue, cashState, 'ledger', DEFINITIONS.cashOut),
      netCashMovement: cashFailure ? { ...cashFailure, definition: DEFINITIONS.netCashMovement } : metric(cashInValue - cashOutValue, cashState, 'ledger', DEFINITIONS.netCashMovement),
      revenue: revenueFailure ?? metric(revenueValue, revenueState, 'accrual', DEFINITIONS.revenue),
      operatingExpenses: expenseFailure ?? metric(operatingExpenseValue, expenseState, 'accrual', DEFINITIONS.operatingExpenses),
      operatingResult: revenueFailure ?? expenseFailure ?? metric(operatingResultValue, revenueState === 'partial' || expenseState === 'partial' ? 'partial' : (periodInvoices.length || periodExpenses.length ? 'success' : 'empty'), 'accrual', DEFINITIONS.operatingResult),
      operatingMargin: revenueFailure ?? expenseFailure ?? metric(operatingMarginValue, revenueValue > 0 ? 'success' : 'unavailable', 'accrual', DEFINITIONS.operatingMargin, revenueValue > 0 ? undefined : 'Operating margin requires non-zero revenue.'),
      netCashMovementComparison: cashFailure
        ? { ...cashFailure, definition: 'Difference between net cash movement and the immediately preceding comparable period.' }
        : metric(previousCash.length ? Math.round(((cashInValue - cashOutValue) - previousNetCash) * 100) / 100 : null, previousCash.length ? 'success' : 'unavailable', 'ledger', 'Difference between net cash movement and the immediately preceding comparable period.', previousCash.length ? undefined : 'No comparable prior-period cash-ledger activity.'),
    },
    receivables: {
      totalOutstanding: receivablesUnavailable ?? metric(sum(receivableRows.map((row) => row.outstanding)), receivablesState, 'accrual', DEFINITIONS.receivables, receivablesReason),
      overdueAmount: receivablesUnavailable ?? metric(overdueAmount, receivablesState, 'accrual', `${DEFINITIONS.receivables} Due date is before the snapshot date.`, receivablesReason),
      dueSoonAmount: receivablesUnavailable ?? metric(sum(dueSoonRows.map((row) => row.outstanding)), receivablesState, 'accrual', `${DEFINITIONS.receivables} Due within 30 days of the snapshot date.`, receivablesReason),
      overdueCount: receivablesUnavailable ? null : overdueRows.length,
      dueSoonCount: receivablesUnavailable ? null : dueSoonRows.length,
      state: receivablesState,
      priorityItems,
    },
    obligations: {
      dueSoon: metric(null, 'unavailable', 'accrual', 'Committed vendor and statutory amounts due within 30 days.', 'The current schema does not store vendor payment due dates or payment status.'),
      netGstPayable: gstSourceFailure ?? metric(netGstValue, gstState, 'estimated-tax', DEFINITIONS.netGst),
      gstDueDate: null,
      gstFilingStatus: 'unavailable',
      gstDataQuality: gstState === 'success' ? 'partial' : gstState,
    },
    gst: {
      outputGstInvoiced: revenueFailure ?? metric(outputGstValue, gstState, 'estimated-tax', DEFINITIONS.outputGst),
      itcRecorded: expenseFailure ?? metric(itcValue, gstState, 'estimated-tax', DEFINITIONS.itc),
    },
    attention,
    performanceTrend: trend,
    recentActivity,
  };
}
