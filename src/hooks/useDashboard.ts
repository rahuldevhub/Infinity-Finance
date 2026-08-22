import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { DashboardStats, MonthlyData } from '../types';
import { getMonthRange } from '../utils/formatters';

export interface DashboardDayPoint {
  day: number;
  label: string;
  collected: number;
}

export interface DashboardTrends {
  /** Cumulative Payment Receipt collections for the selected month, one point per day. */
  collectedDaily: DashboardDayPoint[];
  sales: number[];
  gst: number[];
  expenses: number[];
  /** % change of the selected month's total collected vs the immediately preceding month. */
  collectedDelta: number | null;
  salesDelta: number | null;
  gstDelta: number | null;
  expensesDelta: number | null;
}

const EMPTY_TRENDS: DashboardTrends = {
  collectedDaily: [], sales: [], gst: [], expenses: [],
  collectedDelta: null, salesDelta: null, gstDelta: null, expensesDelta: null,
};

// Percentage change of the last point vs the previous one; null when not computable.
function pctDelta(series: number[]): number | null {
  if (series.length < 2) return null;
  const prev = series[series.length - 2];
  const cur = series[series.length - 1];
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

// Day-of-month from a 'YYYY-MM-DD' string without going through Date/UTC parsing
// (avoids the off-by-one timezone shift documented in utils/formatters.ts).
function dayOfMonth(dateStr: string): number {
  return Number(dateStr.split('-')[2]);
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

      // All invoices — for pending counts/value only (billed, not yet settled)
      const { data: allInvoices } = await supabase
        .from('invoices')
        .select('total_amount, payment_status')
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

      // Actual money collected this month — Payment Receipts, cash-basis
      const { data: receipts } = await supabase
        .from('payment_receipts')
        .select('date, amount_received')
        .gte('date', start)
        .lte('date', end);

      // Previous month's collections — for the month-over-month % delta
      const prevMonthDate = new Date(year, month - 1, 1);
      const { start: prevMonthStart, end: prevMonthEnd } = getMonthRange(prevMonthDate.getFullYear(), prevMonthDate.getMonth());
      const { data: prevMonthReceipts } = await supabase
        .from('payment_receipts')
        .select('amount_received')
        .gte('date', prevMonthStart)
        .lte('date', prevMonthEnd);

      const gstInv = gstInvoices || [];
      const allInv = allInvoices || [];
      const exp = expenses || [];
      const rcpts = receipts || [];

      const totalSales = gstInv.reduce((s, i) => s + Number(i.taxable_value), 0);
      const totalGSTCollected = gstInv.reduce(
        (s, i) => s + Number(i.cgst_amount) + Number(i.sgst_amount) + Number(i.igst_amount),
        0
      );
      const totalExpenses = exp.reduce((s, e) => s + Number(e.total_amount), 0);
      const itcAvailable = exp
        .filter((e) => e.is_itc_eligible)
        .reduce((s, e) => s + Number(e.gst_amount), 0);

      const totalCollected = rcpts.reduce((s, r) => s + Number(r.amount_received), 0);

      const prevMonthCollected = (prevMonthReceipts || []).reduce((s, r) => s + Number(r.amount_received), 0);
      const collectedDelta = prevMonthCollected > 0 ? ((totalCollected - prevMonthCollected) / prevMonthCollected) * 100 : null;

      // Cumulative collections per day for the selected month (chart trend). Cap at "today"
      // when viewing the current real-world month, since later days have no data yet.
      const now = new Date();
      const daysInSelectedMonth = new Date(year, month + 1, 0).getDate();
      const isViewingCurrentMonth = year === now.getFullYear() && month === now.getMonth();
      const lastDay = isViewingCurrentMonth ? Math.min(daysInSelectedMonth, now.getDate()) : daysInSelectedMonth;

      const perDay: Record<number, number> = {};
      rcpts.forEach((r) => {
        const day = dayOfMonth(r.date);
        perDay[day] = (perDay[day] || 0) + Number(r.amount_received);
      });

      let runningCollected = 0;
      const collectedDaily = Array.from({ length: lastDay }, (_, idx) => {
        const day = idx + 1;
        runningCollected += perDay[day] ?? 0;
        return { day, label: String(day), collected: runningCollected };
      });

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
        totalCollected,
        pendingProformasCount: (pendingProformas || []).length,
      });

      // Recent invoices (all types)
      const { data: recent } = await supabase
        .from('invoices')
        .select('*, client:clients(name)')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentInvoices(recent || []);

      // Monthly data + trend series (last 6 months) for the "Sales vs Expenses" chart —
      // unrelated to the Total Collected card, which is day-by-day within the current month.
      const TREND_MONTHS = 6;
      const monthly: MonthlyData[] = [];
      const salesSeries: number[] = [];
      const gstSeries: number[] = [];
      const expensesSeries: number[] = [];

      for (let i = TREND_MONTHS - 1; i >= 0; i--) {
        const d = new Date(year, month - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const { start: mStart, end: mEnd } = getMonthRange(y, m);

        const { data: mInv } = await supabase
          .from('invoices')
          .select('taxable_value, cgst_amount, sgst_amount, igst_amount, invoice_type')
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
        const mExpenses = (mExp || []).reduce((s, e) => s + Number(e.total_amount), 0);

        salesSeries.push(mSales);
        gstSeries.push(mGst);
        expensesSeries.push(mExpenses);

        monthly.push({
          month: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
          sales: mSales,
          expenses: mExpenses,
        });
      }
      setMonthlyData(monthly);

      setTrends({
        collectedDaily,
        sales: salesSeries,
        gst: gstSeries,
        expenses: expensesSeries,
        collectedDelta,
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
