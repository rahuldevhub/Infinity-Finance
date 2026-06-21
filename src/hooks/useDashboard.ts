import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { DashboardStats, MonthlyData } from '../types';
import { getMonthRange } from '../utils/formatters';

export interface DashboardTrends {
  revenue: number[];
  sales: number[];
  gst: number[];
  expenses: number[];
  revenueDelta: number | null;
  salesDelta: number | null;
  gstDelta: number | null;
  expensesDelta: number | null;
}

const EMPTY_TRENDS: DashboardTrends = {
  revenue: [], sales: [], gst: [], expenses: [],
  revenueDelta: null, salesDelta: null, gstDelta: null, expensesDelta: null,
};

// Percentage change of the last point vs the previous one; null when not computable.
function pctDelta(series: number[]): number | null {
  if (series.length < 2) return null;
  const prev = series[series.length - 2];
  const cur = series[series.length - 1];
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

export function useDashboard(year: number, month: number) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [trends, setTrends] = useState<DashboardTrends>(EMPTY_TRENDS);
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

      // Monthly data + trend series (last 6 months, oldest → newest)
      const monthly: MonthlyData[] = [];
      const salesSeries: number[] = [];
      const gstSeries: number[] = [];
      const revenueSeries: number[] = [];
      const expensesSeries: number[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(year, month - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const { start: mStart, end: mEnd } = getMonthRange(y, m);

        const { data: mInv } = await supabase
          .from('invoices')
          .select('taxable_value, cgst_amount, sgst_amount, igst_amount, total_amount, invoice_type')
          .gte('invoice_date', mStart)
          .lte('invoice_date', mEnd);

        const { data: mExp } = await supabase
          .from('expenses')
          .select('total_amount')
          .gte('date', mStart)
          .lte('date', mEnd);

        const rows = mInv || [];
        const gstRows = rows.filter((r) => r.invoice_type !== 'non_gst');
        const mSales = gstRows.reduce((s, r) => s + Number(r.taxable_value), 0);
        const mGst = gstRows.reduce((s, r) => s + Number(r.cgst_amount) + Number(r.sgst_amount) + Number(r.igst_amount), 0);
        const mNonGst = rows.filter((r) => r.invoice_type === 'non_gst').reduce((s, r) => s + Number(r.total_amount), 0);
        const mExpenses = (mExp || []).reduce((s, e) => s + Number(e.total_amount), 0);

        salesSeries.push(mSales);
        gstSeries.push(mGst);
        revenueSeries.push(mSales + mNonGst);
        expensesSeries.push(mExpenses);

        monthly.push({
          month: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
          sales: mSales,
          expenses: mExpenses,
        });
      }
      setMonthlyData(monthly);
      setTrends({
        revenue: revenueSeries,
        sales: salesSeries,
        gst: gstSeries,
        expenses: expensesSeries,
        revenueDelta: pctDelta(revenueSeries),
        salesDelta: pctDelta(salesSeries),
        gstDelta: pctDelta(gstSeries),
        expensesDelta: pctDelta(expensesSeries),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return { stats, monthlyData, trends, recentInvoices, loading, refetch: fetchDashboardData };
}
