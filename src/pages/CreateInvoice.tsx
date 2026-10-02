/* eslint-disable @typescript-eslint/no-explicit-any -- Existing form integrates polymorphic Supabase document payloads. */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useInvoices } from '../hooks/useInvoices';
import { useClients } from '../hooks/useClients';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { useAuth } from '../hooks/useAuth';
import type { Client, InvoiceItem } from '../types';
import { INDIAN_STATES, GST_RATES } from '../types';
import { isInterState } from '../utils/gstCalculations';
import { generateDocNumber } from '../utils/documentNumber';
import { formatCurrency, toLocalDateString } from '../utils/formatters';
import { ClientSelector } from '../components/invoice/ClientSelector';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import {
  calculateFinalInvoice,
  calculateInvoiceSettlement,
  validateInvoiceDiscount,
} from '../domain/invoiceCalculations';
import type { InvoiceDiscountType, SettlementReceipt } from '../domain/invoiceCalculations';
import { normalizeInvoiceDiscount } from '../domain/invoiceCompatibility';
import type { Invoice } from '../types';

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

const DEFAULT_FINAL_INVOICE_NOTES = 'Thank you for choosing Ritera Publishing. This tax invoice is issued for the services provided as described above.';

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
  const prefillProjectId = urlParams.get('project_id');

  const [invoiceType, setInvoiceType] = useState<'gst' | 'non_gst'>(initialType);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(toLocalDateString());
  const [subBrand, setSubBrand] = useState('Ritera Publishing');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [billTo, setBillTo] = useState({ name: '', gstin: '', address: '', stateCode: '33', email: '', phone: '' });
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(prefillProjectId);
  const [placeOfSupplyCode, setPlaceOfSupplyCode] = useState('33');
  const [items, setItems] = useState<LineItemRow[]>([{ ...defaultItem }]);
  const [nonGstItems, setNonGstItems] = useState<NonGSTLineItemRow[]>([{ ...defaultNonGSTItem }]);
  const [discountType, setDiscountType] = useState<InvoiceDiscountType>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [settlementReceipts, setSettlementReceipts] = useState<SettlementReceipt[]>([]);
  const [notes, setNotes] = useState(DEFAULT_FINAL_INVOICE_NOTES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(isEditing);

  useEffect(() => {
    if (!isEditing) {
      generateDocNumber(invoiceType === 'non_gst' ? 'REC' : 'INV')
        .then(setInvoiceNumber)
        .catch((numberError: unknown) => setError(numberError instanceof Error ? numberError.message : 'Invoice number could not be generated.'));
    }
  }, [isEditing, invoiceType]);

  useEffect(() => {
    if (!prefillProjectId || isEditing) return;
    async function loadProject() {
      const { data, error: projectError } = await supabase
        .from('projects')
        .select('id, name, status, sub_brand, company, approved_commercial_snapshot, client:clients(*)')
        .eq('id', prefillProjectId)
        .single();
      if (projectError || !data) {
        setError(projectError?.message || 'Project could not be loaded.');
        return;
      }
      setLinkedProjectId(data.id);
      const { data: paymentSummary, error: summaryError } = await supabase.rpc('project_payment_summary_json', { p_project_id: data.id });
      if (summaryError) {
        setError(summaryError.message);
        return;
      }
      if (data.status !== 'completed' || !data.approved_commercial_snapshot || paymentSummary?.payment_state !== 'paid') {
        setError('Final invoice is locked until the approved project is completed and every installment is fully paid.');
        return;
      }
      if (data.sub_brand) setSubBrand(data.sub_brand);
      const snapshot = data.approved_commercial_snapshot as {
        package?: { packageName?: string };
        commercials?: { taxableAmount?: number; gstRate?: number; isIgst?: boolean };
      };
      const commercials = snapshot.commercials;
      if (commercials) {
        const taxable = Number(commercials.taxableAmount || 0);
        setInvoiceType('gst');
        setItems([{
          description: `${snapshot.package?.packageName || data.name} — ${data.name}`,
          hsn_sac: '', quantity: '1', unit: 'Project', rate: String(taxable),
          gst_rate: Number(commercials.gstRate || 0),
        }]);
        if (commercials.isIgst) setPlaceOfSupplyCode('07');
        setNotes('Final invoice generated from the approved commercial snapshot.');
      }
      const projectClient = Array.isArray(data.client) ? data.client[0] : data.client;
      if (projectClient) {
        setSelectedClient(projectClient);
        setBillTo({
          name: projectClient.name || '', gstin: projectClient.gstin || '', address: projectClient.address || '',
          stateCode: projectClient.state_code || '33', email: projectClient.email || '', phone: projectClient.phone || '',
        });
        if (projectClient.state_code) {
          setPlaceOfSupplyCode(projectClient.state_code);
        }
      }
    }
    void loadProject();
  }, [isEditing, prefillProjectId]);

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
        const invoice = normalizeInvoiceDiscount(data as Invoice);
        setInvoiceType(invoice.invoice_type || 'gst');
        setLinkedProjectId(invoice.project_id || null);
        setInvoiceNumber(invoice.invoice_number);
        setInvoiceDate(invoice.invoice_date);
        setSubBrand(invoice.sub_brand || 'Ritera Publishing');
        setPlaceOfSupplyCode(invoice.place_of_supply_code || '33');
        setBillTo({
          name: invoice.client_name_override || invoice.client?.name || '',
          gstin: invoice.client_gstin_override ?? invoice.client?.gstin ?? '',
          address: invoice.billing_address_override || invoice.client?.address || '',
          stateCode: invoice.place_of_supply_code || invoice.client?.state_code || '33',
          email: invoice.client_email_override ?? invoice.client?.email ?? '',
          phone: invoice.client_phone_override ?? invoice.client?.phone ?? '',
        });
        setNotes(invoice.notes ?? DEFAULT_FINAL_INVOICE_NOTES);
        setDiscountType(invoice.discount_type || 'percent');
        setDiscountValue(Number(invoice.discount_value || 0) > 0 ? String(invoice.discount_value) : '');
        if (invoice.client) setSelectedClient({ ...invoice.client, id: invoice.client_id } as Client);
        if (invoice.invoice_type === 'non_gst') {
          setNonGstItems((invoice.items || []).map((item: any) => ({
            description: item.description,
            quantity: String(item.quantity),
            unit: item.unit,
            rate: String(item.rate),
          })));
        } else {
          setItems((invoice.items || []).map((item: any) => ({
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

  useEffect(() => {
    if (!editId && !linkedProjectId) return;
    async function loadSettlement() {
      const filters = [
        editId ? `invoice_id.eq.${editId}` : '',
        linkedProjectId ? `project_id.eq.${linkedProjectId}` : '',
      ].filter(Boolean).join(',');
      const query = await supabase
        .from('payment_receipts')
        .select('amount_received, is_void')
        .or(filters);
      if (query.error?.code === '42703' || query.error?.code === 'PGRST204') {
        const legacyQuery = await supabase.from('payment_receipts').select('amount_received').or(filters);
        if (!legacyQuery.error) setSettlementReceipts((legacyQuery.data || []) as SettlementReceipt[]);
      } else if (!query.error) {
        setSettlementReceipts((query.data || []) as SettlementReceipt[]);
      }
    }
    void loadSettlement();
  }, [editId, linkedProjectId]);

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

  const activeRows = invoiceType === 'gst'
    ? items.map((item) => ({ ...item, quantity: Number(item.quantity) || 0, rate: Number(item.rate) || 0 }))
    : nonGstItems.map((item) => ({ ...item, hsn_sac: '', gst_rate: 0, quantity: Number(item.quantity) || 0, rate: Number(item.rate) || 0 }));
  const subtotal = activeRows.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const parsedDiscountValue = discountValue.trim() ? Number(discountValue) : 0;
  const discountError = validateInvoiceDiscount(subtotal, discountType, parsedDiscountValue);
  const calculation = calculateFinalInvoice(activeRows, discountType, discountError ? 0 : parsedDiscountValue, invoiceType === 'gst' && igst);
  const calculatedItems: InvoiceItem[] = calculation.items;
  const settlement = calculateInvoiceSettlement(calculation.totalAmount, settlementReceipts);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!billTo.name.trim()) { setError('Client name is required.'); return; }
    if (!invoiceNumber.trim()) { setError('Invoice number is required.'); return; }
    if (discountError) { setError(discountError); return; }

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
          due_date: null,
          client_id: selectedClient?.id || null,
          client_name_override: billTo.name.trim(),
          client_gstin_override: billTo.gstin.trim() || null,
          billing_address_override: billTo.address.trim() || null,
          client_state_override: placeOfSupply?.name || null,
          client_email_override: billTo.email.trim() || null,
          client_phone_override: billTo.phone.trim() || null,
          project_id: linkedProjectId || null,
          sub_brand: subBrand,
          company: subBrand === 'Ratixinfo Tech' ? 'ratix' as const : subBrand === 'Infinity Enterprises' ? 'infinity' as const : 'ritera' as const,
          place_of_supply: placeOfSupply?.name || '',
          place_of_supply_code: placeOfSupplyCode,
          is_igst: igst,
          items: calculatedItems,
          taxable_value: calculation.taxableValue,
          cgst_amount: calculation.cgstAmount,
          sgst_amount: calculation.sgstAmount,
          igst_amount: calculation.igstAmount,
          total_amount: calculation.totalAmount,
          discount_type: discountType,
          discount_value: parsedDiscountValue,
          discount_amount: calculation.discountAmount,
          notes: notes || null,
          created_by: user?.id || '',
          invoice_type: 'gst' as const,
        };
        if (isEditing && editId) {
          await updateInvoice(editId, payload);
        } else {
          await createInvoice({ ...payload, payment_status: 'paid' });
        }
      } else {
        if (nonGstItems.some(i => !i.description.trim())) {
          setError('All items must have a description.');
          setSaving(false);
          return;
        }
        const payload = {
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: null,
          client_id: selectedClient?.id || null,
          client_name_override: billTo.name.trim(),
          client_gstin_override: null,
          billing_address_override: billTo.address.trim() || null,
          client_state_override: placeOfSupply?.name || null,
          client_email_override: billTo.email.trim() || null,
          client_phone_override: billTo.phone.trim() || null,
          project_id: linkedProjectId || null,
          sub_brand: subBrand,
          company: subBrand === 'Ratixinfo Tech' ? 'ratix' as const : subBrand === 'Infinity Enterprises' ? 'infinity' as const : 'ritera' as const,
          place_of_supply: 'N/A',
          place_of_supply_code: '00',
          is_igst: false,
          items: calculatedItems,
          taxable_value: calculation.taxableValue,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 0,
          total_amount: calculation.totalAmount,
          discount_type: discountType,
          discount_value: parsedDiscountValue,
          discount_amount: calculation.discountAmount,
          notes: notes || null,
          created_by: user?.id || '',
          invoice_type: 'non_gst' as const,
        };
        if (isEditing && editId) {
          await updateInvoice(editId, payload);
        } else {
          await createInvoice({ ...payload, payment_status: 'paid' });
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
              A final invoice without GST fields or tax calculations.
            </p>
          )}
        </Card>

        {/* Invoice Details */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Invoice Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        {/* Bill To */}
        <Card>
          <div className="flex flex-col gap-1 mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Bill To</h2>
            <p className="text-xs text-gray-400">Enter invoice details directly. A saved client is optional.</p>
          </div>
          <div className="space-y-4">
            <div className="max-w-xl">
              <label className="text-sm font-medium text-gray-700 block mb-1">Use saved client (optional)</label>
              <ClientSelector
                clients={clients}
                selected={selectedClient}
                onSelect={c => {
                  setSelectedClient(c);
                  const stateCode = c.state_code || '33';
                  setBillTo({
                    name: c.name || '', gstin: c.gstin || '', address: c.address || '', stateCode,
                    email: c.email || '', phone: c.phone || '',
                  });
                  setPlaceOfSupplyCode(stateCode);
                }}
                onClear={() => setSelectedClient(null)}
                onCreateClient={createClient}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Client Name" required value={billTo.name} onChange={e => setBillTo(current => ({ ...current, name: e.target.value }))} />
              {invoiceType === 'gst' && <Input label="GSTIN (optional)" value={billTo.gstin} onChange={e => setBillTo(current => ({ ...current, gstin: e.target.value }))} />}
              <Input label="Email (optional)" type="email" value={billTo.email} onChange={e => setBillTo(current => ({ ...current, email: e.target.value }))} />
              <Input label="Phone (optional)" value={billTo.phone} onChange={e => setBillTo(current => ({ ...current, phone: e.target.value }))} />
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">Billing Address (optional)</label>
                <textarea value={billTo.address} onChange={e => setBillTo(current => ({ ...current, address: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        </Card>

        {/* Supply Details */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Supply Details</h2>
          <div className="max-w-xl flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{invoiceType === 'gst' ? 'Place of Supply *' : 'State (optional)'}</label>
            <select
              value={placeOfSupplyCode}
              onChange={e => {
                setPlaceOfSupplyCode(e.target.value);
                setBillTo(current => ({ ...current, stateCode: e.target.value }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {INDIAN_STATES.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
            </select>
            {invoiceType === 'gst' && <p className="text-xs text-gray-500">{igst ? 'Inter-state — IGST applies' : 'Intra-state — CGST + SGST applies'}</p>}
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
                  <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-medium">{formatCurrency(calculation.subtotal)}</span></div>
                  {calculation.discountAmount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatCurrency(calculation.discountAmount)}</span></div>}
                  <div className="flex justify-between text-gray-600"><span>Taxable Value</span><span className="font-medium">{formatCurrency(calculation.taxableValue)}</span></div>
                  {!igst ? (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span>CGST</span>
                        <span>{formatCurrency(calculation.cgstAmount)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>SGST</span>
                        <span>{formatCurrency(calculation.sgstAmount)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-gray-600">
                      <span>IGST</span>
                      <span>{formatCurrency(calculation.igstAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2">
                    <span>Grand Total</span>
                    <span className="text-blue-700">{formatCurrency(calculation.totalAmount)}</span>
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
                        value={formatCurrency(calculatedItems[index]?.total || 0)}
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
                    <span className="font-medium">{formatCurrency(calculation.subtotal)}</span>
                  </div>
                  {calculation.discountAmount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatCurrency(calculation.discountAmount)}</span></div>}
                  <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2">
                    <span>Grand Total</span>
                    <span className="text-blue-700">{formatCurrency(calculation.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Discount and settlement */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Discount</h2>
            <div className="flex">
              <Input type="number" min="0" max={discountType === 'percent' ? 100 : undefined} step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="0" className="rounded-r-none" />
              <select value={discountType} onChange={e => setDiscountType(e.target.value as InvoiceDiscountType)} aria-label="Discount type" className="w-28 border border-l-0 border-gray-300 rounded-r-lg px-3 text-sm font-semibold bg-gray-50">
                <option value="percent">%</option><option value="flat">₹</option>
              </select>
            </div>
            {discountError ? <p className="text-xs text-red-600 mt-2">{discountError}</p> : <p className="text-xs text-gray-400 mt-2">Applied before GST.</p>}
          </Card>
          <Card>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Settlement</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Invoice Total</span><span className="font-semibold">{formatCurrency(calculation.totalAmount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Advance Received</span><span className="font-semibold text-green-700">{formatCurrency(settlement.advanceReceived)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-2"><span className="font-medium">Balance Due</span><span className="font-bold">{formatCurrency(settlement.balanceDue)}</span></div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Calculated from linked, non-void payment receipts.</p>
          </Card>
        </div>

        {/* Notes */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Notes</h2>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes for this final tax invoice..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Card>

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
