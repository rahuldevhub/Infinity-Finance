import { supabase } from '../lib/supabase';

type DocType = 'INV' | 'REC' | 'QTN' | 'PRF' | 'RCP';

const TABLE_MAP: Record<DocType, { table: string; column: string }> = {
  INV: { table: 'invoices',          column: 'invoice_number'  },
  REC: { table: 'invoices',          column: 'invoice_number'  },
  QTN: { table: 'quotations',        column: 'quotation_number' },
  PRF: { table: 'proforma_invoices', column: 'proforma_number' },
  RCP: { table: 'payment_receipts',  column: 'receipt_number'  },
};

export async function generateDocNumber(type: DocType, documentDate?: string): Promise<string> {
  const now = documentDate ? new Date(`${documentDate}T00:00:00`) : new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `${type}-${yy}${mm}`;

  let count: number | null = 0;

  if (type === 'INV') {
    let result = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .like('invoice_number', `${prefix}%`)
      .or('invoice_type.eq.gst,invoice_type.is.null');
    if ((result.error?.code === '42703' || result.error?.code === 'PGRST204') && result.error.message?.includes('invoice_type')) {
      result = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .like('invoice_number', `${prefix}%`);
    }
    if (result.error) throw result.error;
    count = result.count;
  } else if (type === 'REC') {
    let result = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .like('invoice_number', `${prefix}%`)
      .eq('invoice_type', 'non_gst');
    if ((result.error?.code === '42703' || result.error?.code === 'PGRST204') && result.error.message?.includes('invoice_type')) {
      result = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .like('invoice_number', `${prefix}%`);
    }
    if (result.error) throw result.error;
    count = result.count;
  } else {
    const { table, column } = TABLE_MAP[type];
    const result = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .like(column, `${prefix}%`);
    if (result.error) throw result.error;
    count = result.count;
  }

  const nn = String((count || 0) + 1).padStart(2, '0');
  return `${prefix}${nn}`;
}
