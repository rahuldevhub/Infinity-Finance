import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Download, Edit, Trash2, Mail, Loader2,
  ChevronLeft, ChevronRight, Search, SlidersHorizontal,
} from 'lucide-react';
import { usePDFDownload } from '../hooks/usePDFDownload';
import { useReceipts } from '../hooks/useReceipts';
import type { PaymentReceipt } from '../hooks/useReceipts';
import ReceiptPDF from '../components/receipt/ReceiptPDF';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { BottomSheet } from '../components/ui/BottomSheet';
import { formatCurrency, formatDate, getMonthRange, getMonthLabel } from '../utils/formatters';
import { sendReceiptEmail } from '../utils/sendReceiptEmail';

// ─── Compact label/value row for the mobile receipt-detail sheet ──────────────
function DetailRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className={`text-sm font-semibold text-gray-700 text-right truncate ${valueClassName ?? ''}`}>{value}</span>
    </div>
  );
}

export function PaymentReceipts() {
  const navigate = useNavigate();
  const { downloadPDF, loading: pdfLoading } = usePDFDownload();
  const today = new Date();

  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [filterMonth, setFilterMonth] = useState(today.getMonth());
  const [filterBrand, setFilterBrand] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Mobile-only UI state ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [actionReceipt, setActionReceipt] = useState<PaymentReceipt | null>(null);

  const { start, end } = getMonthRange(filterYear, filterMonth);
  const { receipts, loading, deleteReceipt, refetch } = useReceipts({
    start,
    end,
    sub_brand: filterBrand || undefined,
  });

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: new Date(2024, i, 1).toLocaleDateString('en-IN', { month: 'long' }),
  }));
  const years = [today.getFullYear() - 1, today.getFullYear()].map(y => ({
    value: String(y),
    label: String(y),
  }));

  const totalAmount = receipts.reduce((s, r) => s + r.amount_received, 0);

  const modeCount = receipts.reduce<Record<string, number>>((acc, r) => {
    acc[r.payment_mode] = (acc[r.payment_mode] || 0) + 1;
    return acc;
  }, {});
  const topMode = Object.entries(modeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  // ── Mobile period toolbar — step through months within the supported range ─
  const earliestYear = today.getFullYear() - 1;
  const isCurrentMonth = filterYear === today.getFullYear() && filterMonth === today.getMonth();

  function prevMonth() {
    if (filterMonth === 0) {
      if (filterYear <= earliestYear) return;
      setFilterYear((y) => y - 1);
      setFilterMonth(11);
    } else {
      setFilterMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (isCurrentMonth) return;
    if (filterMonth === 11) {
      setFilterYear((y) => y + 1);
      setFilterMonth(0);
    } else {
      setFilterMonth((m) => m + 1);
    }
  }

  function resetMobileFilters() {
    setFilterBrand('');
    setFilterMonth(today.getMonth());
    setFilterYear(today.getFullYear());
  }

  const mobileFilterCount = filterBrand !== '' ? 1 : 0;

  // ── Mobile search — client-side filter over the already-fetched receipts ──
  const mobileReceipts = searchQuery.trim()
    ? receipts.filter((r) => {
        const q = searchQuery.trim().toLowerCase();
        const clientName = r.client?.name || r.client_name_override || '';
        return (
          r.receipt_number.toLowerCase().includes(q) ||
          clientName.toLowerCase().includes(q) ||
          (r.towards ?? '').toLowerCase().includes(q)
        );
      })
    : receipts;

  async function handleDownloadPDF(receipt: PaymentReceipt) {
    await downloadPDF(
      <ReceiptPDF receipt={receipt} client={receipt.client as import('../types').Client ?? null} />,
      `Receipt-${receipt.receipt_number}.pdf`
    );
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await deleteReceipt(confirmDelete);
    setConfirmDelete(null);
  }

  async function handleSendEmail(receipt: PaymentReceipt) {
    if (receipt.email_sent) return;

    let toEmail = receipt.client_email || '';

    if (!toEmail) {
      const inputEmail = window.prompt(
        `Enter email address for ${receipt.client?.name || receipt.client_name_override || 'client'}:`
      );
      if (!inputEmail?.trim()) return;
      toEmail = inputEmail.trim();
    }

    const confirmed = window.confirm(
      `Send receipt ${receipt.receipt_number} to ${toEmail}?`
    );
    if (!confirmed) return;

    setSendingEmailId(receipt.id);
    setEmailMessage(null);

    const clientName = receipt.client?.name || receipt.client_name_override || 'Client';
    const result = await sendReceiptEmail(
      { ...receipt, client_email: toEmail },
      toEmail,
      clientName
    );

    setSendingEmailId(null);

    if (result.success) {
      setEmailMessage({ type: 'success', text: `Receipt sent to ${toEmail}` });
      await refetch();
    } else {
      setEmailMessage({ type: 'error', text: `Failed to send: ${result.error}` });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar
        title="Payment Receipts"
        actions={
          <button
            onClick={() => navigate('/receipts/new')}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={16} /> <span className="hidden sm:inline">New Receipt</span>
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Email message banner */}
        {emailMessage && (
          <div className={`px-4 py-3 rounded-lg text-sm flex items-center justify-between ${
            emailMessage.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <span>{emailMessage.text}</span>
            <button onClick={() => setEmailMessage(null)} className="ml-4 text-current opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* ================================================================
            MOBILE — purpose-built Payment Receipts experience (< md)
        ================================================================= */}
        <div className="md:hidden space-y-4">

          {/* Period toolbar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-1.5 py-1 shadow-sm">
              <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 active:bg-gray-100 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <span className="flex-1 text-sm font-semibold text-gray-800 text-center select-none truncate">
                {getMonthLabel(filterYear, filterMonth)}
              </span>
              <button
                onClick={nextMonth}
                disabled={isCurrentMonth}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 active:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              onClick={() => setShowMobileFilters(true)}
              className="shrink-0 flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-600 active:bg-gray-50 transition-colors"
            >
              <SlidersHorizontal size={14} /> Filters{mobileFilterCount > 0 ? ` • ${mobileFilterCount}` : ''}
            </button>
          </div>

          {/* Summary */}
          {loading ? (
            <div className="h-[104px] card-surface animate-pulse" />
          ) : (
            <div className="card-surface p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Total Collected</p>
              <p
                className="text-3xl font-extrabold text-green-700 mt-1"
                style={{ fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.02em' }}
              >
                {formatCurrency(totalAmount)}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {receipts.length} receipt{receipts.length !== 1 ? 's' : ''}
                <span className="text-gray-300 mx-1.5">·</span>
                Top mode: <span className="font-semibold text-gray-700 capitalize">{topMode}</span>
              </p>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search receipts..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
            />
          </div>

          {/* Receipt list */}
          <div>
            <div className="flex items-center justify-between mb-2 px-0.5">
              <h3 className="text-sm font-bold text-gray-900">Recent Receipts</h3>
              {!loading && <span className="text-xs text-gray-400">{mobileReceipts.length} receipt{mobileReceipts.length !== 1 ? 's' : ''}</span>}
            </div>
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="card-surface p-3.5 space-y-2 animate-pulse">
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                    <div className="h-3.5 bg-gray-100 rounded w-2/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                ))
              ) : mobileReceipts.length === 0 ? (
                receipts.length === 0 ? (
                  <div className="card-surface flex flex-col items-center gap-3 py-12 px-4 text-center">
                    <p className="text-gray-700 font-semibold">No receipts yet</p>
                    <p className="text-sm text-gray-400">No payment receipts found for this period.</p>
                    <button
                      onClick={() => navigate('/receipts/new')}
                      className="mt-1 inline-flex items-center gap-2 px-4 py-2.5 text-white rounded-lg text-sm font-medium active:opacity-90 transition-opacity"
                      style={{ background: 'var(--accent)' }}
                    >
                      <Plus size={14} /> Create First Receipt
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 text-sm py-10">No receipts match your search.</p>
                )
              ) : (
                mobileReceipts.map((r) => {
                  const clientName = r.client?.name || r.client_name_override || '—';
                  return (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActionReceipt(r)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActionReceipt(r); } }}
                      className="card-surface flex items-center gap-3 p-3.5 active:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-bold text-blue-700">{r.receipt_number}</p>
                        <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">{clientName}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{formatDate(r.date)} · {r.sub_brand}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <p className="text-sm font-bold text-green-700 whitespace-nowrap">{formatCurrency(r.amount_received)}</p>
                        <ChevronRight size={16} className="text-gray-300" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ================================================================
            DESKTOP — existing Payment Receipts layout, unchanged
        ================================================================= */}
        <div className="hidden md:block space-y-6">

        {/* Filters */}
        <Card>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
              <select
                value={String(filterMonth)}
                onChange={e => setFilterMonth(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
              <select
                value={String(filterYear)}
                onChange={e => setFilterYear(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {years.map(y => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sub-brand</label>
              <select
                value={filterBrand}
                onChange={e => setFilterBrand(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Brands</option>
                <option value="Ritera Publishing">Ritera Publishing</option>
                <option value="Ratixinfo Tech">Ratixinfo Tech</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Receipts</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{receipts.length}</p>
          </Card>
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Amount Collected</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(totalAmount)}</p>
          </Card>
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Top Payment Mode</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{topMode}</p>
          </Card>
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">No payment receipts found for this period.</p>
              <Button onClick={() => navigate('/receipts/new')}>
                <Plus size={16} className="mr-2" /> Create First Receipt
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt No</th>
                    <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                    <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sub-brand</th>
                    <th className="text-right py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                    <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mode</th>
                    <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Towards</th>
                    <th className="text-right py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receipts.map(receipt => {
                    const clientName = receipt.client?.name || receipt.client_name_override || '—';
                    const isSending = sendingEmailId === receipt.id;
                    return (
                      <tr key={receipt.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-4 font-mono text-xs text-blue-700 font-medium">
                          {receipt.receipt_number}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          {formatDate(receipt.date)}
                        </td>
                        <td className="py-3 pr-4 text-gray-900 font-medium max-w-[160px] truncate">
                          {clientName}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            receipt.sub_brand === 'Ratixinfo Tech'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {receipt.sub_brand}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold text-gray-900">
                          {formatCurrency(receipt.amount_received)}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {receipt.payment_mode}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-500 text-xs max-w-[160px] truncate">
                          {receipt.towards || '—'}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1">
                            {/* Email send button */}
                            <button
                              onClick={() => handleSendEmail(receipt)}
                              disabled={receipt.email_sent || isSending}
                              title={
                                receipt.email_sent
                                  ? `Already sent to ${receipt.client_email}`
                                  : 'Send receipt by email'
                              }
                              className={`p-1.5 rounded hover:bg-blue-50 disabled:cursor-not-allowed transition-colors ${
                                receipt.email_sent
                                  ? 'text-green-400'
                                  : isSending
                                  ? 'text-blue-400'
                                  : 'text-gray-400 hover:text-blue-600'
                              }`}
                            >
                              {isSending
                                ? <Loader2 size={15} className="animate-spin" />
                                : <Mail size={15} />}
                            </button>
                            <button
                              onClick={() => handleDownloadPDF(receipt)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 disabled:opacity-50"
                              disabled={pdfLoading}
                              title="Download PDF"
                            >
                              <Download size={15} />
                            </button>
                            <button
                              onClick={() => navigate(`/receipts/${receipt.id}/edit`)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                              title="Edit"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(receipt.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={4} className="py-3 pr-4 text-xs font-semibold text-gray-500">
                      {receipts.length} receipt{receipts.length !== 1 ? 's' : ''}
                    </td>
                    <td className="py-3 pr-4 text-right font-bold text-gray-900">
                      {formatCurrency(totalAmount)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>

        </div>

      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Receipt">
          <p className="text-sm text-gray-600 mb-6">
            Are you sure you want to delete this receipt? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </div>
        </Modal>
      )}

      {/* Mobile filters bottom sheet */}
      <BottomSheet open={showMobileFilters} onClose={() => setShowMobileFilters(false)} title="Filters">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Month</label>
              <select
                value={String(filterMonth)}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Year</label>
              <select
                value={String(filterYear)}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {years.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Sub-brand</label>
            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All Brands</option>
              <option value="Ritera Publishing">Ritera Publishing</option>
              <option value="Ratixinfo Tech">Ratixinfo Tech</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={resetMobileFilters}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 active:bg-gray-50 transition-colors"
            >
              Reset
            </button>
            <Button onClick={() => setShowMobileFilters(false)} className="flex-1">
              Apply
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Receipt details / actions bottom sheet */}
      <BottomSheet open={!!actionReceipt} onClose={() => setActionReceipt(null)} title="Payment Receipt">
        {actionReceipt && (() => {
          const r = actionReceipt;
          const clientName = r.client?.name || r.client_name_override || '—';
          const isSending = sendingEmailId === r.id;
          return (
            <div className="space-y-4">
              <p className="font-mono text-sm font-bold text-blue-700">{r.receipt_number}</p>
              <div className="rounded-xl bg-gray-50 divide-y divide-gray-100">
                <DetailRow label="Client" value={clientName} />
                <DetailRow label="Date" value={formatDate(r.date)} />
                <DetailRow label="Amount" value={formatCurrency(r.amount_received)} valueClassName="text-green-700 font-bold" />
                <DetailRow label="Payment Mode" value={r.payment_mode} />
                <DetailRow label="Towards" value={r.towards || '—'} />
                <DetailRow label="Sub-brand" value={r.sub_brand} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleDownloadPDF(r)}
                  disabled={pdfLoading}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 active:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pdfLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download
                </button>
                <button
                  onClick={() => handleSendEmail(r)}
                  disabled={r.email_sent || isSending}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border transition-colors disabled:cursor-not-allowed ${
                    r.email_sent
                      ? 'border-green-200 text-green-600 disabled:opacity-70'
                      : 'border-gray-200 text-gray-700 active:bg-gray-50 disabled:opacity-50'
                  }`}
                >
                  {isSending ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} {r.email_sent ? 'Sent' : 'Email'}
                </button>
                <button
                  onClick={() => { setActionReceipt(null); navigate(`/receipts/${r.id}/edit`); }}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 active:bg-gray-50 transition-colors"
                >
                  <Edit size={15} /> Edit
                </button>
                <button
                  onClick={() => { setActionReceipt(null); setConfirmDelete(r.id); }}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-red-600 active:opacity-90 transition-opacity"
                >
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </div>
          );
        })()}
      </BottomSheet>

    </div>
  );
}
