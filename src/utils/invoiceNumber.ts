import { supabase } from '../lib/supabase';

export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .ilike('invoice_number', `INF-${year}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1);

  if (error) throw error;

  let nextNum = 1;
  if (data && data.length > 0) {
    const lastNum = data[0].invoice_number.split('-').pop();
    nextNum = parseInt(lastNum || '0', 10) + 1;
  }

  return `INF-${year}-${String(nextNum).padStart(4, '0')}`;
}
