import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CashTransaction } from './useCashFlow';
import type { CashFlowDateRange } from '../domain/cashFlowAnalysis';
import type { CompanyCode } from '../domain/company';
import { scopeDashboardRows } from '../domain/dashboardSourceScope';

interface AnalysisQueryState {
  transactions: CashTransaction[];
  comparisonTransactions: CashTransaction[];
  openingBalance: number;
  openingTransactionCount: number;
  loading: boolean;
  error: boolean;
}

function earlierDate(left: string, right?: string): string {
  return right && right < left ? right : left;
}

export function useCashFlowAnalysis(
  range: CashFlowDateRange,
  comparisonRange: CashFlowDateRange | null,
  company: CompanyCode,
) {
  const rangeStart = range.start;
  const rangeEnd = range.end;
  const comparisonStart = comparisonRange?.start;
  const comparisonEnd = comparisonRange?.end;
  const [state, setState] = useState<AnalysisQueryState>({
    transactions: [],
    comparisonTransactions: [],
    openingBalance: 0,
    openingTransactionCount: 0,
    loading: true,
    error: false,
  });

  const fetchAnalysis = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: false }));
    const queryStart = earlierDate(rangeStart, comparisonStart);
    const queryEnd = comparisonEnd && comparisonEnd > rangeEnd ? comparisonEnd : rangeEnd;

    const [transactionResult, openingResult] = await Promise.all([
      supabase
        .from('cash_transactions')
        .select('*')
        .gte('date', queryStart)
        .lte('date', queryEnd)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('cash_transactions')
        .select('*')
        .lt('date', rangeStart),
    ]);

    if (transactionResult.error || openingResult.error) {
      const queryError = transactionResult.error ?? openingResult.error;
      console.error(`Unable to load cash flow analysis: ${queryError?.message ?? 'Unknown query error'}${queryError?.code ? ` (${queryError.code})` : ''}`);
      setState((current) => ({ ...current, loading: false, error: true }));
      return;
    }

    const allTransactions = scopeDashboardRows((transactionResult.data ?? []) as CashTransaction[], company);
    const openingRows = scopeDashboardRows(
      (openingResult.data ?? []) as CashTransaction[],
      company,
    );
    const openingBalance = openingRows.reduce((total, item) => (
      total + (item.type === 'in' ? Number(item.amount || 0) : -Number(item.amount || 0))
    ), 0);
    const within = (transaction: CashTransaction, target: CashFlowDateRange) => (
      transaction.date >= target.start && transaction.date <= target.end
    );

    setState({
      transactions: allTransactions.filter((transaction) => within(transaction, { start: rangeStart, end: rangeEnd })),
      comparisonTransactions: comparisonStart && comparisonEnd
        ? allTransactions.filter((transaction) => within(transaction, { start: comparisonStart, end: comparisonEnd }))
        : [],
      openingBalance,
      openingTransactionCount: openingRows.length,
      loading: false,
      error: false,
    });
  }, [company, comparisonEnd, comparisonStart, rangeEnd, rangeStart]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchAnalysis(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAnalysis]);

  return { ...state, refetch: fetchAnalysis };
}
