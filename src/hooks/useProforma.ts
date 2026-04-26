import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateDocNumber } from '../utils/documentNumber';

export type { ProformaItem, ProformaInvoice } from '../types';
import type { ProformaInvoice } from '../types';

interface Filters {
  start?: string;
  end?: string;
  sub_brand?: string;
  status?: string;
}

export function useProforma(filters?: Filters) {
  const [proformas, setProformas] = useState<ProformaInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('proforma_invoices')
      .select('*, client:clients(name, email, phone, address, state, gstin)')
      .order('date', { ascending: false });
    if (filters?.start) q = q.gte('date', filters.start);
    if (filters?.end) q = q.lte('date', filters.end);
    if (filters?.sub_brand) q = q.eq('sub_brand', filters.sub_brand);
    if (filters?.status) q = q.eq('status', filters.status);
    const { data } = await q;
    setProformas((data || []) as ProformaInvoice[]);
    setLoading(false);
  }, [filters?.start, filters?.end, filters?.sub_brand, filters?.status]);

  useEffect(() => { fetch(); }, [fetch]);

  async function createProforma(p: Omit<ProformaInvoice, 'id' | 'created_at' | 'client'>) {
    const { data, error } = await supabase.from('proforma_invoices').insert([p]).select().single();
    if (error) throw error;
    await fetch();
    return data as ProformaInvoice;
  }

  async function updateProforma(id: string, updates: Partial<Omit<ProformaInvoice, 'client'>>) {
    const { error } = await supabase.from('proforma_invoices').update(updates).eq('id', id);
    if (error) throw error;
    await fetch();
  }

  async function deleteProforma(id: string) {
    const { error } = await supabase.from('proforma_invoices').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  }

  return { proformas, loading, refetch: fetch, createProforma, updateProforma, deleteProforma };
}

export async function generateProformaNumber(): Promise<string> {
  return generateDocNumber('PRF');
}
