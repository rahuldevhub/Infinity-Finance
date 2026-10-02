import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../context/WorkspaceContext';
import { isCompanyCode } from '../domain/company';
import { scopeDashboardRows } from '../domain/dashboardSourceScope';
import {
  buildDashboardFinancialData,
  type DashboardCashTransactionRow,
  type DashboardDataState,
  type DashboardDataset,
  type DashboardExpenseRow,
  type DashboardFinancialData,
  type DashboardInvoiceRow,
  type DashboardReceiptRow,
} from '../domain/dashboardFinancials';
import { getMonthRange, toLocalDateString } from '../utils/formatters';

function dataset<T>(rows: T[] | null, error: { message?: string } | null, label: string): DashboardDataset<T> {
  if (error) return { state: 'error', rows: [], reason: `${label} could not be loaded.` };
  return { state: rows?.length ? 'success' : 'empty', rows: rows ?? [] };
}

function trendMonthKeys(year: number, month: number, count = 6): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month - (count - 1 - index), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

function earliestTrendDate(year: number, month: number): string {
  return toLocalDateString(new Date(year, month - 5, 1));
}

export function useDashboard(year: number, month: number) {
  const { workspace } = useWorkspace();
  const entity = isCompanyCode(workspace.id) ? workspace.id : 'infinity';
  const [dashboard, setDashboard] = useState<DashboardFinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const requested = getMonthRange(year, month);
    const today = toLocalDateString();
    const asOf = requested.end < today ? requested.end : today;
    const period = { ...requested, asOf };
    const trendStart = earliestTrendDate(year, month);
    const trendMonths = trendMonthKeys(year, month);

    const [invoiceResult, receiptResult, expenseResult, cashResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, client:clients(name)')
        .lte('invoice_date', asOf),
      supabase
        .from('payment_receipts')
        .select('*, client:clients(name)')
        .lte('date', asOf)
        .or('is_void.eq.false,is_void.is.null'),
      supabase
        .from('expenses')
        .select('*')
        .gte('date', trendStart)
        .lte('date', asOf),
      supabase
        .from('cash_transactions')
        .select('*')
        .lte('date', asOf),
    ]);

    const invoiceRows = scopeDashboardRows((invoiceResult.data ?? []) as DashboardInvoiceRow[], entity);
    const receiptRows = scopeDashboardRows((receiptResult.data ?? []) as DashboardReceiptRow[], entity);
    const expenseRows = scopeDashboardRows((expenseResult.data ?? []) as DashboardExpenseRow[], entity);
    const cashRows = scopeDashboardRows((cashResult.data ?? []) as DashboardCashTransactionRow[], entity);

    const invoiceDataset = dataset(invoiceRows, invoiceResult.error, 'Invoice data');
    const receiptDataset = dataset(receiptRows, receiptResult.error, 'Receipt data');
    const expenseDataset = dataset(expenseRows, expenseResult.error, 'Expense data');
    const cashDataset = dataset(cashRows, cashResult.error, 'Cash-ledger data');

    const nextDashboard = buildDashboardFinancialData({
      entity,
      period,
      invoices: invoiceDataset,
      receipts: receiptDataset,
      expenses: expenseDataset,
      cashTransactions: cashDataset,
      trendMonths,
    });

    const failures = [invoiceDataset, receiptDataset, expenseDataset, cashDataset]
      .filter((source) => source.state === 'error')
      .map((source) => source.reason)
      .filter(Boolean);

    setDashboard(nextDashboard);
    setError(failures.length ? failures.join(' ') : null);
    setLoading(false);
  }, [entity, month, year]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  return { dashboard, loading, error, refetch: fetchDashboardData };
}

export type { DashboardDataState };
