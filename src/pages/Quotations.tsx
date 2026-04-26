import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Eye, Edit, Trash2, CheckCircle, FileText, FileCheck } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { useQuotations } from '../hooks/useQuotations';
import type { Quotation } from '../hooks/useQuotations';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { QuotationPDF } from '../components/quotation/QuotationPDF';
import { formatCurrency, formatDate, getMonthRange } from '../utils/formatters';

// Maps status to a Badge variant or a custom className
const STATUS_BADGE_VARIANT: Record<string, 'green' | 'blue' | 'gray' | 'red' | null> = {
  draft: 'gray',
  sent: 'blue',
  approved: 'green',
  rejected: 'red',
  converted: null, // handled with custom span
};

// Status transitions for draft/sent quotations
const STATUS_CYCLE: Record<string, Quotation['status']> = {
  draft: 'sent',
  sent: 'approved',
};

function StatusBadge({ status }: { status: Quotation['status'] }) {
  const variant = STATUS_BADGE_VARIANT[status];
  if (variant !== null) {
    return <Badge variant={variant}>{status}</Badge>;
  }
  // 'converted' — purple inline badge
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
      {status}
    </span>
  );
}

export function Quotations() {
  const navigate = useNavigate();
  const today = new Date();

  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [filterMonth, setFilterMonth] = useState(today.getMonth());
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [viewQuotation, setViewQuotation] = useState<Quotation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { start, end } = getMonthRange(filterYear, filterMonth);
  const { quotations, loading, updateQuotation, deleteQuotation } = useQuotations({
    start,
    end,
    sub_brand: filterBrand || undefined,
    status: filterStatus || undefined,
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

  // Summary stats
  const totalValue = quotations.reduce((sum, q) => sum + q.total_amount, 0);
  const approvedCount = quotations.filter(q => q.status === 'approved').length;
  const convertedCount = quotations.filter(q => q.status === 'converted').length;

  async function handleDownloadPDF(q: Quotation) {
    if (!settings) return;
    const clientName = q.client?.name || q.client_name_override || '';
    const clientForPDF = q.client
      ? { name: q.client.name, email: q.client.email, phone: null, address: q.client.address, state: q.client.state, gstin: q.client.gstin }
      : q.client_name_override
      ? { name: q.client_name_override, email: q.client_email_override, phone: null, address: null, state: null, gstin: null }
      : null;
    const blob = await pdf(
      <QuotationPDF quotation={q} client={clientForPDF} businessSettings={settings} />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '');
    a.download = `OrderForm-${q.quotation_number}${safeName ? '-' + safeName : ''}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCycleStatus(q: Quotation) {
    const next = STATUS_CYCLE[q.status];
    if (!next) return;
    await updateQuotation(q.id, { status: next });
  }

  async function handleMarkConverted(q: Quotation) {
    await updateQuotation(q.id, { status: 'converted' });
  }

  const selectClass =
    'px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

  return (
    <div>
      <TopBar
        title="Quotations"
        subtitle="Order Forms & Proposals"
        actions={
          <Button size="sm" onClick={() => navigate('/quotations/new')}>
            <Plus size={16} /> New Quotation
          </Button>
        }
      />

      <div className="px-4 md:px-6 py-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(Number(e.target.value))}
            className={selectClass}
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className={selectClass}
          >
            {years.map(y => (
              <option key={y.value} value={y.value}>{y.label}</option>
            ))}
          </select>
          <select
            value={filterBrand}
            onChange={e => setFilterBrand(e.target.value)}
            className={selectClass}
          >
            <option value="">All Brands</option>
            <option value="Ritera Publishing">Ritera Publishing</option>
            <option value="Ratixinfo Tech">Ratixinfo Tech</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className={selectClass}
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="converted">Converted</option>
          </select>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Total Quotations</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{quotations.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Total Value</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{formatCurrency(totalValue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Approved</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{approvedCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Converted</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{convertedCount}</p>
          </div>
        </div>

        {/* Table */}
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Quotation No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">Valid Until</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">Sub-brand</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">Title</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : quotations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                      <FileText size={32} className="mx-auto mb-2 text-gray-300" />
                      No quotations found
                    </td>
                  </tr>
                ) : quotations.map(q => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-blue-700">{q.quotation_number}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(q.date)}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {q.valid_until ? formatDate(q.valid_until) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {q.client?.name || q.client_name_override || <span className="text-gray-400 italic">Unknown</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{q.sub_brand}</td>
                    <td className="px-4 py-3 text-gray-700 hidden lg:table-cell">
                      {q.title.length > 30 ? `${q.title.slice(0, 30)}…` : q.title}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(q.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {/* Clickable status cycles draft→sent→approved */}
                      {(q.status === 'draft' || q.status === 'sent') ? (
                        <button
                          onClick={() => handleCycleStatus(q)}
                          title={`Advance to ${STATUS_CYCLE[q.status]}`}
                          className="hover:opacity-75 transition-opacity"
                        >
                          <StatusBadge status={q.status} />
                        </button>
                      ) : (
                        <StatusBadge status={q.status} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewQuotation(q)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                          title="View"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(q)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                          title="Download Order Form as PDF"
                        >
                          <Download size={15} />
                        </button>
                        <button
                          onClick={() => navigate(`/quotations/${q.id}/edit`)}
                          className="p-1.5 rounded hover:bg-blue-50 text-blue-500"
                          title="Edit"
                        >
                          <Edit size={15} />
                        </button>
                        {(q.status === 'approved' || q.status === 'sent') && (
                          <button
                            onClick={() => navigate(`/proforma/new?quotation_id=${q.id}`)}
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                            title="Create Proforma Invoice"
                          >
                            <FileCheck size={15} />
                          </button>
                        )}
                        {q.status === 'approved' && (
                          <button
                            onClick={() => handleMarkConverted(q)}
                            className="p-1.5 rounded hover:bg-green-50 text-green-600"
                            title="Mark as Converted"
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDelete(q.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-red-500"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* View Modal */}
      {viewQuotation && (
        <Modal
          isOpen={!!viewQuotation}
          onClose={() => setViewQuotation(null)}
          title={`Quotation ${viewQuotation.quotation_number}`}
          size="lg"
        >
          <div className="space-y-4 text-sm">
            {/* Header details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Client</p>
                <p className="font-semibold">
                  {viewQuotation.client?.name || viewQuotation.client_name_override || '—'}
                </p>
                {viewQuotation.client?.gstin && (
                  <p className="text-xs text-gray-500">GSTIN: {viewQuotation.client.gstin}</p>
                )}
                {(viewQuotation.client?.email || viewQuotation.client_email_override) && (
                  <p className="text-xs text-gray-500">
                    {viewQuotation.client?.email || viewQuotation.client_email_override}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="font-semibold">{formatDate(viewQuotation.date)}</p>
                {viewQuotation.valid_until && (
                  <>
                    <p className="text-xs text-gray-500 mt-1">Valid Until</p>
                    <p className="font-semibold">{formatDate(viewQuotation.valid_until)}</p>
                  </>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Sub-brand</p>
                <p className="font-semibold">{viewQuotation.sub_brand}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <div className="mt-0.5"><StatusBadge status={viewQuotation.status} /></div>
              </div>
            </div>

            {/* Title / Subject */}
            <div className="bg-blue-50 rounded-lg px-4 py-3">
              <p className="text-xs text-blue-500 font-medium uppercase mb-0.5">Subject</p>
              <p className="font-semibold text-blue-900">{viewQuotation.title}</p>
            </div>

            {/* Items table */}
            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Description</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Qty</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600">Unit</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Rate</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {viewQuotation.items.map((item, i) => (
                  <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-center">{item.unit}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(item.rate)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-60 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(viewQuotation.taxable_value)}</span>
                </div>
                {viewQuotation.include_gst && !viewQuotation.is_igst && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">CGST ({viewQuotation.gst_rate / 2}%)</span>
                      <span>{formatCurrency(viewQuotation.cgst_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">SGST ({viewQuotation.gst_rate / 2}%)</span>
                      <span>{formatCurrency(viewQuotation.sgst_amount)}</span>
                    </div>
                  </>
                )}
                {viewQuotation.include_gst && viewQuotation.is_igst && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">IGST ({viewQuotation.gst_rate}%)</span>
                    <span>{formatCurrency(viewQuotation.igst_amount)}</span>
                  </div>
                )}
                {!viewQuotation.include_gst && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">GST</span>
                    <span className="text-gray-400">Not applicable</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2">
                  <span>Total</span>
                  <span className="text-blue-700">{formatCurrency(viewQuotation.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Notes & Terms */}
            {viewQuotation.notes && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Notes</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{viewQuotation.notes}</p>
              </div>
            )}
            {viewQuotation.terms && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Terms & Conditions</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{viewQuotation.terms}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {settings && (
                <Button onClick={() => handleDownloadPDF(viewQuotation)}>
                  <Download size={16} /> Download Order Form
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => { setViewQuotation(null); navigate(`/quotations/${viewQuotation.id}/edit`); }}
              >
                <Edit size={16} /> Edit
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <Modal
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          title="Delete Quotation"
          size="sm"
        >
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to delete this quotation? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="danger"
              onClick={async () => {
                await deleteQuotation(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
