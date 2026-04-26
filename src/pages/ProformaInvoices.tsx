import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Eye, Edit, Trash2, CheckCircle, FileCheck, Receipt, ChevronDown } from 'lucide-react';
import { usePDFDownload } from '../hooks/usePDFDownload';
import { useProforma } from '../hooks/useProforma';
import type { ProformaInvoice } from '../hooks/useProforma';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { ProformaPDF } from '../components/proforma/ProformaPDF';
import { formatCurrency, formatDate, getMonthRange } from '../utils/formatters';

const STATUS_BADGE: Record<string, 'gray' | 'blue' | 'green' | 'red'> = {
  draft: 'gray',
  sent: 'blue',
  paid: 'green',
  cancelled: 'red',
};

const selectClass = 'px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

export function ProformaInvoices() {
  const navigate = useNavigate();
  const { downloadPDF, loading: pdfLoading } = usePDFDownload();
  const today = new Date();

  const [filterYear, setFilterYear]   = useState(today.getFullYear());
  const [filterMonth, setFilterMonth] = useState(today.getMonth());
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [viewItem, setViewItem]       = useState<ProformaInvoice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const { start, end } = getMonthRange(filterYear, filterMonth);
  const { proformas, loading, updateProforma, deleteProforma } = useProforma({
    start, end,
    sub_brand: filterBrand || undefined,
    status: filterStatus || undefined,
  });
  const { settings } = useBusinessSettings();

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: new Date(2024, i, 1).toLocaleDateString('en-IN', { month: 'long' }),
  }));
  const years = [today.getFullYear() - 1, today.getFullYear()].map(y => ({ value: String(y), label: String(y) }));

  const totalValue  = proformas.reduce((s, p) => s + p.total_amount, 0);
  const sentCount   = proformas.filter(p => p.status === 'sent').length;
  const paidCount   = proformas.filter(p => p.status === 'paid').length;

  async function handleDownloadPDF(p: ProformaInvoice) {
    if (!settings) return;
    const clientName = (p.client?.name || p.client_name_override || '').replace(/[^a-zA-Z0-9]/g, '');
    await downloadPDF(
      <ProformaPDF proforma={p} businessSettings={settings} />,
      `Proforma-${p.proforma_number}${clientName ? '-' + clientName : ''}.pdf`
    );
  }

  async function handleMarkPaid(p: ProformaInvoice) {
    await updateProforma(p.id, { status: 'paid', payment_status: 'paid' });
  }

  return (
    <div>
      <TopBar
        title="Proforma Invoices"
        subtitle="Advance payment requests sent before work begins"
        actions={
          <Button size="sm" onClick={() => navigate('/proforma/new')}>
            <Plus size={16} /> New Proforma
          </Button>
        }
      />

      <div className="px-4 md:px-6 py-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className={selectClass}>
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className={selectClass}>
            {years.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
          </select>
          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className={selectClass}>
            <option value="">All Brands</option>
            <option value="Ritera Publishing">Ritera Publishing</option>
            <option value="Ratixinfo Tech">Ratixinfo Tech</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectClass}>
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{proformas.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Total Value</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{formatCurrency(totalValue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Sent / Pending</p>
            <p className="text-2xl font-bold text-blue-500 mt-1">{sentCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Paid</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{paidCount}</p>
          </div>
        </div>

        {/* Table */}
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Proforma No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">Sub-brand</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">GST</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : proformas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-gray-400">
                      <FileCheck size={32} className="mx-auto mb-2 text-gray-300" />
                      <p className="font-medium">No proforma invoices yet.</p>
                      <p className="text-xs mt-1">Create one from an approved quotation or directly.</p>
                    </td>
                  </tr>
                ) : proformas.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-blue-700">{p.proforma_number}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(p.date)}</td>
                    <td className="px-4 py-3 text-gray-900">
                      {p.client?.name || p.client_name_override || <span className="text-gray-400 italic">Unknown</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{p.sub_brand}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(p.total_amount)}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500 hidden lg:table-cell">
                      {p.include_gst ? `${p.gst_rate}%` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="relative inline-block">
                        <button
                          onClick={() => setStatusDropdown(statusDropdown === p.id ? null : p.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer ${
                            p.status === 'paid' ? 'bg-green-100 text-green-700' :
                            p.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                            p.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {p.status} <ChevronDown size={10} />
                        </button>
                        {statusDropdown === p.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setStatusDropdown(null)} />
                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[110px]">
                              {(['draft', 'sent', 'paid', 'cancelled'] as const).map(s => (
                                <button
                                  key={s}
                                  onClick={async () => {
                                    setStatusDropdown(null);
                                    await updateProforma(p.id, {
                                      status: s,
                                      ...(s === 'paid' ? { payment_status: 'paid' } : {}),
                                    });
                                    setToast(`Status updated to ${s}`);
                                    setTimeout(() => setToast(''), 3000);
                                  }}
                                  className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-50 capitalize ${
                                    p.status === s ? 'text-blue-600' : 'text-gray-700'
                                  }`}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewItem(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="View">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => handleDownloadPDF(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-50" disabled={pdfLoading} title="Download PDF">
                          <Download size={15} />
                        </button>
                        {p.status === 'sent' && (
                          <button onClick={() => handleMarkPaid(p)} className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Mark as Paid">
                            <CheckCircle size={15} />
                          </button>
                        )}
                        {p.status === 'paid' && (
                          <button
                            onClick={() => navigate(`/receipts/new?proforma_id=${p.id}&amount=${p.total_amount}&towards=${encodeURIComponent(p.proforma_number)}&client_id=${p.client_id || ''}&client_name=${encodeURIComponent(p.client?.name || p.client_name_override || '')}&sub_brand=${encodeURIComponent(p.sub_brand)}`)}
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-500"
                            title="Generate Receipt"
                          >
                            <Receipt size={15} />
                          </button>
                        )}
                        <button onClick={() => navigate(`/proforma/${p.id}/edit`)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" title="Edit">
                          <Edit size={15} />
                        </button>
                        <button onClick={() => setConfirmDelete(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete">
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
      {viewItem && (
        <Modal isOpen={!!viewItem} onClose={() => setViewItem(null)} title={`Proforma ${viewItem.proforma_number}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Client</p>
                <p className="font-semibold">{viewItem.client?.name || viewItem.client_name_override || '—'}</p>
                {viewItem.client?.email && <p className="text-xs text-gray-500">{viewItem.client.email}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="font-semibold">{formatDate(viewItem.date)}</p>
                {viewItem.due_date && (
                  <>
                    <p className="text-xs text-gray-500 mt-1">Due Date</p>
                    <p className="font-semibold">{formatDate(viewItem.due_date)}</p>
                  </>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Sub-brand</p>
                <p className="font-semibold">{viewItem.sub_brand}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <div className="mt-0.5"><Badge variant={STATUS_BADGE[viewItem.status]}>{viewItem.status}</Badge></div>
              </div>
            </div>

            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Description</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="px-3 py-2 text-center font-semibold">Unit</th>
                  <th className="px-3 py-2 text-right font-semibold">Rate</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {viewItem.items.map((item, i) => (
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

            <div className="flex justify-end">
              <div className="w-60 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(viewItem.taxable_value)}</span></div>
                {viewItem.include_gst && !viewItem.is_igst && (
                  <>
                    <div className="flex justify-between"><span className="text-gray-500">CGST ({viewItem.gst_rate / 2}%)</span><span>{formatCurrency(viewItem.cgst_amount)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">SGST ({viewItem.gst_rate / 2}%)</span><span>{formatCurrency(viewItem.sgst_amount)}</span></div>
                  </>
                )}
                {viewItem.include_gst && viewItem.is_igst && (
                  <div className="flex justify-between"><span className="text-gray-500">IGST ({viewItem.gst_rate}%)</span><span>{formatCurrency(viewItem.igst_amount)}</span></div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2">
                  <span>Total</span><span className="text-blue-700">{formatCurrency(viewItem.total_amount)}</span>
                </div>
              </div>
            </div>

            {viewItem.notes && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Notes</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{viewItem.notes}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {settings && (
                <Button onClick={() => handleDownloadPDF(viewItem)} disabled={pdfLoading}>
                  <Download size={16} /> {pdfLoading ? 'Generating…' : 'Download PDF'}
                </Button>
              )}
              {viewItem.status === 'sent' && (
                <Button variant="secondary" onClick={() => { handleMarkPaid(viewItem); setViewItem(null); }}>
                  <CheckCircle size={16} /> Mark as Paid
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Proforma" size="sm">
          <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this proforma invoice? This cannot be undone.</p>
          <div className="flex gap-3">
            <Button variant="danger" onClick={async () => { await deleteProforma(confirmDelete); setConfirmDelete(null); }}>Delete</Button>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
