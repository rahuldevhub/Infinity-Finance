import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { DashboardStats, MonthlyData } from '../types';
import { getMonthRange } from '../utils/formatters';

export function useDashboard(year: number, month: number) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [year, month]);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const { start, end } = getMonthRange(year, month);

      // GST invoices only — for GST-specific metrics (output tax, taxable sales)
      const { data: gstInvoices } = await supabase
        .from('invoices')
        .select('taxable_value, cgst_amount, sgst_amount, igst_amount, total_amount, payment_status')
        .gte('invoice_date', start)
        .lte('invoice_date', end)
        .or('invoice_type.eq.gst,invoice_type.is.null');

      // All invoices — for total revenue and pending counts
      const { data: allInvoices } = await supabase
        .from('invoices')
        .select('total_amount, taxable_value, invoice_type, payment_status')
        .gte('invoice_date', start)
        .lte('invoice_date', end);

      // Current month expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', start)
        .lte('date', end);

      // Pending proformas (not paid or cancelled)
      const { data: pendingProformas } = await supabase
        .from('proforma_invoices')
        .select('id', { count: 'exact', head: false })
        .not('status', 'in', '("paid","cancelled")');

      const gstInv = gstInvoices || [];
      const allInv = allInvoices || [];
      const exp = expenses || [];

      const totalSales = gstInv.reduce((s, i) => s + Number(i.taxable_value), 0);
      const totalGSTCollected = gstInv.reduce(
        (s, i) => s + Number(i.cgst_amount) + Number(i.sgst_amount) + Number(i.igst_amount),
        0
      );
      const totalExpenses = exp.reduce((s, e) => s + Number(e.total_amount), 0);
      const itcAvailable = exp
        .filter((e) => e.is_itc_eligible)
        .reduce((s, e) => s + Number(e.gst_amount), 0);

      // Non-GST invoices contribute their full total_amount to revenue
      const nonGstTotal = allInv
        .filter(i => i.invoice_type === 'non_gst')
        .reduce((s, i) => s + Number(i.total_amount), 0);
      const totalRevenue = totalSales + nonGstTotal;

      // Pending across all invoice types
      const pendingInvoices = allInv.filter((i) => i.payment_status !== 'paid');

      setStats({
        totalSales,
        totalGSTCollected,
        totalExpenses,
        itcAvailable,
        netGSTPayable: totalGSTCollected - itcAvailable,
        pendingInvoicesCount: pendingInvoices.length,
        pendingInvoicesValue: pendingInvoices.reduce((s, i) => s + Number(i.total_amount), 0),
        totalRevenue,
        pendingProformasCount: (pendingProformas || []).length,
      });

      // Recent invoices (all types)
      const { data: recent } = await supabase
        .from('invoices')
        .select('*, client:clients(name)')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentInvoices(recent || []);

      // Monthly data — GST-only sales for chart consistency
      const monthly: MonthlyData[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(year, month - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const { start: mStart, end: mEnd } = getMonthRange(y, m);

        const { data: mInv } = await supabase
          .from('invoices')
          .select('taxable_value')
          .gte('invoice_date', mStart)
          .lte('invoice_date', mEnd)
          .or('invoice_type.eq.gst,invoice_type.is.null');

        const { data: mExp } = await supabase
          .from('expenses')
          .select('total_amount')
          .gte('date', mStart)
          .lte('date', mEnd);

        monthly.push({
          month: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
          sales: (mInv || []).reduce((s, inv) => s + Number(inv.taxable_value), 0),
          expenses: (mExp || []).reduce((s, exp) => s + Number(exp.total_amount), 0),
        });
      }
      setMonthlyData(monthly);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return { stats, monthlyData, recentInvoices, loading, refetch: fetchDashboardData };
}
