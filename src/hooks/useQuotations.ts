import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateDocNumber } from '../utils/documentNumber';

export interface QuotationItem {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface PaymentScheduleItem {
  label: string;
  percentage: number;
  amount: number;
  milestone: string;
}

export interface Quotation {
  id: string;
  quotation_number: string;
  date: string;
  valid_until: string | null;
  client_id: string | null;
  client?: { name: string; gstin: string | null; address: string; state: string; state_code: string; email: string | null } | null;
  client_name_override: string | null;
  client_email_override: string | null;
  sub_brand: string;
  title: string;
  consultant_name?: string | null;
  items: QuotationItem[];
  taxable_value: number;
  include_gst: boolean;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  is_igst: boolean;
  total_amount: number;
  discount_type?: 'flat' | 'percent';
  discount_value?: number;
  discount_amount?: number;
  payment_schedule?: PaymentScheduleItem[];
  notes: string | null;
  terms: string | null;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'converted';
  converted_invoice_id: string | null;
  created_at: string;
  created_by: string;
}

interface Filters {
  start?: string;
  end?: string;
  sub_brand?: string;
  status?: string;
}

export function useQuotations(filters?: Filters) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('quotations')
      .select('*, client:clients(name, gstin, address, state, state_code, email)')
      .order('date', { ascending: false });
    if (filters?.start) q = q.gte('date', filters.start);
    if (filters?.end) q = q.lte('date', filters.end);
    if (filters?.sub_brand) q = q.eq('sub_brand', filters.sub_brand);
    if (filters?.status) q = q.eq('status', filters.status);
    const { data } = await q;
    setQuotations((data || []) as Quotation[]);
    setLoading(false);
  }, [filters?.start, filters?.end, filters?.sub_brand, filters?.status]);

  useEffect(() => { fetch(); }, [fetch]);

  async function createQuotation(q: Omit<Quotation, 'id' | 'created_at' | 'client'>) {
    const { data, error } = await supabase.from('quotations').insert([q]).select().single();
    if (error) throw error;
    await fetch();
    return data as Quotation;
  }

  async function updateQuotation(id: string, updates: Partial<Quotation>) {
    const { error } = await supabase.from('quotations').update(updates).eq('id', id);
    if (error) throw error;
    await fetch();
  }

  async function deleteQuotation(id: string) {
    const { error } = await supabase.from('quotations').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  }

  return { quotations, loading, refetch: fetch, createQuotation, updateQuotation, deleteQuotation };
}

export async function generateQuotationNumber(): Promise<string> {
  return generateDocNumber('QTN');
}
