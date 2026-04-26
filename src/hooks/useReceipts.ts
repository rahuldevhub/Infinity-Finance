import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateDocNumber } from '../utils/documentNumber';

export type { PaymentReceipt } from '../types';
import type { PaymentReceipt } from '../types';

export type PaymentMode = 'cash' | 'bank' | 'upi' | 'card' | 'razorpay' | 'cheque';

interface Filters {
  start?: string;
  end?: string;
  sub_brand?: string;
}

export function useReceipts(filters?: Filters) {
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('payment_receipts')
      .select('*, client:clients(name, email, address)')
      .order('date', { ascending: false });
    if (filters?.start) q = q.gte('date', filters.start);
    if (filters?.end) q = q.lte('date', filters.end);
    if (filters?.sub_brand) q = q.eq('sub_brand', filters.sub_brand);
    const { data } = await q;
    setReceipts((data || []) as PaymentReceipt[]);
    setLoading(false);
  }, [filters?.start, filters?.end, filters?.sub_brand]);

  useEffect(() => { fetch(); }, [fetch]);

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

  async function deleteReceipt(id: string) {
    const { error } = await supabase.from('payment_receipts').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  }

  return { receipts, loading, refetch: fetch, createReceipt, updateReceipt, deleteReceipt };
}

export async function generateReceiptNumber(): Promise<string> {
  return generateDocNumber('RCP');
}
