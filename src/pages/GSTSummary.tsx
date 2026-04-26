import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TopBar } from '../components/layout/TopBar';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { formatCurrency, getMonthLabel, getMonthRange } from '../utils/formatters';

export function GSTSummary() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(() => {
    return localStorage.getItem('gst_summary_banner_dismissed') !== 'true';
  });

  useEffect(() => {
    fetchSummary();
  }, [year, month]);

  async function fetchSummary() {
    setLoading(true);
    const { start, end } = getMonthRange(year, month);

    const [{ data: invoices }, { data: expenses }] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, client:clients(name,gstin)')
        .gte('invoice_date', start)
        .lte('invoice_date', end)
        .or('invoice_type.eq.gst,invoice_type.is.null'),
      supabase.from('expenses').select('*').gte('date', start).lte('date', end),
    ]);

    const inv = invoices || [];
    const exp = expenses || [];

    const taxableValue = inv.reduce((s: number, i: any) => s + Number(i.taxable_value), 0);
    const cgstCollected = inv.reduce((s: number, i: any) => s + Number(i.cgst_amount), 0);
    const sgstCollected = inv.reduce((s: number, i: any) => s + Number(i.sgst_amount), 0);
    const igstCollected = inv.reduce((s: number, i: any) => s + Number(i.igst_amount), 0);
    const outputTax = cgstCollected + sgstCollected + igstCollected;

    const itcEligible = exp.filter((e: any) => e.is_itc_eligible);
    const totalITC = itcEligible.reduce((s: number, e: any) => s + Number(e.gst_amount), 0);
    const totalExpenses = exp.reduce((s: number, e: any) => s + Number(e.total_amount), 0);

    const b2b = inv.filter((i: any) => i.client?.gstin);
    const b2c = inv.filter((i: any) => !i.client?.gstin);

    setData({
      taxableValue,
      cgstCollected,
      sgstCollected,
      igstCollected,
      outputTax,
      totalITC,
      totalExpenses,
      b2b,
      b2c,
      netPayable: outputTax - totalITC,
      invoiceCount: inv.length,
      itcExpenseCount: itcEligible.length,
    });
    setLoading(false);
  }

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())) return;
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function dismissBanner() {
    localStorage.setItem('gst_summary_banner_dismissed', 'true');
    setShowBanner(false);
  }

  const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <div
      className={`flex justify-between py-2.5 border-b border-gray-100 last:border-0 ${
        bold ? 'font-bold text-base' : 'text-sm'
      }`}
    >
      <span className="text-gray-600">{label}</span>
      <span className={bold ? 'text-blue-700' : 'text-gray-900'}>{value}</span>
    </div>
  );

  const nextMonthDate = new Date(year, month + 1, 1);
  const nextMonShort = nextMonthDate.toLocaleDateString('en-IN', { month: 'short' });
  const nextMonYear = nextMonthDate.getFullYear();
  const dueDateStr = `GSTR-1 due: 11 ${nextMonShort} ${nextMonYear} · GSTR-3B due: 20 ${nextMonShort} ${nextMonYear}`;

  return (
    <div>
      <TopBar title="GST Summary" />
      <div className="px-4 md:px-6 py-6 space-y-6">
        {/* Info Banner */}
        {showBanner && (
          <div className="flex items-start justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
            <span>This section is auto-calculated from your GST Invoices and Expenses. No manual entry needed.</span>
            <button
              onClick={dismissBanner}
              className="ml-4 text-blue-400 hover:text-blue-600 flex-shrink-0 mt-0.5"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Month Selector */}
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[140px] text-center">
            {getMonthLabel(year, month)}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-400 italic -mt-4">{dueDateStr}</p>

        {/* Filing Readiness Card */}
        {!loading && data && (
          <Card>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Filing Readiness — {getMonthLabel(year, month)}
            </h2>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex items-center gap-2">
                <span className={data.invoiceCount > 0 ? 'text-green-600' : 'text-amber-500'}>
                  {data.invoiceCount > 0 ? '✓' : '⚠'}
                </span>
                <span className="text-gray-600">GST Invoices: {data.invoiceCount} invoices recorded</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={data.itcExpenseCount > 0 ? 'text-green-600' : 'text-amber-500'}>
                  {data.itcExpenseCount > 0 ? '✓' : '⚠'}
                </span>
                <span className="text-gray-600">Expenses (ITC): {data.itcExpenseCount} eligible expenses</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">→</span>
                <span className="text-gray-600">Output Tax: {formatCurrency(data.outputTax)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">→</span>
                <span className="text-gray-600">ITC Claimed: {formatCurrency(data.totalITC)}</span>
              </div>
              <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
                <span className="font-semibold text-gray-700">Net Payable:</span>
                <span className={`font-bold ${data.netPayable > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {formatCurrency(Math.abs(data.netPayable))}
                  {data.netPayable <= 0 && <span className="text-xs font-normal ml-1">(Credit)</span>}
                </span>
              </div>
            </div>
            {(data.invoiceCount > 0 || data.itcExpenseCount > 0) ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                DATA READY — Review before filing
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                NO DATA — Add invoices and expenses first
              </span>
            )}
          </Card>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          data && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Output Tax */}
              <Card>
                <CardHeader>
                  <CardTitle>Output Tax (from Sales)</CardTitle>
                </CardHeader>
                <Row label="Total Taxable Value" value={formatCurrency(data.taxableValue)} />
                <Row label="CGST Collected" value={formatCurrency(data.cgstCollected)} />
                <Row label="SGST Collected" value={formatCurrency(data.sgstCollected)} />
                <Row label="IGST Collected" value={formatCurrency(data.igstCollected)} />
                <Row label="Total Output Tax" value={formatCurrency(data.outputTax)} bold />
                <p className="text-xs text-gray-400 mt-1">Based on {data.invoiceCount} GST invoice{data.invoiceCount !== 1 ? 's' : ''} for {getMonthLabel(year, month)}</p>
              </Card>

              {/* Input Tax */}
              <Card>
                <CardHeader>
                  <CardTitle>Input Tax Credit (ITC)</CardTitle>
                </CardHeader>
                <Row label="Total Expense Amount" value={formatCurrency(data.totalExpenses)} />
                <Row label="Total ITC Available" value={formatCurrency(data.totalITC)} bold />

                <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-blue-900">Net GST Payable</span>
                    <span
                      className={`text-xl font-bold ${
                        data.netPayable > 0 ? 'text-red-700' : 'text-green-700'
                      }`}
                    >
                      {formatCurrency(Math.abs(data.netPayable))}
                      {data.netPayable <= 0 && (
                        <span className="text-xs font-normal ml-1">(Credit)</span>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Output Tax − ITC ={' '}
                    {formatCurrency(data.outputTax)} − {formatCurrency(data.totalITC)}
                  </p>
                </div>
              </Card>

              {/* B2B vs B2C */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>B2B vs B2C Breakdown</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        {['Type', 'Count', 'Taxable Value', 'Tax', 'Total'].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[
                        { label: 'B2B (with GSTIN)', rows: data.b2b },
                        { label: 'B2C (without GSTIN)', rows: data.b2c },
                      ].map(({ label, rows }) => {
                        const taxable = rows.reduce(
                          (s: number, r: any) => s + Number(r.taxable_value),
                          0
                        );
                        const tax = rows.reduce(
                          (s: number, r: any) =>
                            s + Number(r.cgst_amount) + Number(r.sgst_amount) + Number(r.igst_amount),
                          0
                        );
                        const total = rows.reduce(
                          (s: number, r: any) => s + Number(r.total_amount),
                          0
                        );
                        return (
                          <tr key={label} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{label}</td>
                            <td className="px-4 py-3 text-gray-600">{rows.length}</td>
                            <td className="px-4 py-3 text-gray-600">{formatCurrency(taxable)}</td>
                            <td className="px-4 py-3 text-gray-600">{formatCurrency(tax)}</td>
                            <td className="px-4 py-3 font-semibold text-gray-900">
                              {formatCurrency(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )
        )}
      </div>
    </div>
  );
}
