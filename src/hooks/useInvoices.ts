import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Invoice } from '../types';

interface InvoiceFilters {
  start?: string;
  end?: string;
  sub_brand?: string;
  payment_status?: string;
}

export function useInvoices(filters?: InvoiceFilters) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select('*, client:clients(*)')
        .order('invoice_date', { ascending: false });

      if (filters?.start) query = query.gte('invoice_date', filters.start);
      if (filters?.end) query = query.lte('invoice_date', filters.end);
      if (filters?.sub_brand) query = query.eq('sub_brand', filters.sub_brand);
      if (filters?.payment_status) query = query.eq('payment_status', filters.payment_status);

      const { data, error } = await query;
      if (error) throw error;
      setInvoices(data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters?.start, filters?.end, filters?.sub_brand, filters?.payment_status]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  async function createInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'client'>) {
    const { data, error } = await supabase.from('invoices').insert([invoice]).select().single();
    if (error) throw error;
    await fetchInvoices();
    return data;
  }

  async function updateInvoice(id: string, updates: Partial<Invoice>) {
    const { error } = await supabase.from('invoices').update(updates).eq('id', id);
    if (error) throw error;
    await fetchInvoices();
  }

  async function deleteInvoice(id: string) {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
    await fetchInvoices();
  }

  return { invoices, loading, error, refetch: fetchInvoices, createInvoice, updateInvoice, deleteInvoice };
}
