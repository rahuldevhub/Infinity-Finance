import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateDocNumber } from '../utils/documentNumber';
import {
  getMissingProformaColumn,
  normalizeProformaDiscount,
  withoutProformaColumn,
} from '../domain/proformaCompatibility';

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
  const start = filters?.start;
  const end = filters?.end;
  const subBrand = filters?.sub_brand;
  const status = filters?.status;

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('proforma_invoices')
      .select('*, client:clients(name, email, phone, address, state, gstin), quotation:quotations(quotation_number, title, status, total_amount), project:projects(name)')
      .order('created_at', { ascending: false });
    if (start && end) {
      q = q.or(`date.is.null,and(date.gte.${start},date.lte.${end})`);
    } else if (start) {
      q = q.or(`date.is.null,date.gte.${start}`);
    } else if (end) {
      q = q.or(`date.is.null,date.lte.${end}`);
    }
    if (subBrand) q = q.eq('sub_brand', subBrand);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) {
      console.error('Failed to load proformas:', error.message);
      setProformas([]);
    } else {
      setProformas(((data || []) as ProformaInvoice[]).map(normalizeProformaDiscount));
    }
    setLoading(false);
  }, [end, start, status, subBrand]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Query state is synchronized when filter inputs change.
    void fetch();
  }, [fetch]);

  async function createProforma(p: Omit<ProformaInvoice, 'id' | 'created_at' | 'client'>) {
    let payload: Record<string, unknown> = { ...p };
    const omittedColumns = new Set<string>();

    while (true) {
      const { data, error } = await supabase.from('proforma_invoices').insert([payload]).select().single();
      if (!error) {
        await fetch();
        return normalizeProformaDiscount({ ...p, ...data } as ProformaInvoice);
      }

      const missingColumn = getMissingProformaColumn(error);
      if (!missingColumn || omittedColumns.has(missingColumn) || !(missingColumn in payload)) throw error;
      omittedColumns.add(missingColumn);
      payload = withoutProformaColumn(payload, missingColumn);
    }
  }

  async function updateProforma(id: string, updates: Partial<Omit<ProformaInvoice, 'client'>>) {
    let payload: Record<string, unknown> = { ...updates };
    const omittedColumns = new Set<string>();

    while (true) {
      const { error } = await supabase.from('proforma_invoices').update(payload).eq('id', id);
      if (!error) {
        await fetch();
        return;
      }

      const missingColumn = getMissingProformaColumn(error);
      if (!missingColumn || omittedColumns.has(missingColumn) || !(missingColumn in payload)) throw error;
      omittedColumns.add(missingColumn);
      payload = withoutProformaColumn(payload, missingColumn);
    }
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
