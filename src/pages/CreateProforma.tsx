import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Download, Send } from 'lucide-react';
import { useProforma, generateProformaNumber } from '../hooks/useProforma';
import type { ProformaItem, ProformaInvoice } from '../hooks/useProforma';
import { ProformaPDF } from '../components/proforma/ProformaPDF';
import { useClients } from '../hooks/useClients';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { useAuth } from '../hooks/useAuth';
import { isInterState } from '../utils/gstCalculations';
import { formatCurrency, toLocalDateString } from '../utils/formatters';
import type { Client } from '../types';
import { ClientSelector } from '../components/invoice/ClientSelector';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { amountToWords } from '../utils/amountToWords';
import { downloadPDF as downloadPDFFile } from '../utils/downloadPDF';
import {
  calculateProformaItemAmount,
  calculateProformaTotals,
  validateProformaDiscount,
} from '../domain/proformaCalculations';
import { normalizeProformaDiscount } from '../domain/proformaCompatibility';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LineItemRow {
  description: string;
  quantity: string;
  unit: string;
  rate: string;
}

interface ProformaSourceItem {
  description?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
}

interface QuotationOption {
  id: string;
  quotation_number: string;
  title: string;
  project_id: string | null;
  total_amount: number;
  status: string;
  client?: { name: string } | null;
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
  const [company, setCompany] = useState<'ritera' | 'ratix' | 'infinity'>('ritera');

  // ── Client ──
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [useManualClient, setUseManualClient] = useState(false);
  const [clientNameOverride, setClientNameOverride] = useState('');
  const [clientEmailOverride, setClientEmailOverride] = useState('');

  // ── Linked Document ──
  const [linkedQuotationId, setLinkedQuotationId] = useState<string | null>(null);
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const [quotationOptions, setQuotationOptions] = useState<QuotationOption[]>([]);

  // ── Line Items ──
  const [items, setItems] = useState<LineItemRow[]>([{ ...defaultItem }]);

  // ── Discount ──
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('percent');
  const [discountValue, setDiscountValue] = useState('');

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
  const subtotal = items.reduce((sum, item) => {
    const quantity = Math.max(parseFloat(item.quantity) || 0, 0);
    const rate = Math.max(parseFloat(item.rate) || 0, 0);
    return sum + calculateProformaItemAmount(quantity, rate);
  }, 0);
  const parsedDiscountValue = discountValue.trim() === '' ? 0 : Number(discountValue);
  const discountError = validateProformaDiscount(subtotal, discountType, parsedDiscountValue);
  const isIGST = isInterState(placeOfSupplyCode);
  const totals = calculateProformaTotals({
    subtotal,
    discountType,
    discountValue: discountError ? 0 : parsedDiscountValue,
    includeGst,
    gstRate,
    isIgst: isIGST,
  });
  const { discountAmount, taxableValue, cgstAmount, sgstAmount, igstAmount, totalAmount } = totals;
  const selectedQuotation = quotationOptions.find((quotation) => quotation.id === linkedQuotationId) || null;

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
      .select('id, quotation_number, title, project_id, total_amount, status, client:clients(name)')
      .order('date', { ascending: false })
      .limit(100)
      .then(({ data }) => setQuotationOptions((data || []) as unknown as QuotationOption[]));
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

      if (data.project_id && data.status !== 'approved') {
        setError('Project quotations must be approved before creating a proforma.');
        return;
      }

      setLinkedQuotationId(data.id);
      setLinkedProjectId(data.project_id || null);
      setSubBrand(data.sub_brand || 'Ritera Publishing');
      setCompany(data.company || (data.sub_brand === 'Ratixinfo Tech' ? 'ratix' : 'ritera'));
      setIncludeGst(data.include_gst ?? true);
      setGstRate(data.gst_rate ?? 18);
      setDiscountType((data.discount_type as 'flat' | 'percent') || 'percent');
      setDiscountValue(data.discount_value > 0 ? String(data.discount_value) : '');
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
          (data.items as ProformaSourceItem[]).map((it) => ({
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

        const proforma = normalizeProformaDiscount(data as ProformaInvoice);

        setProformaNumber(proforma.proforma_number || '');
        setProformaDate(proforma.date || '');
        setDueDate(proforma.due_date || '');
        setSubBrand(proforma.sub_brand);
        setCompany(proforma.company || (proforma.sub_brand === 'Ratixinfo Tech' ? 'ratix' : 'ritera'));
        setLinkedQuotationId(proforma.quotation_id || null);
        setLinkedProjectId(proforma.project_id || null);
        setIncludeGst(proforma.include_gst);
        setGstRate(proforma.gst_rate);
        setDiscountType(proforma.discount_type || 'percent');
        setDiscountValue(Number(proforma.discount_value || 0) > 0 ? String(proforma.discount_value) : '');
        setPlaceOfSupplyCode(proforma.is_igst ? '07' : '33');
        setNotes(proforma.notes || DEFAULT_NOTES);

        if (Array.isArray(proforma.items) && proforma.items.length > 0) {
          setItems(
            (proforma.items as ProformaSourceItem[]).map((it) => ({
              description: it.description || '',
              quantity: String(it.quantity ?? 1),
              unit: it.unit || 'Nos',
              rate: String(it.rate ?? 0),
            }))
          );
        }

        if (proforma.client) {
          setSelectedClient(proforma.client as Client);
          setUseManualClient(false);
        } else if (proforma.client_name_override) {
          setUseManualClient(true);
          setClientNameOverride(proforma.client_name_override || '');
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load proforma');
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
    if (validItems.some(item => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 0 || !Number.isFinite(Number(item.rate)) || Number(item.rate) < 0)) {
      setError('Line item quantity and rate must be valid non-negative numbers.');
      return;
    }
    if (discountError) { setError(discountError); return; }

    const proformaItems: ProformaItem[] = validItems.map(item => ({
      description: item.description,
      quantity: parseFloat(item.quantity) || 0,
      unit: item.unit,
      rate: parseFloat(item.rate) || 0,
      amount: calculateProformaItemAmount(parseFloat(item.quantity) || 0, parseFloat(item.rate) || 0),
    }));

    const payload = {
      proforma_number: proformaNumber,
      date: proformaDate,
      due_date: dueDate || null,
      client_id: !useManualClient && selectedClient ? selectedClient.id : null,
      client_name_override: useManualClient ? clientNameOverride : null,
      sub_brand: subBrand,
      company,
      quotation_id: linkedQuotationId || null,
      project_id: linkedProjectId || null,
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
      discount_type: discountType,
      discount_value: parsedDiscountValue,
      discount_amount: discountAmount,
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
    } catch (e: unknown) {
      const message = e instanceof Error
        ? e.message
        : typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string'
          ? e.message
          : `Failed to ${isEditing ? 'update' : 'create'} proforma`;
      setError(message);
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
        ? { name: clientNameOverride, email: clientEmailOverride || null, phone: null, address: '', state: '', gstin: null }
        : null;
      const proformaForPDF = { ...savedProforma, client: clientForPDF };
      await downloadPDFFile(
        <ProformaPDF proforma={proformaForPDF} businessSettings={settings} template="modern" />,
        `Proforma-${savedProforma.proforma_number}.pdf`,
        <ProformaPDF proforma={proformaForPDF} businessSettings={settings} template="legacy" />,
      );
    } finally {
      setDownloading(false);
    }
  }

  async function handlePreviewPDF() {
    setError('');
    if (!settings) { setError('Business settings are still loading.'); return; }
    if (!useManualClient && !selectedClient) { setError('Select a client before previewing the PDF.'); return; }
    if (useManualClient && !clientNameOverride.trim()) { setError('Client name is required.'); return; }
    if (discountError) { setError(discountError); return; }
    const validItems = items.filter(item => item.description.trim());
    if (validItems.length === 0) { setError('Add at least one line item before previewing the PDF.'); return; }

    const previewClient = selectedClient || (useManualClient ? {
      id: 'preview-client', name: clientNameOverride.trim(), email: clientEmailOverride.trim() || null,
      phone: null, address: '', state: '', state_code: '', gstin: null, created_at: '',
    } : null);
    const preview: ProformaInvoice = {
      id: 'preview', proforma_number: proformaNumber || 'DRAFT', date: proformaDate || null,
      due_date: dueDate || null, client_id: selectedClient?.id || null,
      client_name_override: useManualClient ? clientNameOverride.trim() : null,
      client: previewClient, sub_brand: subBrand, company, quotation_id: linkedQuotationId,
      project_id: linkedProjectId, quotation: selectedQuotation ? {
        quotation_number: selectedQuotation.quotation_number, title: selectedQuotation.title,
        status: selectedQuotation.status, total_amount: selectedQuotation.total_amount,
      } : null,
      items: validItems.map(item => ({
        description: item.description.trim(), quantity: parseFloat(item.quantity) || 0,
        unit: item.unit || 'Nos', rate: parseFloat(item.rate) || 0,
        amount: calculateProformaItemAmount(parseFloat(item.quantity) || 0, parseFloat(item.rate) || 0),
      })),
      taxable_value: taxableValue, include_gst: includeGst, gst_rate: gstRate,
      cgst_amount: cgstAmount, sgst_amount: sgstAmount, igst_amount: igstAmount,
      is_igst: isIGST, total_amount: totalAmount, discount_type: discountType,
      discount_value: parsedDiscountValue, discount_amount: discountAmount,
      notes: notes.trim() || null, payment_status: 'pending', status: 'draft',
      created_at: new Date().toISOString(), created_by: user?.id || '',
    };

    setDownloading(true);
    try {
      await downloadPDFFile(
        <ProformaPDF proforma={preview} businessSettings={settings} template="modern" />,
        `Proforma-${preview.proforma_number || 'Preview'}.pdf`,
        <ProformaPDF proforma={preview} businessSettings={settings} template="legacy" />,
      );
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
            <div className="space-y-3">
              <ClientSelector
                clients={clients}
                selected={selectedClient}
                onSelect={c => {
                  setSelectedClient(c);
                  if (c.state_code) setPlaceOfSupplyCode(c.state_code);
                }}
                onClear={() => setSelectedClient(null)}
                onCreateClient={createClient}
              />
              {selectedClient && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-500 px-1">
                  <span>{selectedClient.email || 'No email provided'}</span>
                  <span>{selectedClient.state || 'State not provided'}</span>
                  <span className="sm:text-right">{subBrand}</span>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ── Linked Document ── */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Linked Quotation <span className="text-gray-400 font-normal">(optional)</span></h3>
          <select
            value={linkedQuotationId || ''}
            onChange={e => {
              const quotationId = e.target.value || null;
              setLinkedQuotationId(quotationId);
              setLinkedProjectId(quotationOptions.find((quotation) => quotation.id === quotationId)?.project_id || null);
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— None —</option>
            {quotationOptions.map(q => (
              <option key={q.id} value={q.id}>
                {q.quotation_number} — {q.title}
              </option>
            ))}
          </select>
          {selectedQuotation && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <div><p className="text-xs text-gray-400">Quotation</p><p className="font-semibold text-gray-800">{selectedQuotation.quotation_number}</p></div>
              <div><p className="text-xs text-gray-400">Client</p><p className="font-medium text-gray-700">{selectedQuotation.client?.name || 'Not linked'}</p></div>
              <div><p className="text-xs text-gray-400">Project</p><p className="font-medium text-gray-700 truncate">{selectedQuotation.title || 'Untitled'}</p></div>
              <div className="sm:text-right"><p className="text-xs text-gray-400">Total / status</p><p className="font-semibold text-gray-800">{formatCurrency(selectedQuotation.total_amount)} · {selectedQuotation.status}</p></div>
            </div>
          )}
        </Card>

        {/* ── Line Items ── */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Line Items</h3>
          <div className="space-y-3 md:hidden">
            {items.map((item, i) => {
              const amount = calculateProformaItemAmount(
                Math.max(parseFloat(item.quantity) || 0, 0),
                Math.max(parseFloat(item.rate) || 0, 0),
              );
              return (
                <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">ITEM {i + 1}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="p-1 text-gray-400 hover:text-red-500" aria-label={`Remove item ${i + 1}`}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Description of service/product" />
                  <div className="grid grid-cols-3 gap-2">
                    <input className="min-w-0 w-full border border-gray-200 rounded px-2 py-2 text-sm text-right" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} type="number" min="0" aria-label="Quantity" />
                    <input className="min-w-0 w-full border border-gray-200 rounded px-2 py-2 text-sm" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} placeholder="Unit" aria-label="Unit" />
                    <input className="min-w-0 w-full border border-gray-200 rounded px-2 py-2 text-sm text-right" value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} type="number" min="0" placeholder="Rate" aria-label="Rate" />
                  </div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Amount</span><span className="font-semibold text-gray-900">{formatCurrency(amount)}</span></div>
                </div>
              );
            })}
          </div>
          <div className="hidden md:block overflow-x-auto">
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
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-6 items-start">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Discount</label>
              <div className="flex max-w-sm">
                <Input
                  type="number"
                  min="0"
                  max={discountType === 'percent' ? 100 : undefined}
                  step="0.01"
                  value={discountValue}
                  onChange={event => setDiscountValue(event.target.value)}
                  placeholder="0"
                  className="rounded-r-none"
                />
                <select
                  value={discountType}
                  onChange={event => setDiscountType(event.target.value as 'flat' | 'percent')}
                  className="w-24 border border-l-0 border-gray-300 rounded-r-lg px-3 text-sm font-semibold bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Discount type"
                >
                  <option value="percent">%</option>
                  <option value="flat">₹</option>
                </select>
              </div>
              {discountError ? <p className="text-xs text-red-600 mt-1.5">{discountError}</p> : <p className="text-xs text-gray-400 mt-1.5">Discount is deducted before GST.</p>}
            </div>
            <div className="space-y-2 text-sm rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{discountType === 'percent' ? `Discount (${parsedDiscountValue || 0}%)` : 'Discount'}</span>
                <span className={discountAmount > 0 ? 'font-medium text-red-600' : 'font-medium'}>{discountAmount > 0 ? '-' : ''}{formatCurrency(discountAmount)}</span>
              </div>
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
            <div className="flex justify-between border-t border-gray-300 pt-3 text-lg font-bold text-gray-900">
              <span>Total Amount</span>
              <span className="text-red-600">{formatCurrency(totalAmount)}</span>
            </div>
              <p className="pt-2 text-xs leading-5 text-gray-500 border-t border-gray-200">{amountToWords(totalAmount)}</p>
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
        <div className="sticky bottom-0 z-10 sm:static flex flex-col-reverse sm:flex-row gap-3 justify-end py-3 sm:pb-8 bg-gray-50/95 backdrop-blur sm:bg-transparent sm:backdrop-blur-none">
          <Button
            variant="secondary"
            onClick={() => navigate('/proforma')}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handlePreviewPDF}
            disabled={saving || downloading}
          >
            <Download size={15} className="mr-1.5" />
            {downloading ? 'Generating…' : 'Preview PDF'}
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
