import { useState, useEffect, useCallback } from 'react';
import { cashEntriesWithRazorpayFee, razorpayFeeId, legacyRazorpayFee } from '../domain/razorpayFee';
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

  async function createTransactions(rows: Array<Omit<CashTransaction, 'id' | 'created_at'>>) {
    // One insert keeps the payment and fee atomic, including on legacy schemas.
    const paymentId = crypto.randomUUID();
    const pairedFee = rows.length === 2 && rows[0].type === 'in' && rows[0].payment_mode === 'razorpay' && rows[1].category === 'Payment Gateway Fees';
    const identifiedRows = pairedFee
      ? [{ ...rows[0], id: paymentId }, { ...rows[1], id: await razorpayFeeId(paymentId) }]
      : rows;
    let { error } = await supabase.from('cash_transactions').insert(identifiedRows);
    if (isMissingCashTransactionCompanyColumn(error)) {
      ({ error } = await supabase.from('cash_transactions').insert(identifiedRows.map(withoutCompany)));
    }
    if (error) {
      console.error('Supabase error:', error);
      throw new Error(error.message || 'Failed to create transaction.');
    }
    await fetch();
  }

  async function createTransaction(tx: Omit<CashTransaction, 'id' | 'created_at'>) {
    await createTransactions([tx]);
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

  async function getTransactionFee(payment: CashTransaction): Promise<CashTransaction | null> {
    const feeId = await razorpayFeeId(payment.id);
    const { data: fee, error } = await supabase.from('cash_transactions').select('*').eq('id', feeId).maybeSingle();
    if (error) throw new Error('Could not load the existing Razorpay fee. Please try again.');
    if (fee) return fee as CashTransaction;
    const { data: candidates, error: legacyError } = await supabase.from('cash_transactions').select('*')
      .eq('created_at', payment.created_at).eq('category', 'Payment Gateway Fees');
    if (legacyError) throw new Error('Could not load the existing Razorpay fee. Please try again.');
    return legacyRazorpayFee(payment, (candidates || []) as CashTransaction[]);
  }

  async function updateTransactionWithFee(original: CashTransaction, data: Omit<CashTransaction, 'id' | 'created_at'>, feeInput: string) {
    const entries = cashEntriesWithRazorpayFee(data, feeInput);
    const existingFee = await getTransactionFee(original);
    const rows = [{ ...entries[0], id: original.id, created_at: original.created_at }];
    if (entries[1]) rows.push({ ...entries[1], id: existingFee?.id ?? await razorpayFeeId(original.id), created_at: existingFee?.created_at ?? new Date().toISOString() });
    let { error } = await supabase.from('cash_transactions').upsert(rows, { onConflict: 'id' });
    if (isMissingCashTransactionCompanyColumn(error)) {
      ({ error } = await supabase.from('cash_transactions').upsert(rows.map(withoutCompany), { onConflict: 'id' }));
    }
    if (error) throw new Error(error.message || 'Failed to update payment and fee.');
    if (existingFee && !entries[1]) {
      const { error: deleteError } = await supabase.from('cash_transactions').delete().eq('id', existingFee.id);
      if (deleteError) throw new Error('Payment updated, but its previous Razorpay fee could not be removed. Please retry saving.');
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

  return { transactions, loading, openingBalance, refetch: fetch, createTransactions, createTransaction, updateTransaction, updateTransactionWithFee, getTransactionFee, deleteTransaction };
}
