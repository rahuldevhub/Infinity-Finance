import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Download, Send } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { useProforma, generateProformaNumber } from '../hooks/useProforma';
import type { ProformaItem, ProformaInvoice } from '../hooks/useProforma';
import { ProformaPDF } from '../components/proforma/ProformaPDF';
import { useClients } from '../hooks/useClients';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { useAuth } from '../hooks/useAuth';
import { isInterState } from '../utils/gstCalculations';
import { formatCurrency, toLocalDateString } from '../utils/formatters';
import { ClientSelector } from '../components/invoice/ClientSelector';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LineItemRow {
  description: string;
  quantity: string;
  unit: string;
  rate: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const defaultItem: LineItemRow = { description: '', quantity: '1', unit: 'Nos', rate: '' };

const DEFAULT_NOTES = `This is a proforma invoice for advance payment purposes only. It is not a GST tax invoice.
Kindly arrange payment at your earliest convenience to proceed with the work.
A formal GST invoice will be issued upon completion.`;

const GST_RATE_OPTIONS = [0, 5, 12, 18, 28];

const SUB_BRANDS = ['Ritera Publishing', 'Ratixinfo Tech'];

// ── Component ──────────────────────────────────────────────────────────────────

export function CreateProforma() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(params.id);
  const prefillQuotationId = searchParams.get('quotation_id');

  const { user } = useAuth();
  const { createProforma, updateProforma } = useProforma();
  const { clients, createClient } = useClients();
  const { settings } = useBusinessSettings();

  // ── Proforma Details ──
  const [proformaNumber, setProformaNumber] = useState('');
  const [proformaDate, setProformaDate] = useState(toLocalDateString());
  const [dueDate, setDueDate] = useState('');
  const [subBrand, setSubBrand] = useState('Ritera Publishing');

  // ── Client ──
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [useManualClient, setUseManualClient] = useState(false);
  const [clientNameOverride, setClientNameOverride] = useState('');
  const [clientEmailOverride, setClientEmailOverride] = useState('');

  // ── Linked Document ──
  const [linkedQuotationId, setLinkedQuotationId] = useState<string | null>(null);
  const [quotationOptions, setQuotationOptions] = useState<Array<{ id: string; quotation_number: string; title: string }>>([]);

  // ── Line Items ──
  const [items, setItems] = useState<LineItemRow[]>([{ ...defaultItem }]);

  // ── GST Options ──
  const [includeGst, setIncludeGst] = useState(true);
  const [gstRate, setGstRate] = useState(18);
  const [placeOfSupplyCode, setPlaceOfSupplyCode] = useState('33');

  // ── Notes ──
  const [notes, setNotes] = useState(DEFAULT_NOTES);

  // ── UI State ──
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(isEditing);
  const [savedProforma, setSavedProforma] = useState<ProformaInvoice | null>(null);
  const [downloading, setDownloading] = useState(false);

  // ── Derived Totals ──
  const taxableValue = items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
  }, 0);
  const isIGST = isInterState(placeOfSupplyCode);
  const totalGST = includeGst ? (taxableValue * gstRate) / 100 : 0;
  const cgstAmount = !isIGST && includeGst ? totalGST / 2 : 0;
  const sgstAmount = cgstAmount;
  const igstAmount = isIGST && includeGst ? totalGST : 0;
  const totalAmount = taxableValue + totalGST;

  // ── Generate proforma number ──
  useEffect(() => {
    if (!isEditing) {
      generateProformaNumber().then(setProformaNumber).catch(() => {});
    }
  }, [isEditing]);

  // ── Load quotation options ──
  useEffect(() => {
    supabase
      .from('quotations')
      .select('id, quotation_number, title')
      .order('date', { ascending: false })
      .limit(100)
      .then(({ data }) => setQuotationOptions((data || []) as any[]));
  }, []);

  // ── Pre-fill from quotation URL param ──
  useEffect(() => {
    if (!prefillQuotationId || isEditing) return;

    async function loadQuotation() {
      const { data } = await supabase
        .from('quotations')
        .select('*, client:clients(*)')
        .eq('id', prefillQuotationId)
        .single();
      if (!data) return;

      setLinkedQuotationId(data.id);
      setSubBrand(data.sub_brand || 'Ritera Publishing');
      setIncludeGst(data.include_gst ?? true);
      setGstRate(data.gst_rate ?? 18);
      if (data.is_igst) setPlaceOfSupplyCode('07');

      if (data.client) {
        setSelectedClient(data.client);
        setUseManualClient(false);
        if (data.client.state_code) setPlaceOfSupplyCode(data.client.state_code);
      } else if (data.client_name_override) {
        setUseManualClient(true);
        setClientNameOverride(data.client_name_override || '');
        setClientEmailOverride(data.client_email_override || '');
      }

      // Restore items (non-Ritera quotations have items array)
      if (Array.isArray(data.items) && data.items.length > 0) {
        setItems(
          data.items.map((it: any) => ({
            description: it.description || '',
            quantity: String(it.quantity ?? 1),
            unit: it.unit || 'Nos',
            rate: String(it.rate ?? 0),
          }))
        );
      }
    }

    loadQuotation();
  }, [prefillQuotationId, isEditing]);

  // ── Load existing proforma for edit ──
  useEffect(() => {
    if (!isEditing || !params.id) return;

    async function loadProforma() {
      setLoadingEdit(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('proforma_invoices')
          .select('*, client:clients(*)')
          .eq('id', params.id)
          .single();
        if (fetchError) throw fetchError;
        if (!data) return;

        setProformaNumber(data.proforma_number);
        setProformaDate(data.date);
        setDueDate(data.due_date || '');
        setSubBrand(data.sub_brand);
        setLinkedQuotationId(data.quotation_id || null);
        setIncludeGst(data.include_gst);
        setGstRate(data.gst_rate);
        setPlaceOfSupplyCode(data.is_igst ? '07' : '33');
        setNotes(data.notes || DEFAULT_NOTES);

        if (Array.isArray(data.items) && data.items.length > 0) {
          setItems(
            data.items.map((it: any) => ({
              description: it.description || '',
              quantity: String(it.quantity ?? 1),
              unit: it.unit || 'Nos',
              rate: String(it.rate ?? 0),
            }))
          );
        }

        if (data.client) {
          setSelectedClient(data.client);
          setUseManualClient(false);
        } else if (data.client_name_override) {
          setUseManualClient(true);
          setClientNameOverride(data.client_name_override || '');
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load proforma');
      } finally {
        setLoadingEdit(false);
      }
    }

    loadProforma();
  }, [isEditing, params.id]);

  // ── Line item helpers ──
  function updateItem(index: number, field: keyof LineItemRow, value: string) {
    setItems(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }
  function addItem() { setItems(prev => [...prev, { ...defaultItem }]); }
  function removeItem(index: number) {
    if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== index));
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSave(status: 'draft' | 'sent') {
    setError('');
    if (!proformaNumber.trim()) { setError('Proforma number is required.'); return; }
    if (!useManualClient && !selectedClient) {
      setError('Please select a client or enter client details manually.');
      return;
    }
    if (useManualClient && !clientNameOverride.trim()) { setError('Client name is required.'); return; }

    const validItems = items.filter(i => i.description.trim());
    if (validItems.length === 0) {
      setError('At least one line item with a description is required.');
      return;
    }

    const proformaItems: ProformaItem[] = validItems.map(item => ({
      description: item.description,
      quantity: parseFloat(item.quantity) || 0,
      unit: item.unit,
      rate: parseFloat(item.rate) || 0,
      amount: (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0),
    }));

    const payload = {
      proforma_number: proformaNumber,
      date: proformaDate,
      due_date: dueDate || null,
      client_id: !useManualClient && selectedClient ? selectedClient.id : null,
      client_name_override: useManualClient ? clientNameOverride : null,
      sub_brand: subBrand,
      quotation_id: linkedQuotationId || null,
      payment_status: 'pending' as const,
      items: proformaItems,
      include_gst: includeGst,
      gst_rate: gstRate,
      taxable_value: taxableValue,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      is_igst: isIGST,
      total_amount: totalAmount,
      status,
      notes: notes.trim() || null,
      created_by: user?.id || '',
    };

    setSaving(true);
    try {
      if (isEditing && params.id) {
        await updateProforma(params.id, payload);
        navigate('/proforma');
      } else {
        const created = await createProforma(payload);
        setSavedProforma(created);
      }
    } catch (e: any) {
      setError(e.message || `Failed to ${isEditing ? 'update' : 'create'} proforma`);
    } finally {
      setSaving(false);
    }
  }

  // ── Post-save PDF download ─────────────────────────────────────────────────

  async function handleDownloadPDF() {
    if (!savedProforma || !settings) return;
    setDownloading(true);
    try {
      const clientForPDF = selectedClient
        ? { ...selectedClient }
        : useManualClient && clientNameOverride
        ? { name: clientNameOverride, email: clientEmailOverride || null, phone: null, address: null, state: null, gstin: null }
        : null;
      const blob = await pdf(
        <ProformaPDF proforma={{ ...savedProforma, client: clientForPDF }} businessSettings={settings} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Proforma-${savedProforma.proforma_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  // ── Post-save success screen ───────────────────────────────────────────────

  if (savedProforma) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar title={isEditing ? 'Edit Proforma' : 'New Proforma Invoice'} />
        <div className="max-w-lg mx-auto mt-20 text-center px-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Proforma Created!</h2>
          <p className="text-gray-500 mb-8">{savedProforma.proforma_number} has been saved successfully.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={handleDownloadPDF} disabled={downloading} variant="secondary">
              <Download size={16} className="mr-2" />
              {downloading ? 'Generating PDF…' : 'Download PDF'}
            </Button>
            <Button onClick={() => navigate('/proforma/new')}>
              <Plus size={16} className="mr-2" />
              Create Another
            </Button>
            <Button variant="secondary" onClick={() => navigate('/proforma')}>
              View All Proformas
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingEdit) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar title="Edit Proforma Invoice" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title={isEditing ? 'Edit Proforma Invoice' : 'New Proforma Invoice'} />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Back link */}
        <button
          onClick={() => navigate('/proforma')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={16} /> Back to Proforma Invoices
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* ── Proforma Details ── */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Proforma Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Proforma Number</label>
              <Input
                value={proformaNumber}
                onChange={e => setProformaNumber(e.target.value)}
                placeholder="PRF-2025-0001"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sub-brand</label>
              <select
                value={subBrand}
                onChange={e => setSubBrand(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SUB_BRANDS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Proforma Date</label>
              <Input
                type="date"
                value={proformaDate}
                onChange={e => setProformaDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date <span className="text-gray-400">(optional)</span></label>
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* ── Client ── */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Client</h3>
            <button
              type="button"
              onClick={() => {
                setUseManualClient(!useManualClient);
                setSelectedClient(null);
                setClientNameOverride('');
                setClientEmailOverride('');
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              {useManualClient ? 'Pick from client list' : 'Enter manually'}
            </button>
          </div>

          {useManualClient ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Client Name</label>
                <Input
                  value={clientNameOverride}
                  onChange={e => setClientNameOverride(e.target.value)}
                  placeholder="Client / company name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email <span className="text-gray-400">(optional)</span></label>
                <Input
                  type="email"
                  value={clientEmailOverride}
                  onChange={e => setClientEmailOverride(e.target.value)}
                  placeholder="client@email.com"
                />
              </div>
            </div>
          ) : (
            <ClientSelector
              clients={clients}
              selected={selectedClient}
              onSelect={c => {
                setSelectedClient(c);
                if ((c as any).state_code) setPlaceOfSupplyCode((c as any).state_code);
              }}
              onClear={() => setSelectedClient(null)}
              onCreateClient={createClient}
            />
          )}
        </Card>

        {/* ── Linked Document ── */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Linked Quotation <span className="text-gray-400 font-normal">(optional)</span></h3>
          <select
            value={linkedQuotationId || ''}
            onChange={e => setLinkedQuotationId(e.target.value || null)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— None —</option>
            {quotationOptions.map(q => (
              <option key={q.id} value={q.id}>
                {q.quotation_number} — {q.title}
              </option>
            ))}
          </select>
        </Card>

        {/* ── Line Items ── */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Line Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-2 text-xs font-semibold text-gray-500 w-8">#</th>
                  <th className="text-left py-2 pr-2 text-xs font-semibold text-gray-500">Description</th>
                  <th className="text-left py-2 pr-2 text-xs font-semibold text-gray-500 w-20">Qty</th>
                  <th className="text-left py-2 pr-2 text-xs font-semibold text-gray-500 w-20">Unit</th>
                  <th className="text-left py-2 pr-2 text-xs font-semibold text-gray-500 w-28">Rate (INR)</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 w-28">Amount</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const amt = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
                  return (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="py-1 pr-2">
                        <input
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.description}
                          onChange={e => updateItem(i, 'description', e.target.value)}
                          placeholder="Description of service/product"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.quantity}
                          onChange={e => updateItem(i, 'quantity', e.target.value)}
                          type="number"
                          min="0"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.unit}
                          onChange={e => updateItem(i, 'unit', e.target.value)}
                          placeholder="Nos"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.rate}
                          onChange={e => updateItem(i, 'rate', e.target.value)}
                          type="number"
                          min="0"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-1 text-right text-gray-700 font-medium">
                        {formatCurrency(amt)}
                      </td>
                      <td className="py-1 pl-2">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(i)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus size={14} /> Add Line Item
          </button>
        </Card>

        {/* ── GST Options ── */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">GST Options</h3>
          <div className="flex flex-wrap gap-6 items-start">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeGst}
                onChange={e => setIncludeGst(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              Include GST
            </label>

            {includeGst && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">GST Rate</label>
                  <div className="flex gap-2">
                    {GST_RATE_OPTIONS.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setGstRate(r)}
                        className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                          gstRate === r
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {r}%
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Place of Supply</label>
                  <select
                    value={placeOfSupplyCode}
                    onChange={e => setPlaceOfSupplyCode(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[
                      { code: '33', name: 'Tamil Nadu' },
                      { code: '07', name: 'Delhi' },
                      { code: '29', name: 'Karnataka' },
                      { code: '27', name: 'Maharashtra' },
                      { code: '36', name: 'Telangana' },
                      { code: '32', name: 'Kerala' },
                      { code: '09', name: 'Uttar Pradesh' },
                      { code: '19', name: 'West Bengal' },
                      { code: '06', name: 'Haryana' },
                      { code: '24', name: 'Gujarat' },
                      { code: '08', name: 'Rajasthan' },
                      { code: '23', name: 'Madhya Pradesh' },
                    ].map(s => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    {isIGST ? 'IGST applies (inter-state)' : 'CGST + SGST applies (intra-state)'}
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* ── Summary ── */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Summary</h3>
          <div className="max-w-xs ml-auto space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Taxable Value</span>
              <span className="font-medium">{formatCurrency(taxableValue)}</span>
            </div>
            {includeGst && (
              isIGST ? (
                <div className="flex justify-between text-gray-600">
                  <span>IGST @ {gstRate}%</span>
                  <span className="font-medium">{formatCurrency(igstAmount)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>CGST @ {gstRate / 2}%</span>
                    <span className="font-medium">{formatCurrency(cgstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>SGST @ {gstRate / 2}%</span>
                    <span className="font-medium">{formatCurrency(sgstAmount)}</span>
                  </div>
                </>
              )
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
              <span>Total Amount</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </Card>

        {/* ── Notes ── */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Notes</h3>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            placeholder="Additional notes for the client…"
          />
        </Card>

        {/* ── Action Buttons ── */}
        <div className="flex flex-wrap gap-3 justify-end pb-8">
          <Button
            variant="secondary"
            onClick={() => navigate('/proforma')}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSave('draft')}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save as Draft'}
          </Button>
          <Button
            onClick={() => handleSave('sent')}
            disabled={saving}
          >
            <Send size={15} className="mr-1.5" />
            {saving ? 'Saving…' : isEditing ? 'Update & Mark Sent' : 'Mark as Sent'}
          </Button>
        </div>

      </div>
    </div>
  );
}
