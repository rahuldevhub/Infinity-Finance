import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useInvoices } from '../hooks/useInvoices';
import { useClients } from '../hooks/useClients';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { useAuth } from '../hooks/useAuth';
import type { InvoiceItem } from '../types';
import { INDIAN_STATES, GST_RATES } from '../types';
import { calculateLineItem, calculateInvoiceTotals, isInterState } from '../utils/gstCalculations';
import { generateDocNumber } from '../utils/documentNumber';
import { formatCurrency } from '../utils/formatters';
import { ClientSelector } from '../components/invoice/ClientSelector';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

interface LineItemRow {
  description: string;
  hsn_sac: string;
  quantity: string;
  unit: string;
  rate: string;
  gst_rate: number;
}

interface NonGSTLineItemRow {
  description: string;
  quantity: string;
  unit: string;
  rate: string;
}

const defaultItem: LineItemRow = {
  description: '', hsn_sac: '', quantity: '1', unit: 'Nos', rate: '', gst_rate: 18,
};

const defaultNonGSTItem: NonGSTLineItemRow = {
  description: '', quantity: '1', unit: 'Nos', rate: '',
};

export function CreateInvoice() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: editId } = useParams<{ id?: string }>();
  const isEditing = Boolean(editId);
  const { user } = useAuth();
  const { createInvoice, updateInvoice } = useInvoices();
  const { clients, createClient } = useClients();
  const { settings } = useBusinessSettings();

  // Read invoice type from URL param (passed from Invoices tab)
  const urlParams = new URLSearchParams(location.search);
  const initialType = urlParams.get('type') === 'non_gst' ? 'non_gst' : 'gst';

  const [invoiceType, setInvoiceType] = useState<'gst' | 'non_gst'>(initialType);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [subBrand, setSubBrand] = useState('Ritera Publishing');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [placeOfSupplyCode, setPlaceOfSupplyCode] = useState('33');
  const [items, setItems] = useState<LineItemRow[]>([{ ...defaultItem }]);
  const [nonGstItems, setNonGstItems] = useState<NonGSTLineItemRow[]>([{ ...defaultNonGSTItem }]);
  const [nonGstPaymentStatus, setNonGstPaymentStatus] = useState<'paid' | 'pending'>('pending');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(isEditing);

  useEffect(() => {
    if (!isEditing) {
      generateDocNumber(invoiceType === 'non_gst' ? 'REC' : 'INV').then(setInvoiceNumber).catch(() => {});
    }
  }, [isEditing, invoiceType]);

  // Load existing invoice for edit
  useEffect(() => {
    if (!isEditing || !editId) return;
    async function load() {
      setLoadingEdit(true);
      try {
        const { data, error: err } = await supabase
          .from('invoices')
          .select('*, client:clients(*)')
          .eq('id', editId)
          .single();
        if (err) throw err;
        if (!data) return;
        setInvoiceType(data.invoice_type || 'gst');
        setInvoiceNumber(data.invoice_number);
        setInvoiceDate(data.invoice_date);
        setDueDate(data.due_date || '');
        setSubBrand(data.sub_brand || 'Ritera Publishing');
        setPlaceOfSupplyCode(data.place_of_supply_code || '33');
        setNotes(data.notes || '');
        if (data.client) setSelectedClient({ ...data.client, id: data.client_id });
        if (data.invoice_type === 'non_gst') {
          setNonGstPaymentStatus(data.payment_status || 'pending');
          setNonGstItems((data.items || []).map((item: any) => ({
            description: item.description,
            quantity: String(item.quantity),
            unit: item.unit,
            rate: String(item.rate),
          })));
        } else {
          setItems((data.items || []).map((item: any) => ({
            description: item.description,
            hsn_sac: item.hsn_sac || '',
            quantity: String(item.quantity),
            unit: item.unit,
            rate: String(item.rate),
            gst_rate: item.gst_rate || 18,
          })));
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load invoice');
      } finally {
        setLoadingEdit(false);
      }
    }
    load();
  }, [isEditing, editId]);

  const placeOfSupply = INDIAN_STATES.find(s => s.code === placeOfSupplyCode);
  const igst = isInterState(placeOfSupplyCode);

  // GST item helpers
  function updateItem(index: number, field: keyof LineItemRow, value: string | number) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function addItem() {
    setItems(prev => [...prev, { ...defaultItem }]);
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  // Non-GST item helpers
  function updateNonGSTItem(index: number, field: keyof NonGSTLineItemRow, value: string) {
    setNonGstItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function addNonGSTItem() {
    setNonGstItems(prev => [...prev, { ...defaultNonGSTItem }]);
  }

  function removeNonGSTItem(index: number) {
    setNonGstItems(prev => prev.filter((_, i) => i !== index));
  }

  // GST calculations
  const calculatedItems: InvoiceItem[] = items.map(item => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const { taxableValue, cgst, sgst, igst: igstAmt, total } = calculateLineItem(qty, rate, item.gst_rate, igst);
    return {
      description: item.description,
      hsn_sac: item.hsn_sac,
      quantity: qty,
      unit: item.unit,
      rate,
      taxable_value: taxableValue,
      gst_rate: item.gst_rate,
      cgst,
      sgst,
      igst: igstAmt,
      total,
    };
  });

  const totals = calculateInvoiceTotals(calculatedItems);

  // Non-GST total
  const nonGstTotal = nonGstItems.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient) { setError('Please select a client.'); return; }
    if (!invoiceNumber.trim()) { setError('Invoice number is required.'); return; }

    setSaving(true);
    setError('');
    try {
      if (invoiceType === 'gst') {
        if (items.some(i => !i.description.trim())) {
          setError('All items must have a description.');
          setSaving(false);
          return;
        }
        const payload = {
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          client_id: selectedClient.id,
          sub_brand: subBrand,
          place_of_supply: placeOfSupply?.name || '',
          place_of_supply_code: placeOfSupplyCode,
          is_igst: igst,
          items: calculatedItems,
          ...totals,
          notes: notes || null,
          created_by: user?.id || '',
          invoice_type: 'gst' as const,
        };
        if (isEditing && editId) {
          await updateInvoice(editId, payload);
        } else {
          await createInvoice({ ...payload, payment_status: 'pending' });
        }
      } else {
        if (nonGstItems.some(i => !i.description.trim())) {
          setError('All items must have a description.');
          setSaving(false);
          return;
        }
        const invoiceItems: InvoiceItem[] = nonGstItems.map(item => {
          const qty = parseFloat(item.quantity) || 0;
          const rate = parseFloat(item.rate) || 0;
          const amount = qty * rate;
          return {
            description: item.description,
            hsn_sac: '',
            quantity: qty,
            unit: item.unit,
            rate,
            taxable_value: amount,
            gst_rate: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            total: amount,
          };
        });
        const payload = {
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: null,
          client_id: selectedClient.id,
          sub_brand: subBrand,
          place_of_supply: 'N/A',
          place_of_supply_code: '00',
          is_igst: false,
          items: invoiceItems,
          taxable_value: nonGstTotal,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 0,
          total_amount: nonGstTotal,
          payment_status: nonGstPaymentStatus,
          notes: notes || null,
          created_by: user?.id || '',
          invoice_type: 'non_gst' as const,
        };
        if (isEditing && editId) {
          await updateInvoice(editId, payload);
        } else {
          await createInvoice(payload);
        }
      }
      navigate('/invoices');
    } catch (e: any) {
      setError(e.message || `Failed to ${isEditing ? 'update' : 'create'} invoice`);
    } finally {
      setSaving(false);
    }
  }

  if (loadingEdit) {
    return (
      <div>
        <TopBar title="Edit Invoice" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar
        title={isEditing ? 'Edit Invoice' : 'New Invoice'}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
            <ArrowLeft size={16} /> Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="px-4 md:px-6 py-6 space-y-6 max-w-5xl">
        {/* Invoice Type Toggle */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Invoice Type</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInvoiceType('gst')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                invoiceType === 'gst'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              GST Invoice
            </button>
            <button
              type="button"
              onClick={() => setInvoiceType('non_gst')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                invoiceType === 'non_gst'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Non-GST Invoice
            </button>
          </div>
          {invoiceType === 'non_gst' && (
            <p className="mt-2 text-xs text-gray-400">
              A simple receipt — no GSTIN or tax calculations. Used for collections where GST is not applicable.
            </p>
          )}
        </Card>

        {/* Invoice Details */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Invoice Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Invoice Number"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              required
            />
            <Input
              label="Invoice Date"
              type="date"
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
              required
            />
            {invoiceType === 'gst' && (
              <Input
                label="Due Date"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            )}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Sub-brand</label>
              <select
                value={subBrand}
                onChange={e => setSubBrand(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(settings?.sub_brands || ['Ritera Publishing', 'Ratixinfo Tech']).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Client & Supply Details */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            {invoiceType === 'gst' ? 'Client & Supply Details' : 'Client'}
          </h2>
          <div className={`grid grid-cols-1 ${invoiceType === 'gst' ? 'md:grid-cols-2' : ''} gap-4`}>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Client *</label>
              <ClientSelector
                clients={clients}
                selected={selectedClient}
                onSelect={c => {
                  setSelectedClient(c);
                  if (invoiceType === 'gst') setPlaceOfSupplyCode(c.state_code || '33');
                }}
                onClear={() => setSelectedClient(null)}
                onCreateClient={createClient}
              />
            </div>
            {invoiceType === 'gst' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Place of Supply *</label>
                <select
                  value={placeOfSupplyCode}
                  onChange={e => setPlaceOfSupplyCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {INDIAN_STATES.map(s => (
                    <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  {igst ? '⚡ Inter-state → IGST applies' : '✓ Intra-state → CGST + SGST applies'}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Line Items */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Line Items</h2>

          {invoiceType === 'gst' ? (
            <div className="space-y-3">
              {/* GST header row — desktop only */}
              <div className="hidden lg:grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase px-1">
                <div className="col-span-3">Description</div>
                <div className="col-span-1">HSN/SAC</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-1">Unit</div>
                <div className="col-span-2">Rate (₹)</div>
                <div className="col-span-1">GST %</div>
                <div className="col-span-2">Taxable (₹)</div>
                <div className="col-span-1">Total (₹)</div>
              </div>

              {items.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 lg:border-0 lg:p-0">
                  <div className="grid grid-cols-2 lg:grid-cols-12 gap-2">
                    <div className="col-span-2 lg:col-span-3">
                      <input
                        placeholder="Description *"
                        value={item.description}
                        onChange={e => updateItem(index, 'description', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-1 lg:col-span-1">
                      <input
                        placeholder="HSN/SAC"
                        value={item.hsn_sac}
                        onChange={e => updateItem(index, 'hsn_sac', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-1 lg:col-span-1">
                      <input
                        type="number" placeholder="Qty" min="0" step="0.01"
                        value={item.quantity}
                        onChange={e => updateItem(index, 'quantity', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-1 lg:col-span-1">
                      <input
                        placeholder="Unit"
                        value={item.unit}
                        onChange={e => updateItem(index, 'unit', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-1 lg:col-span-2">
                      <input
                        type="number" placeholder="Rate" min="0" step="0.01"
                        value={item.rate}
                        onChange={e => updateItem(index, 'rate', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-1 lg:col-span-1">
                      <select
                        value={item.gst_rate}
                        onChange={e => updateItem(index, 'gst_rate', Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                    <div className="col-span-1 lg:col-span-2">
                      <input
                        readOnly
                        value={formatCurrency(calculatedItems[index]?.taxable_value || 0)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm bg-gray-50 text-gray-700"
                      />
                    </div>
                    <div className="col-span-1 lg:col-span-1 flex gap-1">
                      <input
                        readOnly
                        value={formatCurrency(calculatedItems[index]?.total || 0)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm bg-gray-50 font-semibold text-gray-900"
                      />
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-400 px-1 hidden lg:block">
                    {igst
                      ? `IGST: ${formatCurrency(calculatedItems[index]?.igst || 0)}`
                      : `CGST: ${formatCurrency(calculatedItems[index]?.cgst || 0)} | SGST: ${formatCurrency(calculatedItems[index]?.sgst || 0)}`
                    }
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus size={15} /> Add Line Item
              </Button>

              {/* GST Totals Summary */}
              <div className="mt-6 border-t border-gray-200 pt-4 flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal (Taxable)</span>
                    <span className="font-medium">{formatCurrency(totals.taxable_value)}</span>
                  </div>
                  {!igst ? (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span>CGST</span>
                        <span>{formatCurrency(totals.cgst_amount)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>SGST</span>
                        <span>{formatCurrency(totals.sgst_amount)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-gray-600">
                      <span>IGST</span>
                      <span>{formatCurrency(totals.igst_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2">
                    <span>Grand Total</span>
                    <span className="text-blue-700">{formatCurrency(totals.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Non-GST line items
            <div className="space-y-3">
              {/* Non-GST header row — desktop only */}
              <div className="hidden lg:grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase px-1">
                <div className="col-span-5">Description</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Unit</div>
                <div className="col-span-2">Rate (₹)</div>
                <div className="col-span-1">Amount (₹)</div>
              </div>

              {nonGstItems.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 lg:border-0 lg:p-0">
                  <div className="grid grid-cols-2 lg:grid-cols-12 gap-2">
                    <div className="col-span-2 lg:col-span-5">
                      <input
                        placeholder="Description *"
                        value={item.description}
                        onChange={e => updateNonGSTItem(index, 'description', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-1 lg:col-span-2">
                      <input
                        type="number" placeholder="Qty" min="0" step="0.01"
                        value={item.quantity}
                        onChange={e => updateNonGSTItem(index, 'quantity', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-1 lg:col-span-2">
                      <input
                        placeholder="Unit"
                        value={item.unit}
                        onChange={e => updateNonGSTItem(index, 'unit', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-1 lg:col-span-2">
                      <input
                        type="number" placeholder="Rate" min="0" step="0.01"
                        value={item.rate}
                        onChange={e => updateNonGSTItem(index, 'rate', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-1 lg:col-span-1 flex gap-1">
                      <input
                        readOnly
                        value={formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0))}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm bg-gray-50 font-semibold text-gray-900"
                      />
                      {nonGstItems.length > 1 && (
                        <button type="button" onClick={() => removeNonGSTItem(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" size="sm" onClick={addNonGSTItem}>
                <Plus size={15} /> Add Line Item
              </Button>

              {/* Non-GST Totals Summary */}
              <div className="mt-6 border-t border-gray-200 pt-4 flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatCurrency(nonGstTotal)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2">
                    <span>Grand Total</span>
                    <span className="text-blue-700">{formatCurrency(nonGstTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Notes */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Notes</h2>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Payment terms, additional notes..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Card>

        {/* Payment Status — Non-GST only */}
        {invoiceType === 'non_gst' && (
          <Card>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Payment Status</h2>
            <div className="flex gap-2">
              {(['pending', 'paid'] as const).map(status => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setNonGstPaymentStatus(status)}
                  className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
                    nonGstPaymentStatus === status
                      ? status === 'paid'
                        ? 'bg-green-600 text-white'
                        : 'bg-yellow-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </Card>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3 pb-8">
          <Button type="submit" size="lg" loading={saving}>
            {isEditing ? 'Update Invoice' : 'Create Invoice'}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => navigate('/invoices')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
