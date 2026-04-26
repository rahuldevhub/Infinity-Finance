import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Edit, Trash2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { useReceipts } from '../hooks/useReceipts';
import type { PaymentReceipt } from '../hooks/useReceipts';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { ReceiptPDF } from '../components/receipt/ReceiptPDF';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, formatDate, getMonthRange } from '../utils/formatters';

export function PaymentReceipts() {
  const navigate = useNavigate();
  const today = new Date();

  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [filterMonth, setFilterMonth] = useState(today.getMonth());
  const [filterBrand, setFilterBrand] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { start, end } = getMonthRange(filterYear, filterMonth);
  const { receipts, loading, deleteReceipt } = useReceipts({
    start,
    end,
    sub_brand: filterBrand || undefined,
  });
  const { settings } = useBusinessSettings();

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

  async function handleDownloadPDF(receipt: PaymentReceipt) {
    if (!settings) return;
    const blob = await pdf(<ReceiptPDF receipt={receipt} businessSettings={settings} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt-${receipt.receipt_number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await deleteReceipt(confirmDelete);
    setConfirmDelete(null);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Payment Receipts" />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Header row */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Payment Receipts</h1>
          <Button onClick={() => navigate('/receipts/new')}>
            <Plus size={16} className="mr-2" /> New Receipt
          </Button>
        </div>

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
                            <button
                              onClick={() => handleDownloadPDF(receipt)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
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

    </div>
  );
}
