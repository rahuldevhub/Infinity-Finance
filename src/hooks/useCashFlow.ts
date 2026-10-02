import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { scopeDashboardRows } from '../domain/dashboardSourceScope';
import { isMissingCashTransactionCompanyColumn, withoutCompany } from '../domain/cashTransactionCompatibility';

export interface CashTransaction {
  id: string;
  date: string;
  type: 'in' | 'out';
  category: string;
  description: string;
  amount: number;
  payment_mode: 'cash' | 'bank' | 'upi' | 'card' | 'razorpay';
  reference: string | null;
  sub_brand: string | null;
  company: import('../domain/company').CompanyCode | null;
  created_at: string;
  created_by: string;
}

interface Filters {
  start?: string;
  end?: string;
  type?: 'in' | 'out';
  company?: import('../domain/company').CompanyCode;
}

export function useCashFlow(filters?: Filters) {
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingBalance, setOpeningBalance] = useState(0);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('cash_transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
    if (filters?.start) q = q.gte('date', filters.start);
    if (filters?.end) q = q.lte('date', filters.end);
    if (filters?.type) q = q.eq('type', filters.type);
    const { data } = await q;
    const periodRows = (data || []) as CashTransaction[];
    setTransactions(filters?.company ? scopeDashboardRows(periodRows, filters.company) : periodRows);

    // Calculate opening balance: sum of all transactions before the start date
    if (filters?.start) {
      const { data: prevData } = await supabase
        .from('cash_transactions')
        .select('*')
        .lt('date', filters.start);
      const rawPreviousRows = (prevData || []) as CashTransaction[];
      const previousRows = filters?.company
        ? scopeDashboardRows(rawPreviousRows, filters.company)
        : rawPreviousRows;
      const bal = previousRows.reduce((sum, t) => {
        const amount = Number(t.amount || 0);
        return sum + (t.type === 'in' ? amount : -amount);
      }, 0);
      setOpeningBalance(bal);
    } else {
      setOpeningBalance(0);
    }

    setLoading(false);
  }, [filters?.start, filters?.end, filters?.type, filters?.company]);

  useEffect(() => { fetch(); }, [fetch]);

  async function createTransaction(tx: Omit<CashTransaction, 'id' | 'created_at'>) {
    let { error } = await supabase.from('cash_transactions').insert([tx]);
    if (isMissingCashTransactionCompanyColumn(error)) {
      ({ error } = await supabase.from('cash_transactions').insert([withoutCompany(tx)]));
    }
    if (error) {
      console.error('Supabase error:', error);
      throw new Error(error.message || 'Failed to create transaction.');
    }
    await fetch();
  }

  async function updateTransaction(id: string, data: Omit<CashTransaction, 'id' | 'created_at'>) {
    let { error } = await supabase.from('cash_transactions').update({ ...data }).eq('id', id);
    if (isMissingCashTransactionCompanyColumn(error)) {
      ({ error } = await supabase.from('cash_transactions').update(withoutCompany(data)).eq('id', id));
    }
    if (error) {
      console.error('Supabase error:', error);
      throw new Error(error.message || 'Failed to update transaction.');
    }
    await fetch();
  }

  async function deleteTransaction(id: string) {
    const { error } = await supabase.from('cash_transactions').delete().eq('id', id);
    if (error) {
      console.error('Supabase error:', error);
      throw new Error(error.message || 'Failed to delete transaction.');
    }
    await fetch();
  }

  return { transactions, loading, openingBalance, refetch: fetch, createTransaction, updateTransaction, deleteTransaction };
}
