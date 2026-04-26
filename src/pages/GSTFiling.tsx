import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { formatCurrency, formatDate, getMonthRange, getMonthLabel } from '../utils/formatters';

export function GSTFiling() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tab, setTab] = useState<'gstr1' | 'gstr3b'>('gstr1');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(() => {
    return localStorage.getItem('gst_filing_banner_dismissed') !== 'true';
  });

  useEffect(() => {
    fetchData();
  }, [year, month]);

  async function fetchData() {
    setLoading(true);
    const { start, end } = getMonthRange(year, month);
    const [{ data: invoices }, { data: expenses }] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, client:clients(name,gstin,state)')
        .gte('invoice_date', start)
        .lte('invoice_date', end)
        .or('invoice_type.eq.gst,invoice_type.is.null'),
      supabase
        .from('expenses')
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .eq('is_itc_eligible', true),
    ]);
    setData({ invoices: invoices || [], expenses: expenses || [] });
    setLoading(false);
  }

  function dismissBanner() {
    localStorage.setItem('gst_filing_banner_dismissed', 'true');
    setShowBanner(false);
  }

  function exportCSV(rows: string[][], filename: string) {
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportGSTR1() {
    if (!data) return;
    const b2b = data.invoices.filter((i: any) => i.client?.gstin);
    const rows = [
      [
        'GSTIN of Recipient',
        'Invoice Number',
        'Invoice Date',
        'Invoice Value',
        'Place of Supply',
        'Taxable Value',
        'CGST',
        'SGST',
        'IGST',
        'Tax Type',
      ],
      ...b2b.map((i: any) => [
        i.client.gstin,
        i.invoice_number,
        formatDate(i.invoice_date),
        String(i.total_amount),
        `${i.place_of_supply} (${i.place_of_supply_code})`,
        String(i.taxable_value),
        String(i.cgst_amount),
        String(i.sgst_amount),
        String(i.igst_amount),
        i.is_igst ? 'IGST' : 'CGST+SGST',
      ]),
    ];
    exportCSV(rows, `GSTR1_B2B_${getMonthLabel(year, month).replace(' ', '_')}.csv`);
  }

  function exportGSTR3B() {
    if (!data) return;
    const invs = data.invoices;
    const exps = data.expenses;
    const taxable = invs.reduce((s: number, i: any) => s + Number(i.taxable_value), 0);
    const cgst = invs.reduce((s: number, i: any) => s + Number(i.cgst_amount), 0);
    const sgst = invs.reduce((s: number, i: any) => s + Number(i.sgst_amount), 0);
    const igst = invs.reduce((s: number, i: any) => s + Number(i.igst_amount), 0);
    const itc = exps.reduce((s: number, e: any) => s + Number(e.gst_amount), 0);
    const rows = [
      ['Section', 'Description', 'Amount (₹)'],
      ['3.1', 'Outward taxable supplies — Taxable Value', taxable.toFixed(2)],
      ['3.1', 'Outward taxable supplies — IGST', igst.toFixed(2)],
      ['3.1', 'Outward taxable supplies — CGST', cgst.toFixed(2)],
      ['3.1', 'Outward taxable supplies — SGST', sgst.toFixed(2)],
      ['3.1', 'Total Output Tax', (igst + cgst + sgst).toFixed(2)],
      ['4', 'ITC Available (Input Services & Goods)', itc.toFixed(2)],
      ['Net', 'Net GST Payable (Output − ITC)', (cgst + sgst + igst - itc).toFixed(2)],
    ];
    exportCSV(rows, `GSTR3B_${getMonthLabel(year, month).replace(' ', '_')}.csv`);
  }

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: new Date(2024, i, 1).toLocaleDateString('en-IN', { month: 'long' }),
  }));
  const years = [today.getFullYear() - 1, today.getFullYear()].map((y) => ({
    value: String(y),
    label: String(y),
  }));

  return (
    <div>
      <TopBar title="GST Filing Helper" />
      <div className="px-4 md:px-6 py-6 space-y-6">
        {/* Info Banner */}
        {showBanner && (
          <div className="flex items-start justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
            <span>Use this section to prepare your GSTR-1 and GSTR-3B data. Export as CSV and share with your CA.</span>
            <button
              onClick={dismissBanner}
              className="ml-4 text-blue-400 hover:text-blue-600 flex-shrink-0 mt-0.5"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {years.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-500">{getMonthLabel(year, month)}</span>
        </div>
        {(() => {
          const nd = new Date(year, month + 1, 1);
          const ms = nd.toLocaleDateString('en-IN', { month: 'short' });
          const ny = nd.getFullYear();
          return (
            <p className="text-xs text-gray-400 italic -mt-4">
              GSTR-1 due: 11 {ms} {ny} · GSTR-3B due: 20 {ms} {ny}
            </p>
          );
        })()}

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['gstr1', 'gstr3b'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'gstr1' ? 'GSTR-1' : 'GSTR-3B'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />
        ) : !data ? null : tab === 'gstr1' ? (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={exportGSTR1}>
                <Download size={15} /> Export B2B CSV
              </Button>
            </div>

            {/* B2B Invoices */}
            <Card padding={false}>
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <CardTitle>B2B Invoices (with GSTIN)</CardTitle>
                <span className="text-sm text-gray-500">
                  {data.invoices.filter((i: any) => i.client?.gstin).length} invoices
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      {[
                        'Client GSTIN',
                        'Invoice No',
                        'Date',
                        'Taxable Value',
                        'CGST',
                        'SGST',
                        'IGST',
                        'Total',
                      ].map((h) => (
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
                    {data.invoices.filter((i: any) => i.client?.gstin).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                          No B2B invoices this month
                        </td>
                      </tr>
                    ) : (
                      data.invoices
                        .filter((i: any) => i.client?.gstin)
                        .map((inv: any) => (
                          <tr key={inv.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs text-gray-700">
                              {inv.client.gstin}
                            </td>
                            <td className="px-4 py-3 font-semibold text-blue-700">
                              {inv.invoice_number}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {formatDate(inv.invoice_date)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatCurrency(inv.taxable_value)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatCurrency(inv.cgst_amount)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatCurrency(inv.sgst_amount)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatCurrency(inv.igst_amount)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              {formatCurrency(inv.total_amount)}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* B2C Summary */}
            <Card>
              <CardHeader>
                <CardTitle>B2C Summary (without GSTIN)</CardTitle>
              </CardHeader>
              {data.invoices.filter((i: any) => !i.client?.gstin).length === 0 ? (
                <p className="text-sm text-gray-400">No B2C invoices this month</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Total B2C Invoices</span>
                    <span>{data.invoices.filter((i: any) => !i.client?.gstin).length}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Total Taxable Value</span>
                    <span>
                      {formatCurrency(
                        data.invoices
                          .filter((i: any) => !i.client?.gstin)
                          .reduce((s: number, i: any) => s + Number(i.taxable_value), 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-gray-200 pt-2">
                    <span>Total Invoice Value</span>
                    <span>
                      {formatCurrency(
                        data.invoices
                          .filter((i: any) => !i.client?.gstin)
                          .reduce((s: number, i: any) => s + Number(i.total_amount), 0)
                      )}
                    </span>
                  </div>
                </div>
              )}
            </Card>

            {/* Pre-Filing Checklist */}
            <Card>
              <CardHeader>
                <CardTitle>Pre-Filing Checklist</CardTitle>
              </CardHeader>
              <div className="space-y-2 text-sm">
                {[
                  {
                    ok: data.invoices.length > 0,
                    text: `All sales invoices recorded for the month (${data.invoices.length} found)`,
                  },
                  {
                    ok: data.expenses.length > 0,
                    text: `All eligible purchase invoices entered as expenses (${data.expenses.length} found)`,
                  },
                  {
                    ok: data.invoices.length > 0 && data.invoices.every((i: any) => i.client?.gstin),
                    text: 'GSTIN verified on all B2B invoices',
                  },
                  {
                    ok: data.invoices.length > 0,
                    text: 'Output tax calculated (auto)',
                    alwaysGreen: true,
                  },
                  {
                    ok: data.expenses.length > 0,
                    text: 'ITC calculated (auto)',
                    alwaysGreen: true,
                  },
                ].map(({ ok, text, alwaysGreen }, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className={ok ? 'text-green-600' : alwaysGreen ? 'text-gray-400' : 'text-amber-500'}>
                      {ok ? '✓' : alwaysGreen ? '–' : '⚠'}
                    </span>
                    <span className="text-gray-600">{text}</span>
                  </div>
                ))}
                <div className="flex items-start gap-2 border-t border-gray-100 pt-2 mt-2">
                  <span className="text-blue-500">→</span>
                  <span className="text-gray-500 text-xs">Share this data with your CA or file on gstn.gov.in</span>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          // GSTR-3B tab
          (() => {
            const invs = data.invoices;
            const taxable = invs.reduce((s: number, i: any) => s + Number(i.taxable_value), 0);
            const cgst = invs.reduce((s: number, i: any) => s + Number(i.cgst_amount), 0);
            const sgst = invs.reduce((s: number, i: any) => s + Number(i.sgst_amount), 0);
            const igst = invs.reduce((s: number, i: any) => s + Number(i.igst_amount), 0);
            const itc = data.expenses.reduce(
              (s: number, e: any) => s + Number(e.gst_amount),
              0
            );
            const net = cgst + sgst + igst - itc;

            return (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={exportGSTR3B}>
                    <Download size={15} /> Export GSTR-3B CSV
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Table 3.1 — Outward Supplies</CardTitle>
                    </CardHeader>
                    <div className="space-y-0">
                      {[
                        { label: 'Total Taxable Value', value: taxable },
                        { label: 'CGST', value: cgst },
                        { label: 'SGST', value: sgst },
                        { label: 'IGST', value: igst },
                        { label: 'Total Output Tax', value: cgst + sgst + igst },
                      ].map(({ label, value }, i) => (
                        <div
                          key={label}
                          className={`flex justify-between py-2.5 border-b border-gray-100 text-sm ${
                            i === 4 ? 'font-semibold border-0 pt-3' : ''
                          }`}
                        >
                          <span className="text-gray-600">{label}</span>
                          <span className="text-gray-900">{formatCurrency(value)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Table 4 — ITC Available</CardTitle>
                    </CardHeader>
                    <div className="py-2.5 border-b border-gray-100 text-sm flex justify-between mb-4">
                      <span className="text-gray-600">Total ITC (Input Credit)</span>
                      <span className="font-semibold text-green-700">{formatCurrency(itc)}</span>
                    </div>
                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-blue-900">
                          Net GST Payable
                        </span>
                        <span
                          className={`text-2xl font-bold ${
                            net > 0 ? 'text-red-700' : 'text-green-700'
                          }`}
                        >
                          {formatCurrency(Math.abs(net))}
                        </span>
                      </div>
                      <p className="text-xs text-blue-700">
                        {formatCurrency(cgst + sgst + igst)} (output) − {formatCurrency(itc)}{' '}
                        (ITC)
                      </p>
                      {net <= 0 && (
                        <p className="text-xs text-green-700 mt-1 font-medium">
                          Credit balance — carry forward to next month
                        </p>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Pre-Filing Checklist */}
                <Card>
                  <CardHeader>
                    <CardTitle>Pre-Filing Checklist</CardTitle>
                  </CardHeader>
                  <div className="space-y-2 text-sm">
                    {[
                      {
                        ok: invs.length > 0,
                        text: `All sales invoices recorded for the month (${invs.length} found)`,
                      },
                      {
                        ok: data.expenses.length > 0,
                        text: `All eligible purchase invoices entered as expenses (${data.expenses.length} found)`,
                      },
                      {
                        ok: invs.length > 0 && invs.every((i: any) => i.client?.gstin),
                        text: 'GSTIN verified on all B2B invoices',
                      },
                      {
                        ok: invs.length > 0,
                        text: 'Output tax calculated (auto)',
                        alwaysGreen: true,
                      },
                      {
                        ok: data.expenses.length > 0,
                        text: 'ITC calculated (auto)',
                        alwaysGreen: true,
                      },
                    ].map(({ ok, text, alwaysGreen }, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className={ok ? 'text-green-600' : alwaysGreen ? 'text-gray-400' : 'text-amber-500'}>
                          {ok ? '✓' : alwaysGreen ? '–' : '⚠'}
                        </span>
                        <span className="text-gray-600">{text}</span>
                      </div>
                    ))}
                    <div className="flex items-start gap-2 border-t border-gray-100 pt-2 mt-2">
                      <span className="text-blue-500">→</span>
                      <span className="text-gray-500 text-xs">Share this data with your CA or file on gstn.gov.in</span>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
