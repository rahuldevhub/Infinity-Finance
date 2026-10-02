import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Invoice } from '../types';
import { calculateInvoiceSettlement } from '../domain/invoiceCalculations';
import { getMissingFinalInvoiceColumn, normalizeInvoiceDiscount, withoutFinalInvoiceColumn } from '../domain/invoiceCompatibility';

interface InvoiceFilters {
  start?: string;
  end?: string;
  sub_brand?: string;
  payment_status?: string;
}

function nullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

async function ensureLegacyInvoiceClient(payload: Record<string, unknown>): Promise<string> {
  const name = nullableText(payload.client_name_override);
  if (!name) throw new Error('Client name is required to create this invoice.');

  const client = {
    name,
    gstin: nullableText(payload.client_gstin_override),
    address: nullableText(payload.billing_address_override) || '',
    state: nullableText(payload.client_state_override) || '',
    state_code: nullableText(payload.place_of_supply_code) || '',
    email: nullableText(payload.client_email_override),
    phone: nullableText(payload.client_phone_override),
  };

  // A legacy invoices table cannot store a bill-to snapshot, so reuse an
  // identical saved client when possible and otherwise save this bill-to first.
  const { data: candidates, error: lookupError } = await supabase
    .from('clients')
    .select('id, name, gstin, address, state, state_code, email, phone')
    .eq('name', client.name)
    .limit(25);
  if (lookupError) throw lookupError;

  const existing = (candidates || []).find((candidate) =>
    nullableText(candidate.gstin) === client.gstin
    && (candidate.address || '') === client.address
    && (candidate.state || '') === client.state
    && (candidate.state_code || '') === client.state_code
    && nullableText(candidate.email) === client.email
    && nullableText(candidate.phone) === client.phone,
  );
  if (existing?.id) return existing.id;

  const { data, error } = await supabase.from('clients').insert([client]).select('id').single();
  if (error) throw error;
  return data.id;
}

export function useInvoices(filters?: InvoiceFilters) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const start = filters?.start;
  const end = filters?.end;
  const subBrand = filters?.sub_brand;
  const paymentStatus = filters?.payment_status;

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select('*, client:clients(*)')
        .order('invoice_date', { ascending: false });

      if (start) query = query.gte('invoice_date', start);
      if (end) query = query.lte('invoice_date', end);
      if (subBrand) query = query.eq('sub_brand', subBrand);
      if (paymentStatus) query = query.eq('payment_status', paymentStatus);

      const { data, error } = await query;
      if (error) throw error;
      const rows = ((data || []) as Invoice[]).map(normalizeInvoiceDiscount);
      const invoiceIds = rows.map((invoice) => invoice.id).filter(Boolean);
      const projectIds = rows.map((invoice) => invoice.project_id).filter((id): id is string => Boolean(id));
      let receiptRows: Array<{ invoice_id: string | null; project_id: string | null; amount_received: number; is_void?: boolean | null }> = [];

      if (invoiceIds.length > 0 || projectIds.length > 0) {
        const filters = [
          invoiceIds.length > 0 ? `invoice_id.in.(${invoiceIds.join(',')})` : '',
          projectIds.length > 0 ? `project_id.in.(${projectIds.join(',')})` : '',
        ].filter(Boolean).join(',');
        const receiptQuery = await supabase
          .from('payment_receipts')
          .select('invoice_id, project_id, amount_received, is_void')
          .or(filters);
        if (receiptQuery.error?.code === '42703' || receiptQuery.error?.code === 'PGRST204') {
          const legacyReceiptQuery = await supabase
            .from('payment_receipts')
            .select('invoice_id, project_id, amount_received')
            .or(filters);
          if (!legacyReceiptQuery.error) receiptRows = legacyReceiptQuery.data || [];
        } else if (!receiptQuery.error) {
          receiptRows = receiptQuery.data || [];
        }
      }

      setInvoices(rows.map((invoice) => {
        const receipts = receiptRows.filter((receipt) =>
          receipt.invoice_id === invoice.id
          || (Boolean(invoice.project_id) && receipt.project_id === invoice.project_id),
        );
        const settlement = calculateInvoiceSettlement(Number(invoice.total_amount || 0), receipts);
        return { ...invoice, advance_received: settlement.advanceReceived, balance_due: settlement.balanceDue };
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [end, paymentStatus, start, subBrand]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize the active invoice filters with the database.
    void fetchInvoices();
  }, [fetchInvoices]);

  async function createInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'client'>) {
    let payload: Record<string, unknown> = { ...invoice };
    const omittedColumns = new Set<string>();
    let legacyClientEnsured = false;
    while (true) {
      const { data, error } = await supabase.from('invoices').insert([payload]).select().single();
      if (!error) {
        await fetchInvoices();
        return { ...invoice, ...data };
      }
      const missingColumn = getMissingFinalInvoiceColumn(error);
      if (!missingColumn || omittedColumns.has(missingColumn) || !(missingColumn in payload)) throw error;
      if (!legacyClientEnsured && missingColumn.includes('override')) {
        payload.client_id = await ensureLegacyInvoiceClient(payload);
        legacyClientEnsured = true;
      }
      omittedColumns.add(missingColumn);
      payload = withoutFinalInvoiceColumn(payload, missingColumn);
    }
  }

  async function updateInvoice(id: string, updates: Partial<Invoice>) {
    let payload: Record<string, unknown> = { ...updates };
    const omittedColumns = new Set<string>();
    let legacyClientEnsured = false;
    while (true) {
      const { error } = await supabase.from('invoices').update(payload).eq('id', id);
      if (!error) {
        await fetchInvoices();
        return;
      }
      const missingColumn = getMissingFinalInvoiceColumn(error);
      if (!missingColumn || omittedColumns.has(missingColumn) || !(missingColumn in payload)) throw error;
      if (!legacyClientEnsured && missingColumn.includes('override')) {
        payload.client_id = await ensureLegacyInvoiceClient(payload);
        legacyClientEnsured = true;
      }
      omittedColumns.add(missingColumn);
      payload = withoutFinalInvoiceColumn(payload, missingColumn);
    }
  }

  async function deleteInvoice(id: string) {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
    await fetchInvoices();
  }

  return { invoices, loading, error, refetch: fetchInvoices, createInvoice, updateInvoice, deleteInvoice };
}
