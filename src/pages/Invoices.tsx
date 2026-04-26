import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, CheckCircle, Eye, Trash2, BadgeCheck, Pencil, ChevronDown } from 'lucide-react';
import { usePDFDownload } from '../hooks/usePDFDownload';
import { useInvoices } from '../hooks/useInvoices';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import type { Invoice } from '../types';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { InvoicePDF } from '../components/invoice/InvoicePDF';
import { NonGSTInvoicePDF } from '../components/invoice/NonGSTInvoicePDF';
import { formatCurrency, formatDate, getMonthRange } from '../utils/formatters';


export function Invoices() {
  const navigate = useNavigate();
  const { downloadPDF, loading: pdfLoading } = usePDFDownload();
  const today = new Date();
  const [activeTab, setActiveTab] = useState<'gst' | 'non_gst'>('gst');
  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [filterMonth, setFilterMonth] = useState(today.getMonth());
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const { start, end } = getMonthRange(filterYear, filterMonth);
  const { invoices, loading, updateInvoice, deleteInvoice } = useInvoices({
    start, end,
    sub_brand: filterBrand || undefined,
    payment_status: filterStatus || undefined,
  });
  const { settings } = useBusinessSettings();

  // Split invoices by type client-side
  const gstInvoices = invoices.filter(i => i.invoice_type !== 'non_gst');
  const nonGstInvoices = invoices.filter(i => i.invoice_type === 'non_gst');
  const displayedInvoices = activeTab === 'gst' ? gstInvoices : nonGstInvoices;

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: new Date(2024, i, 1).toLocaleDateString('en-IN', { month: 'long' }),
  }));
  const years = [today.getFullYear() - 1, today.getFullYear()].map(y => ({ value: String(y), label: String(y) }));

  async function handleDownloadPDF(inv: Invoice) {
    if (!settings) return;
    const element = inv.invoice_type === 'non_gst'
      ? <NonGSTInvoicePDF invoice={inv} settings={settings} />
      : <InvoicePDF invoice={inv} settings={settings} />;
    await downloadPDF(element, `${inv.invoice_number}.pdf`);
  }

  async function handleMarkPaid(id: string) {
    await updateInvoice(id, { payment_status: 'paid' });
  }

  return (
    <div>
      <TopBar
        title="Invoices"
        actions={
          <Button size="sm" onClick={() => navigate(`/invoices/new?type=${activeTab}`)}>
            <Plus size={16} /> New Invoice
          </Button>
        }
      />

      <div className="px-4 md:px-6 py-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          {(['gst', 'non_gst'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab === 'gst' ? 'GST Invoices' : 'Non-GST Invoices'}
              <span className={`ml-1.5 text-xs ${activeTab === tab ? 'text-blue-200' : 'text-gray-400'}`}>
                ({tab === 'gst' ? gstInvoices.length : nonGstInvoices.length})
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {years.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
          </select>
          <select
            value={filterBrand}
            onChange={e => setFilterBrand(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Brands</option>
            <option value="Ritera Publishing">Ritera Publishing</option>
            <option value="Ratixinfo Tech">Ratixinfo Tech</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
          </select>
        </div>

        {/* Table */}
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Invoice No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">Sub-brand</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : displayedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      No {activeTab === 'gst' ? 'GST' : 'Non-GST'} invoices found
                    </td>
                  </tr>
                ) : displayedInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-blue-700">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(inv.invoice_date)}</td>
                    <td className="px-4 py-3 text-gray-900">{inv.client?.name}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">{inv.sub_brand}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(inv.total_amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="relative inline-block">
                        <button
                          onClick={() => setStatusDropdown(statusDropdown === inv.id ? null : inv.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer ${
                            inv.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                            inv.payment_status === 'partial' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {inv.payment_status} <ChevronDown size={10} />
                        </button>
                        {statusDropdown === inv.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setStatusDropdown(null)} />
                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[100px]">
                              {(['pending', 'partial', 'paid'] as const).map(s => (
                                <button
                                  key={s}
                                  onClick={async () => {
                                    setStatusDropdown(null);
                                    await updateInvoice(inv.id, { payment_status: s });
                                    setToast(`Status updated to ${s}`);
                                    setTimeout(() => setToast(''), 3000);
                                  }}
                                  className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-50 capitalize ${
                                    inv.payment_status === s ? 'text-blue-600' : 'text-gray-700'
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
                        <button onClick={() => setViewInvoice(inv)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="View">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => navigate(`/invoices/${inv.id}/edit`)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDownloadPDF(inv)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-50" disabled={pdfLoading} title="Download PDF">
                          <Download size={15} />
                        </button>
                        {inv.payment_status !== 'paid' && (
                          <button onClick={() => handleMarkPaid(inv.id)} className="p-1.5 rounded hover:bg-green-100 text-green-600" title="Mark Paid">
                            <CheckCircle size={15} />
                          </button>
                        )}
                        {(inv.payment_status === 'paid' || inv.payment_status === 'partial') && (
                          <button
                            onClick={() => navigate(`/receipts/new?invoice_id=${inv.id}&towards=${encodeURIComponent('Invoice ' + inv.invoice_number)}`)}
                            className="p-1.5 rounded hover:bg-purple-50 text-purple-600"
                            title="Generate Receipt"
                          >
                            <BadgeCheck size={15} />
                          </button>
                        )}
                        <button onClick={() => setConfirmDelete(inv.id)} className="p-1.5 rounded hover:bg-red-100 text-red-500" title="Delete">
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
      {viewInvoice && (
        <Modal isOpen={!!viewInvoice} onClose={() => setViewInvoice(null)} title={`Invoice ${viewInvoice.invoice_number}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Client</p>
                <p className="font-semibold">{viewInvoice.client?.name}</p>
                {viewInvoice.client?.gstin && <p className="text-xs text-gray-500">{viewInvoice.client.gstin}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="font-semibold">{formatDate(viewInvoice.invoice_date)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Sub-brand</p>
                <p className="font-semibold">{viewInvoice.sub_brand}</p>
              </div>
              {viewInvoice.invoice_type !== 'non_gst' && (
                <div>
                  <p className="text-xs text-gray-500">Place of Supply</p>
                  <p className="font-semibold">{viewInvoice.place_of_supply}</p>
                </div>
              )}
              {viewInvoice.invoice_type === 'non_gst' && (
                <div>
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="font-semibold text-gray-500">Non-GST Receipt</p>
                </div>
              )}
            </div>

            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  {viewInvoice.invoice_type !== 'non_gst' && (
                    <>
                      <th className="px-3 py-2 text-right">Taxable</th>
                      <th className="px-3 py-2 text-right">GST</th>
                    </>
                  )}
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {viewInvoice.items.map((item, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-right">{item.quantity} {item.unit}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(item.rate)}</td>
                    {viewInvoice.invoice_type !== 'non_gst' && (
                      <>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.taxable_value)}</td>
                        <td className="px-3 py-2 text-right">{item.gst_rate}%</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-56 space-y-2 text-sm">
                {viewInvoice.invoice_type !== 'non_gst' ? (
                  <>
                    <div className="flex justify-between"><span className="text-gray-500">Taxable Value</span><span>{formatCurrency(viewInvoice.taxable_value)}</span></div>
                    {!viewInvoice.is_igst && (
                      <>
                        <div className="flex justify-between"><span className="text-gray-500">CGST</span><span>{formatCurrency(viewInvoice.cgst_amount)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">SGST</span><span>{formatCurrency(viewInvoice.sgst_amount)}</span></div>
                      </>
                    )}
                    {viewInvoice.is_igst && (
                      <div className="flex justify-between"><span className="text-gray-500">IGST</span><span>{formatCurrency(viewInvoice.igst_amount)}</span></div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(viewInvoice.taxable_value)}</span></div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2">
                  <span>Grand Total</span><span className="text-blue-700">{formatCurrency(viewInvoice.total_amount)}</span>
                </div>
              </div>
            </div>

            {viewInvoice.invoice_type === 'non_gst' && (
              <p className="text-xs text-gray-400 italic">This is not a tax invoice. No GST has been charged.</p>
            )}

            <div className="flex gap-2 pt-2">
              {settings && (
                <Button onClick={() => handleDownloadPDF(viewInvoice)} disabled={pdfLoading}>
                  <Download size={16} /> {pdfLoading ? 'Generating…' : 'Download PDF'}
                </Button>
              )}
              {viewInvoice.payment_status !== 'paid' && (
                <Button variant="secondary" onClick={() => { handleMarkPaid(viewInvoice.id); setViewInvoice(null); }}>
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
        <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Invoice" size="sm">
          <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this invoice? This cannot be undone.</p>
          <div className="flex gap-3">
            <Button variant="danger" onClick={async () => { await deleteInvoice(confirmDelete); setConfirmDelete(null); }}>
              Delete
            </Button>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
