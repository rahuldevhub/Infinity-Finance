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
  project_id?: string | null;
  client?: { name: string; gstin: string | null; address: string; state: string; state_code: string; email: string | null } | null;
  client_name_override: string | null;
  client_email_override: string | null;
  sub_brand: string;
  company?: import('../domain/company.js').CompanyCode | null;
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
  accepted_at?: string | null;
  revision_number?: number;
  updated_at?: string;
  converted_invoice_id: string | null;
  created_at: string;
  created_by: string;
  project?: { id: string; name: string; company?: import('../domain/company.js').CompanyCode | null } | null;
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
  const filterStart = filters?.start;
  const filterEnd = filters?.end;
  const filterBrand = filters?.sub_brand;
  const filterStatus = filters?.status;

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('quotations')
      .select('*, client:clients(name, gstin, address, state, state_code, email)')
      .order('date', { ascending: false });
    if (filterStart) q = q.gte('date', filterStart);
    if (filterEnd) q = q.lte('date', filterEnd);
    if (filterBrand) q = q.eq('sub_brand', filterBrand);
    if (filterStatus) q = q.eq('status', filterStatus);
    const { data, error } = await q;
    if (error) throw error;
    setQuotations((data || []) as Quotation[]);
    setLoading(false);
  }, [filterBrand, filterEnd, filterStart, filterStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch the active quotation filter when it changes.
    void fetch();
  }, [fetch]);

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
