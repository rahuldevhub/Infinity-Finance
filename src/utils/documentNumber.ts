import { supabase } from '../lib/supabase';

type DocType = 'INV' | 'REC' | 'QTN' | 'PRF' | 'RCP';

const TABLE_MAP: Record<DocType, { table: string; column: string }> = {
  INV: { table: 'invoices',          column: 'invoice_number'  },
  REC: { table: 'invoices',          column: 'invoice_number'  },
  QTN: { table: 'quotations',        column: 'quotation_number' },
  PRF: { table: 'proforma_invoices', column: 'proforma_number' },
  RCP: { table: 'payment_receipts',  column: 'receipt_number'  },
};

export async function generateDocNumber(type: DocType): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `${type}-${yy}${mm}`;

  let count: number | null = 0;

  if (type === 'INV') {
    ({ count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .like('invoice_number', `${prefix}%`)
      .or('invoice_type.eq.gst,invoice_type.is.null'));
  } else if (type === 'REC') {
    ({ count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .like('invoice_number', `${prefix}%`)
      .eq('invoice_type', 'non_gst'));
  } else {
    const { table, column } = TABLE_MAP[type];
    ({ count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .like(column, `${prefix}%`));
  }

  const nn = String((count || 0) + 1).padStart(2, '0');
  return `${prefix}${nn}`;
}
