import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateDocNumber } from '../utils/documentNumber';

export type { PaymentReceipt } from '../types';
import type { PaymentReceipt } from '../types';
import { voidProjectPayment } from '../services/projectPayments';

export type PaymentMode = 'cash' | 'bank' | 'upi' | 'card' | 'razorpay' | 'cheque';

interface Filters {
  start?: string;
  end?: string;
  sub_brand?: string;
}

export function useReceipts(filters?: Filters) {
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const filterStart = filters?.start;
  const filterEnd = filters?.end;
  const filterBrand = filters?.sub_brand;

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('payment_receipts')
      .select('*, client:clients(name, email, address)')
      .order('date', { ascending: false });
    if (filterStart) q = q.gte('date', filterStart);
    if (filterEnd) q = q.lte('date', filterEnd);
    if (filterBrand) q = q.eq('sub_brand', filterBrand);
    const { data } = await q;
    setReceipts((data || []) as PaymentReceipt[]);
    setLoading(false);
  }, [filterBrand, filterEnd, filterStart]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch the active receipt filter when it changes.
    void fetch();
  }, [fetch]);

  async function createReceipt(r: Omit<PaymentReceipt, 'id' | 'created_at' | 'client'>) {
    const { data, error } = await supabase.from('payment_receipts').insert([r]).select().single();
    if (error) throw error;
    await fetch();
    return data as PaymentReceipt;
  }

  async function updateReceipt(id: string, updates: Partial<Omit<PaymentReceipt, 'client'>>) {
    const { error } = await supabase.from('payment_receipts').update(updates).eq('id', id);
    if (error) throw error;
    await fetch();
  }

  async function deleteReceipt(id: string, voidReason = 'Voided from payment receipts') {
    const receipt = receipts.find((item) => item.id === id);
    if (receipt?.project_id && receipt.reconciliation_managed) {
      await voidProjectPayment(id, voidReason);
      await fetch();
      return;
    }
    const { error } = await supabase.from('payment_receipts').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  }

  return { receipts, loading, refetch: fetch, createReceipt, updateReceipt, deleteReceipt };
}

export async function generateReceiptNumber(paymentDate?: string): Promise<string> {
  return generateDocNumber('RCP', paymentDate);
}
