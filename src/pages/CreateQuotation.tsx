import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, X, CheckCircle, Download } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { useQuotations, generateQuotationNumber } from '../hooks/useQuotations';
import type { QuotationItem, Quotation } from '../hooks/useQuotations';
import { QuotationPDF } from '../components/quotation/QuotationPDF';
import { useClients } from '../hooks/useClients';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { useAuth } from '../hooks/useAuth';
import { INDIAN_STATES } from '../types';
import { isInterState } from '../utils/gstCalculations';
import { formatCurrency } from '../utils/formatters';
import { ClientSelector } from '../components/invoice/ClientSelector';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { RITERA_PACKAGES, ALL_COMPLEMENTARY } from '../data/riteraPackages';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LineItemRow {
  description: string;
  quantity: string;
  unit: string;
  rate: string;
}

interface PaymentScheduleRow {
  label: string;
  percentage: number;
  milestone: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const defaultItem: LineItemRow = {
  description: '',
  quantity: '1',
  unit: 'Nos',
  rate: '',
};

const DEFAULT_TERMS = `1. This quotation is valid for 15 days from the date of issue.
2. 50% advance payment required before commencement of work.
3. Balance payment due within 7 days of completion.
4. GST will be charged as applicable.`;

const RITERA_DEFAULT_TERMS = `1. This order form is valid for 15 days from the date of issue.
2. 50% advance payment required before commencement of work.
3. Balance payment due within 7 days of project completion.
4. GST will be charged as applicable per government regulations.
5. The publishing timeline begins after receipt of the advance payment and complete manuscript.`;

const RATIXINFO_DEFAULT_TERMS = `1. 50% advance payment required before project commencement.
2. Balance payment due within 7 days of project delivery.
3. Source code and assets handed over after receipt of full payment.
4. 30 days post-launch support included at no additional cost.
5. Any additional features or scope changes will be quoted separately.
6. GST will be charged as applicable per government regulations.`;

const PROJECT_TYPES = [
  'Website Development',
  'Mobile App Development',
  'E-Commerce Solution',
  'UI/UX Design',
  'SEO & Digital Marketing',
  'CRM / ERP Solution',
  'API Integration',
  'Maintenance & Support',
  'Custom Software',
  'Other',
];

const PROJECT_PHASES = [
  'Full Project',
  'Phase 1 only',
  'Phase 1 + 2',
  'Ongoing Retainer',
];

const RATIX_SERVICE_CATEGORIES: Array<{ category: string; services: string[] }> = [
  {
    category: 'WEB & DESIGN',
    services: ['Web Design', 'UI/UX Design', 'Frontend Dev', 'Backend Dev'],
  },
  {
    category: 'MOBILE',
    services: ['Mobile App'],
  },
  {
    category: 'MARKETING',
    services: ['SEO Setup'],
  },
  {
    category: 'TECHNICAL',
    services: ['API Integration', 'QA Testing', 'Maintenance', 'Domain + Hosting'],
  },
];

const GST_RATE_OPTIONS = [0, 5, 12, 18, 28];

// ── Component ──────────────────────────────────────────────────────────────────

export function CreateQuotation() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const isEditing = Boolean(params.id);

  const { user } = useAuth();
  const { createQuotation, updateQuotation } = useQuotations();
  const { clients, createClient } = useClients();
  const { settings } = useBusinessSettings();

  // ── Quotation Details ──
  const [quotationNumber, setQuotationNumber] = useState('');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [subBrand, setSubBrand] = useState('Ritera Publishing');

  // ── Title & Client ──
  const [title, setTitle] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [useManualClient, setUseManualClient] = useState(false);
  const [clientNameOverride, setClientNameOverride] = useState('');
  const [clientEmailOverride, setClientEmailOverride] = useState('');
  const [consultantName, setConsultantName] = useState('');

  // ── Line items (non-Ritera) ──
  const [items, setItems] = useState<LineItemRow[]>([{ ...defaultItem }]);

  // ── Ratixinfo project details ──
  const [projectType, setProjectType] = useState('');
  const [timeline, setTimeline] = useState('');
  const [techStack, setTechStack] = useState('');
  const [projectPhase, setProjectPhase] = useState('');
  const [ratixServices, setRatixServices] = useState<string[]>([]);
  const [ratixCustomService, setRatixCustomService] = useState('');
  const [ratixProjectPrice, setRatixProjectPrice] = useState('');

  // ── Ritera package state ──
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [customPrice, setCustomPrice] = useState('');
  const [selectedComplementary, setSelectedComplementary] = useState<string[]>([]);
  const [excludedServices, setExcludedServices] = useState<string[]>([]);
  const [paidAddons, setPaidAddons] = useState('');
  const [addonsTab, setAddonsTab] = useState<'complementary' | 'paid'>('complementary');

  // ── GST Options ──
  const [includeGst, setIncludeGst] = useState(true);
  const [gstRate, setGstRate] = useState(18);
  const [placeOfSupplyCode, setPlaceOfSupplyCode] = useState('33');

  // ── Discount ──
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('percent');
  const [discountValue, setDiscountValue] = useState('');

  // ── Payment Schedule ──
  const [showPaymentSchedule, setShowPaymentSchedule] = useState(false);
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentScheduleRow[]>([]);

  // ── Notes & Terms ──
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(RITERA_DEFAULT_TERMS);

  // ── UI State ──
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(isEditing);
  const [savedQuotation, setSavedQuotation] = useState<Quotation | null>(null);
  const [downloading, setDownloading] = useState(false);

  // ── Derived ──
  const isRitera = subBrand === 'Ritera Publishing';
  const isRatixinfo = subBrand === 'Ratixinfo Tech';
  const selectedPackage = RITERA_PACKAGES.find(p => p.id === selectedPackageId) || null;
  const isCustomPkg = selectedPackageId === 'custom';

  const subtotal = isRitera
    ? (isCustomPkg ? parseFloat(customPrice) || 0 : selectedPackage?.price || 0)
    : isRatixinfo
    ? parseFloat(ratixProjectPrice) || 0
    : items.reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        return sum + qty * rate;
      }, 0);

  const discountAmt = (() => {
    if (isCustomPkg) return 0; // no discount for custom
    const v = parseFloat(discountValue) || 0;
    if (v <= 0) return 0;
    if (discountType === 'percent') return Math.min((subtotal * v) / 100, subtotal);
    return Math.min(v, subtotal);
  })();

  const taxableValue = subtotal - discountAmt;
  const isIGST = isInterState(placeOfSupplyCode);
  const totalGST = includeGst ? (taxableValue * gstRate) / 100 : 0;
  const cgstAmount = !isIGST && includeGst ? totalGST / 2 : 0;
  const sgstAmount = cgstAmount;
  const igstAmount = isIGST && includeGst ? totalGST : 0;
  const totalAmount = taxableValue + totalGST;
  const scheduleTotalPct = paymentSchedule.reduce((s, r) => s + r.percentage, 0);

  // ── Generate quotation number ──
  useEffect(() => {
    if (!isEditing) {
      generateQuotationNumber().then(setQuotationNumber).catch(() => {});
    }
  }, [isEditing]);

  // ── Fetch existing quotation for edit ──
  useEffect(() => {
    if (!isEditing || !params.id) return;

    async function loadQuotation() {
      setLoadingEdit(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('quotations')
          .select('*, client:clients(*)')
          .eq('id', params.id)
          .single();

        if (fetchError) throw fetchError;
        if (!data) return;

        setQuotationNumber(data.quotation_number);
        setQuotationDate(data.date);
        setValidUntil(data.valid_until || '');
        setSubBrand(data.sub_brand);
        setTitle(data.title);
        setConsultantName(data.consultant_name || '');
        setIncludeGst(data.include_gst);
        setGstRate(data.gst_rate);
        setPlaceOfSupplyCode(data.is_igst ? '07' : '33');
        setTerms(data.terms || (
          data.sub_brand === 'Ritera Publishing' ? RITERA_DEFAULT_TERMS :
          data.sub_brand === 'Ratixinfo Tech' ? RATIXINFO_DEFAULT_TERMS :
          DEFAULT_TERMS
        ));
        setDiscountType((data.discount_type as 'flat' | 'percent') || 'percent');
        setDiscountValue(data.discount_value != null && data.discount_value > 0 ? String(data.discount_value) : '');

        // Restore payment schedule
        if (data.payment_schedule && Array.isArray(data.payment_schedule) && data.payment_schedule.length > 0) {
          setPaymentSchedule(
            (data.payment_schedule as any[]).map(item => ({
              label: item.label || '',
              percentage: item.percentage || 0,
              milestone: item.milestone || '',
            }))
          );
          setShowPaymentSchedule(true);
        }

        // Restore notes / package state from JSON
        if (data.sub_brand === 'Ritera Publishing' && data.notes) {
          try {
            const nd = JSON.parse(data.notes);
            if (nd.packageId) {
              setSelectedPackageId(nd.packageId);
              setSelectedComplementary(nd.complementary || []);
              setExcludedServices(nd.excludedServices || []);
              setPaidAddons((nd.paidAddons || []).join('\n'));
              if (nd.packageId === 'custom') {
                const basePrice = (data.taxable_value || 0) + (data.discount_amount || 0);
                setCustomPrice(String(basePrice > 0 ? basePrice : ''));
              }
              // Don't set notes textarea for Ritera (it stores JSON)
            } else {
              setNotes(data.notes || '');
            }
          } catch {
            setNotes(data.notes || '');
          }
        } else if (data.sub_brand === 'Ratixinfo Tech' && data.notes) {
          try {
            const nd = JSON.parse(data.notes);
            if (nd.type === 'ratixinfo') {
              setProjectType(nd.projectType || '');
              setTimeline(nd.timeline || '');
              setTechStack(nd.techStack || '');
              setProjectPhase(nd.projectPhase || '');
              setNotes(nd.notes || '');
              if (nd.services && typeof nd.services === 'object') {
                const allServices: string[] = (Object.values(nd.services) as string[][]).flat();
                setRatixServices(allServices);
              }
              setRatixCustomService(nd.customService || '');
              setRatixProjectPrice(nd.projectPrice ? String(nd.projectPrice) : '');
            } else {
              setNotes(data.notes || '');
            }
          } catch {
            setNotes(data.notes || '');
          }
        } else {
          setNotes(data.notes || '');
        }

        // Restore items for generic (non-Ritera, non-Ratixinfo) brands
        if (data.sub_brand !== 'Ritera Publishing' && data.sub_brand !== 'Ratixinfo Tech') {
          const restoredItems: LineItemRow[] = (data.items as QuotationItem[]).map(item => ({
            description: item.description,
            quantity: String(item.quantity),
            unit: item.unit,
            rate: String(item.rate),
          }));
          setItems(restoredItems.length > 0 ? restoredItems : [{ ...defaultItem }]);
        }

        // Restore client
        if (data.client) {
          setSelectedClient(data.client);
          setUseManualClient(false);
          if (data.client.state_code) setPlaceOfSupplyCode(data.client.state_code);
        } else if (data.client_name_override) {
          setUseManualClient(true);
          setClientNameOverride(data.client_name_override || '');
          setClientEmailOverride(data.client_email_override || '');
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load quotation');
      } finally {
        setLoadingEdit(false);
      }
    }

    loadQuotation();
  }, [isEditing, params.id]);

  // ── Package selection handler ──
  function handleSelectPackage(pkgId: string) {
    setSelectedPackageId(pkgId);
    setExcludedServices([]);
    const pkg = RITERA_PACKAGES.find(p => p.id === pkgId);
    if (pkgId === 'custom') {
      setDiscountValue('');
      setSelectedComplementary([]);
    } else if (pkg) {
      setTitle(`${pkg.name} Package`);
      setSelectedComplementary(pkg.complementary ? [...pkg.complementary] : []);
    }
    // Default 2-payment 50/50 split
    setPaymentSchedule([
      { label: 'Advance', percentage: 50, milestone: 'On order confirmation' },
      { label: 'Final Payment', percentage: 50, milestone: 'On project completion' },
    ]);
    setShowPaymentSchedule(true);
  }

  function toggleService(name: string) {
    setExcludedServices(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  }

  // ── Sub-brand change handler ──
  function handleSubBrandChange(brand: string) {
    setSubBrand(brand);
    setSelectedPackageId(null);
    setSelectedComplementary([]);
    setPaidAddons('');
    if (!isEditing) {
      if (brand === 'Ritera Publishing') setTerms(RITERA_DEFAULT_TERMS);
      else if (brand === 'Ratixinfo Tech') setTerms(RATIXINFO_DEFAULT_TERMS);
      else setTerms(DEFAULT_TERMS);
    }
  }

  // ── Line item helpers (non-Ritera) ──
  function updateItem(index: number, field: keyof LineItemRow, value: string) {
    setItems(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }
  function addItem() {
    setItems(prev => [...prev, { ...defaultItem }]);
  }
  function removeItem(index: number) {
    if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== index));
  }

  // ── Payment schedule helpers ──
  function applyQuickSplit(n: 1 | 2 | 3 | 'custom') {
    if (n === 1) {
      setPaymentSchedule([{ label: 'Full Payment', percentage: 100, milestone: 'On completion' }]);
    } else if (n === 2) {
      setPaymentSchedule([
        { label: 'Advance', percentage: 50, milestone: 'On order confirmation' },
        { label: 'Final Payment', percentage: 50, milestone: 'On completion' },
      ]);
    } else if (n === 3) {
      setPaymentSchedule([
        { label: 'Advance', percentage: 50, milestone: 'On order confirmation' },
        { label: 'On Delivery', percentage: 25, milestone: 'On delivery' },
        { label: 'Final Payment', percentage: 25, milestone: 'Within 7 days of completion' },
      ]);
    } else {
      setPaymentSchedule([{ label: '', percentage: 0, milestone: '' }]);
    }
  }

  function updateScheduleRow(index: number, field: keyof PaymentScheduleRow, value: string | number) {
    setPaymentSchedule(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!quotationNumber.trim()) { setError('Quotation number is required.'); return; }
    if (!title.trim()) { setError('Title / Subject is required.'); return; }
    if (!useManualClient && !selectedClient) {
      setError('Please select a client or enter client details manually.');
      return;
    }
    if (useManualClient && !clientNameOverride.trim()) { setError('Client name is required.'); return; }

    if (isRitera) {
      if (!selectedPackageId) { setError('Please select a package.'); return; }
      if (isCustomPkg && (!customPrice || parseFloat(customPrice) <= 0)) {
        setError('Please enter a valid custom price.');
        return;
      }
    } else if (isRatixinfo) {
      if (!ratixProjectPrice || parseFloat(ratixProjectPrice) <= 0) {
        setError('Please enter the project investment amount.');
        return;
      }
    } else {
      const validItems = items.filter(i => i.description.trim());
      if (validItems.length === 0) {
        setError('At least one line item with a description is required.');
        return;
      }
    }

    const quotationItems: QuotationItem[] = (isRitera || isRatixinfo)
      ? []
      : items
          .filter(i => i.description.trim())
          .map(item => ({
            description: item.description,
            quantity: parseFloat(item.quantity) || 0,
            unit: item.unit,
            rate: parseFloat(item.rate) || 0,
            amount: (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0),
          }));

    const paymentScheduleWithAmounts = paymentSchedule.map(row => ({
      label: row.label,
      percentage: row.percentage,
      amount: Math.round((row.percentage / 100) * totalAmount * 100) / 100,
      milestone: row.milestone,
    }));

    // Build notes: Ritera → JSON package data, Ratixinfo → JSON project data, others → text
    const notesValue = isRitera
      ? JSON.stringify({
          packageId: selectedPackageId,
          packageName: selectedPackage?.name || 'Custom',
          services: selectedPackage?.services || {},
          complementary: selectedComplementary,
          paidAddons: paidAddons.split('\n').map(l => l.trim()).filter(Boolean),
          excludedServices,
        })
      : isRatixinfo
      ? JSON.stringify({
          type: 'ratixinfo',
          projectType: projectType || undefined,
          timeline: timeline || undefined,
          techStack: techStack || undefined,
          projectPhase: projectPhase || undefined,
          services: RATIX_SERVICE_CATEGORIES.reduce<Record<string, string[]>>((acc, cat) => {
            const matching = ratixServices.filter(s => cat.services.includes(s));
            if (matching.length > 0) acc[cat.category] = matching;
            return acc;
          }, {}),
          customService: ratixCustomService || undefined,
          projectPrice: parseFloat(ratixProjectPrice) || 0,
          notes: notes || undefined,
        })
      : (notes || null);

    const payload = {
      quotation_number: quotationNumber,
      date: quotationDate,
      valid_until: validUntil || null,
      client_id: !useManualClient && selectedClient ? selectedClient.id : null,
      client_name_override: useManualClient ? clientNameOverride : null,
      client_email_override: useManualClient && clientEmailOverride ? clientEmailOverride : null,
      sub_brand: subBrand,
      title,
      consultant_name: consultantName.trim() || null,
      items: quotationItems,
      taxable_value: taxableValue,
      include_gst: includeGst,
      gst_rate: gstRate,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      is_igst: isIGST,
      total_amount: totalAmount,
      discount_type: discountType,
      discount_value: parseFloat(discountValue) || 0,
      discount_amount: discountAmt,
      payment_schedule: paymentScheduleWithAmounts,
      notes: notesValue,
      terms: terms || null,
      status: 'draft' as const,
      converted_invoice_id: null,
      created_by: user?.id || '',
    };

    setSaving(true);
    try {
      if (isEditing && params.id) {
        await updateQuotation(params.id, payload);
        navigate('/quotations');
      } else {
        const created = await createQuotation(payload);
        setSavedQuotation(created);
      }
    } catch (e: any) {
      setError(e.message || `Failed to ${isEditing ? 'update' : 'create'} quotation`);
    } finally {
      setSaving(false);
    }
  }

  // ── Post-save PDF download ─────────────────────────────────────────────────

  async function handleDownloadSavedPDF() {
    if (!savedQuotation || !settings) return;
    setDownloading(true);
    try {
      const clientForPDF = selectedClient
        ? {
            name: selectedClient.name,
            email: selectedClient.email ?? null,
            phone: selectedClient.phone ?? null,
            address: selectedClient.address ?? null,
            state: selectedClient.state ?? null,
            gstin: selectedClient.gstin ?? null,
          }
        : useManualClient && clientNameOverride
        ? {
            name: clientNameOverride,
            email: clientEmailOverride || null,
            phone: null,
            address: null,
            state: null,
            gstin: null,
          }
        : null;
      const blob = await pdf(
        <QuotationPDF quotation={savedQuotation} client={clientForPDF} businessSettings={settings} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const clientName = clientForPDF?.name || '';
      const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '');
      a.download = `OrderForm-${savedQuotation.quotation_number}${safeName ? '-' + safeName : ''}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  // ── Post-save success screen ───────────────────────────────────────────────

  if (savedQuotation) {
    return (
      <div>
        <TopBar title="Quotation Saved" />
        <div className="px-4 md:px-6 py-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Quotation Saved!</h2>
          <p className="text-sm text-gray-500 mb-8">
            {savedQuotation.quotation_number} has been created successfully.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleDownloadSavedPDF} loading={downloading} disabled={!settings}>
              <Download size={16} /> Download Order Form
            </Button>
            <Button variant="outline" onClick={() => navigate('/quotations')}>
              Go to Quotations
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingEdit) {
    return (
      <div>
        <TopBar title="Edit Quotation" />
        <div className="px-4 md:px-6 py-6 text-sm text-gray-500">Loading quotation...</div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <TopBar
        title={isEditing ? 'Edit Quotation' : 'New Quotation'}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/quotations')}>
            <ArrowLeft size={16} /> Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="px-4 md:px-6 py-6 space-y-6 max-w-5xl">

        {/* ── Section 1: Quotation Details ── */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Quotation Details</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Quotation Number"
              value={quotationNumber}
              onChange={e => setQuotationNumber(e.target.value)}
              required
            />
            <Input
              label="Date"
              type="date"
              value={quotationDate}
              onChange={e => setQuotationDate(e.target.value)}
              required
            />
            <Input
              label="Valid Until"
              type="date"
              value={validUntil}
              onChange={e => setValidUntil(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Sub-brand</label>
              <select
                value={subBrand}
                onChange={e => handleSubBrandChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(settings?.sub_brands || ['Ritera Publishing', 'Ratixinfo Tech']).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* ── Section 2: Title & Client ── */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Title & Client</h2>

          <div className="mb-4">
            <Input
              label={isRitera ? 'Order Title' : 'Title / Subject *'}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={isRitera ? 'e.g. Advanced Package' : 'e.g. Website Development Proposal'}
              required
            />
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 block mb-1">
              {isRitera ? 'Author / Client' : 'Client'} {!useManualClient && '*'}
            </label>

            {!useManualClient ? (
              <>
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
                <button
                  type="button"
                  onClick={() => { setUseManualClient(true); setSelectedClient(null); }}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Enter manually instead
                </button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={isRitera ? 'Author Name *' : 'Client Name *'}
                    value={clientNameOverride}
                    onChange={e => setClientNameOverride(e.target.value)}
                    placeholder={isRitera ? 'Author full name' : 'Client or company name'}
                  />
                  <Input
                    label={isRitera ? 'Author Email' : 'Client Email'}
                    type="email"
                    value={clientEmailOverride}
                    onChange={e => setClientEmailOverride(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setUseManualClient(false); setClientNameOverride(''); setClientEmailOverride(''); }}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Search existing clients instead
                </button>
              </>
            )}
          </div>

          <Input
            label="Consultant / Handled By (optional)"
            value={consultantName}
            onChange={e => setConsultantName(e.target.value)}
            placeholder={isRitera ? 'Publishing consultant name' : 'Consultant or team member name'}
          />
        </Card>

        {/* ── Ritera Publishing: Package-based UI ── */}
        {isRitera ? (
          <>
            {/* Section A: Package Selector */}
            <Card>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Select Package</h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
                {RITERA_PACKAGES.map(pkg => (
                  <div
                    key={pkg.id}
                    onClick={() => handleSelectPackage(pkg.id)}
                    className={`relative cursor-pointer rounded-xl border-2 p-3 text-center transition-all select-none
                      ${selectedPackageId === pkg.id
                        ? 'border-[#1a1a2e] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap z-10">
                        Most Popular
                      </span>
                    )}
                    <p className={`text-sm font-bold mt-1 ${selectedPackageId === pkg.id ? 'text-[#1a1a2e]' : 'text-gray-800'}`}>
                      {pkg.name}
                    </p>
                    {pkg.isCustom ? (
                      <p className="text-xs text-gray-400 mt-1">Negotiated</p>
                    ) : (
                      <p className={`text-sm font-bold mt-1 ${selectedPackageId === pkg.id ? 'text-[#1a1a2e]' : 'text-gray-600'}`}>
                        ₹{pkg.price.toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Custom price input */}
              {isCustomPkg && (
                <div className="mt-4 max-w-xs">
                  <Input
                    label="Final negotiated price (₹)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                    placeholder="0"
                  />
                </div>
              )}
            </Card>

            {/* Section B: Included Services (non-custom only) */}
            {selectedPackageId && !isCustomPkg && selectedPackage && (() => {
              const totalServiceCount = Object.values(selectedPackage.services).flat().length;
              const includedCount = totalServiceCount - excludedServices.length;
              return (
                <Card>
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">
                    {selectedPackage.name} Package — What&apos;s Included ({includedCount} of {totalServiceCount} services)
                  </h2>
                  <div className="space-y-4">
                    {Object.entries(selectedPackage.services).map(([category, serviceList]) => (
                      <div key={category}>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                          {category}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {serviceList.map((s, i) => {
                            const excluded = excludedServices.includes(s);
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => toggleService(s)}
                                style={excluded
                                  ? { backgroundColor: '#f5f5f5', borderColor: '#e0e0e0', color: '#999999', opacity: 0.7 }
                                  : { backgroundColor: '#f0fdf4', borderColor: '#86efac', color: '#166534' }
                                }
                                className="text-xs border px-2.5 py-1 rounded-full flex items-center gap-1 transition-all"
                              >
                                {excluded ? (
                                  <><span style={{ textDecoration: 'line-through' }}>{s}</span><span className="text-base leading-none">+</span></>
                                ) : (
                                  <>{s}<span className="text-base leading-none">✕</span></>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', marginTop: 10 }}>
                    Click any service to remove it from this order form. Click again to restore.
                  </p>
                </Card>
              );
            })()}

            {/* Section C: Complimentary Add-ons (non-custom only) */}
            {selectedPackageId && !isCustomPkg && (
              <Card>
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-gray-700">Complimentary Add-ons</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Tick what applies for this client</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-0 border-b border-gray-200 mb-4">
                  <button
                    type="button"
                    onClick={() => setAddonsTab('complementary')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px
                      ${addonsTab === 'complementary'
                        ? 'border-[#1a1a2e] text-[#1a1a2e]'
                        : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    Complimentary
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddonsTab('paid')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px
                      ${addonsTab === 'paid'
                        ? 'border-[#1a1a2e] text-[#1a1a2e]'
                        : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    Paid Add-ons
                  </button>
                </div>

                {addonsTab === 'complementary' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {ALL_COMPLEMENTARY.map(item => (
                      <label key={item} className="flex items-center gap-2.5 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={selectedComplementary.includes(item)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedComplementary(prev => [...prev, item]);
                            } else {
                              setSelectedComplementary(prev => prev.filter(x => x !== item));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{item}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Additional paid services (one per line)
                    </label>
                    <textarea
                      value={paidAddons}
                      onChange={e => setPaidAddons(e.target.value)}
                      rows={4}
                      placeholder={'e.g. Copy Editing\nAuthor Website – ₹3,500'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                )}
              </Card>
            )}

            {/* Section D: Pricing Summary */}
            <Card>
              <h2 className="text-sm font-semibold text-gray-700 mb-5">Pricing Summary</h2>

              <div className="flex justify-end">
                <div className="w-full sm:w-80 space-y-2 text-sm">

                  {isCustomPkg ? (
                    /* Custom: just show the entered price */
                    <div className="flex justify-between font-bold text-base">
                      <span className="text-[#1a1a2e]">Final Investment</span>
                      <span className="text-red-600">{formatCurrency(totalAmount)}</span>
                    </div>
                  ) : (
                    <>
                      {/* Package Price */}
                      <div className="flex justify-between text-gray-600">
                        <span>Package Price</span>
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                      </div>

                      {/* Discount */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-600 shrink-0">Discount</span>
                        <div className="flex items-center gap-1.5">
                          <div className="flex rounded border border-gray-200 text-xs overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setDiscountType('percent')}
                              className={`px-2 py-1 transition-colors ${discountType === 'percent' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                              %
                            </button>
                            <button
                              type="button"
                              onClick={() => setDiscountType('flat')}
                              className={`px-2 py-1 transition-colors border-l border-gray-200 ${discountType === 'flat' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                              ₹
                            </button>
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={discountValue}
                            onChange={e => setDiscountValue(e.target.value)}
                            placeholder="0"
                            className="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <span className={`text-sm font-medium min-w-[5rem] text-right ${discountAmt > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {discountAmt > 0 ? `-${formatCurrency(discountAmt)}` : '—'}
                          </span>
                        </div>
                      </div>

                      {/* After-discount line */}
                      {discountAmt > 0 && (
                        <div className="flex justify-between text-gray-700 border-t border-dashed border-gray-200 pt-2">
                          <span>After Discount</span>
                          <span className="font-medium">{formatCurrency(taxableValue)}</span>
                        </div>
                      )}

                      {/* Final Investment */}
                      <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2">
                        <span className="text-[#1a1a2e]">Final Investment</span>
                        <span className="text-red-600">{formatCurrency(totalAmount)}</span>
                      </div>
                    </>
                  )}

                  {/* GST options */}
                  <div className="border-t border-gray-100 pt-3 mt-1">
                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                      <input
                        type="checkbox"
                        checked={includeGst}
                        onChange={e => setIncludeGst(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Include GST in this order form?</span>
                    </label>

                    {includeGst && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">GST Rate</label>
                            <select
                              value={gstRate}
                              onChange={e => setGstRate(Number(e.target.value))}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {GST_RATE_OPTIONS.map(r => (
                                <option key={r} value={r}>{r}%</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Place of Supply</label>
                            <select
                              value={placeOfSupplyCode}
                              onChange={e => setPlaceOfSupplyCode(e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {INDIAN_STATES.map(s => (
                                <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">
                          {isIGST ? 'Inter-state — IGST applies' : 'Intra-state — CGST + SGST applies'}
                        </p>
                        {!isIGST ? (
                          <>
                            <div className="flex justify-between text-gray-600 text-xs">
                              <span>CGST ({gstRate / 2}%)</span>
                              <span>{formatCurrency(cgstAmount)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600 text-xs">
                              <span>SGST ({gstRate / 2}%)</span>
                              <span>{formatCurrency(sgstAmount)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between text-gray-600 text-xs">
                            <span>IGST ({gstRate}%)</span>
                            <span>{formatCurrency(igstAmount)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Section E: Payment Schedule */}
            <Card>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-gray-700">Payment Schedule</h2>
              </div>

              {!showPaymentSchedule ? (
                <button
                  type="button"
                  onClick={() => { applyQuickSplit(2); setShowPaymentSchedule(true); }}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
                >
                  <Plus size={14} /> Add Payment Schedule
                </button>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3 mt-2">
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="text-xs text-gray-500">Quick split:</span>
                      {([1, 2, 3] as const).map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => applyQuickSplit(n)}
                          className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                        >
                          {n} payment{n > 1 ? 's' : ''}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => applyQuickSplit('custom')}
                        className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                      >
                        Custom
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowPaymentSchedule(false); setPaymentSchedule([]); }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Remove
                    </button>
                  </div>

                  {paymentSchedule.length > 0 && (
                    <div className="space-y-2 mb-3">
                      <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                        <div className="col-span-3">Label</div>
                        <div className="col-span-2">%</div>
                        <div className="col-span-3">Amount</div>
                        <div className="col-span-3">Milestone / Due</div>
                        <div className="col-span-1"></div>
                      </div>
                      {paymentSchedule.map((row, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-12 sm:col-span-3">
                            <input
                              value={row.label}
                              onChange={e => updateScheduleRow(i, 'label', e.target.value)}
                              placeholder="e.g. Advance"
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={row.percentage}
                              onChange={e => updateScheduleRow(i, 'percentage', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-3">
                            <input
                              readOnly
                              value={formatCurrency((row.percentage / 100) * totalAmount)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm bg-gray-50 text-gray-700"
                            />
                          </div>
                          <div className="col-span-3 sm:col-span-3">
                            <input
                              value={row.milestone}
                              onChange={e => updateScheduleRow(i, 'milestone', e.target.value)}
                              placeholder="e.g. On confirmation"
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() => setPaymentSchedule(prev => prev.filter((_, j) => j !== i))}
                              className="p-1 text-red-400 hover:text-red-600 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setPaymentSchedule(prev => [...prev, { label: '', percentage: 0, milestone: '' }])}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus size={12} /> Add row
                  </button>

                  {paymentSchedule.length > 0 && (
                    scheduleTotalPct === 100
                      ? <p className="text-xs text-green-600 font-medium mt-2">✓ 100% covered</p>
                      : <p className="text-xs text-amber-600 font-medium mt-2">⚠ Percentages add up to {scheduleTotalPct}% (must be 100%)</p>
                  )}
                </div>
              )}
            </Card>
          </>
        ) : (
          /* ── Non-Ritera (Ratixinfo or generic) ── */
          <>
            {/* ── Ratixinfo: Section A — Project Details ── */}
            {isRatixinfo && (
              <Card>
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Project Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Project Type</label>
                    <select
                      value={projectType}
                      onChange={e => setProjectType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select type...</option>
                      {PROJECT_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Timeline"
                    value={timeline}
                    onChange={e => setTimeline(e.target.value)}
                    placeholder="e.g. 4 weeks, 2 months"
                  />
                  <Input
                    label="Tech Stack (optional)"
                    value={techStack}
                    onChange={e => setTechStack(e.target.value)}
                    placeholder="e.g. React, Node.js, PostgreSQL"
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Project Phase (optional)</label>
                    <select
                      value={projectPhase}
                      onChange={e => setProjectPhase(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select phase...</option>
                      {PROJECT_PHASES.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </Card>
            )}

            {/* ── Ratixinfo: Section B — Deliverable Services ── */}
            {isRatixinfo && (
              <Card>
                <h2 className="text-sm font-semibold text-gray-700 mb-1">Deliverable Services</h2>
                <p className="text-xs text-gray-400 mb-4">Click to select services. Selected services appear as pills you can remove.</p>
                <div className="space-y-4">
                  {RATIX_SERVICE_CATEGORIES.map(cat => (
                    <div key={cat.category}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{cat.category}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.services.map(svc => {
                          const selected = ratixServices.includes(svc);
                          return (
                            <button
                              key={svc}
                              type="button"
                              onClick={() => setRatixServices(prev =>
                                selected ? prev.filter(s => s !== svc) : [...prev, svc]
                              )}
                              style={selected
                                ? { backgroundColor: '#f0fdf4', borderColor: '#86efac', color: '#166534' }
                                : undefined}
                              className={`text-xs border px-2.5 py-1 rounded-full transition-all ${
                                selected
                                  ? 'border-green-300'
                                  : 'border-gray-300 bg-white hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700'
                              }`}
                            >
                              {selected ? `${svc} ✕` : `+ ${svc}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

          {isRatixinfo ? (
            /* ── Ratixinfo: Section C — Investment Card ── */
            <Card>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Project Investment</h2>

              {/* Selected services pills */}
              {ratixServices.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Selected Services</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ratixServices.map(svc => (
                      <span
                        key={svc}
                        style={{ backgroundColor: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}
                        className="text-xs border px-2.5 py-1 rounded-full flex items-center gap-1"
                      >
                        {svc}
                        <button
                          type="button"
                          onClick={() => setRatixServices(prev => prev.filter(s => s !== svc))}
                          className="text-base leading-none hover:text-red-500 transition-colors ml-0.5"
                        >✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom service */}
              <div className="mb-4 max-w-lg">
                <Input
                  label="Additional Deliverable (optional)"
                  value={ratixCustomService}
                  onChange={e => setRatixCustomService(e.target.value)}
                  placeholder="e.g. Admin Dashboard, Custom CRM Module"
                />
              </div>

              {/* Project price */}
              <div className="mb-6 max-w-xs">
                <Input
                  label="Total Project Price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={ratixProjectPrice}
                  onChange={e => setRatixProjectPrice(e.target.value)}
                  placeholder="0"
                />
              </div>

              {/* GST Options */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">GST Options</h3>
                <label className="flex items-center gap-2 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={includeGst}
                    onChange={e => setIncludeGst(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Include GST in this quotation</span>
                </label>
                {includeGst && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-gray-700">GST Rate</label>
                      <select
                        value={gstRate}
                        onChange={e => setGstRate(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {GST_RATE_OPTIONS.map(r => (
                          <option key={r} value={r}>{r}%</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-gray-700">Place of Supply</label>
                      <select
                        value={placeOfSupplyCode}
                        onChange={e => setPlaceOfSupplyCode(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {INDIAN_STATES.map(st => (
                          <option key={st.code} value={st.code}>{st.name} ({st.code})</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500">
                        {isIGST ? 'Inter-state — IGST applies' : 'Intra-state — CGST + SGST applies'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Totals Summary */}
              <div className="border-t border-gray-200 pt-4 flex justify-end">
                <div className="w-full sm:w-80 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Project Investment</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-600 shrink-0">Discount</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex rounded border border-gray-200 text-xs overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setDiscountType('percent')}
                          className={`px-2 py-1 transition-colors ${discountType === 'percent' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                        >%</button>
                        <button
                          type="button"
                          onClick={() => setDiscountType('flat')}
                          className={`px-2 py-1 transition-colors border-l border-gray-200 ${discountType === 'flat' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                        >₹</button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discountValue}
                        onChange={e => setDiscountValue(e.target.value)}
                        placeholder="0"
                        className="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className={`text-sm font-medium min-w-[5rem] text-right ${discountAmt > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {discountAmt > 0 ? `-${formatCurrency(discountAmt)}` : '—'}
                      </span>
                    </div>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between text-gray-700 border-t border-dashed border-gray-200 pt-2">
                      <span>Taxable Value</span>
                      <span className="font-medium">{formatCurrency(taxableValue)}</span>
                    </div>
                  )}
                  {includeGst && (
                    <>
                      {!isIGST ? (
                        <>
                          <div className="flex justify-between text-gray-600">
                            <span>CGST ({gstRate / 2}%)</span>
                            <span>{formatCurrency(cgstAmount)}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>SGST ({gstRate / 2}%)</span>
                            <span>{formatCurrency(sgstAmount)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-gray-600">
                          <span>IGST ({gstRate}%)</span>
                          <span>{formatCurrency(igstAmount)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2">
                    <span>Final Investment</span>
                    <span className="text-blue-700">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Schedule */}
              <div className="border-t border-gray-100 pt-5 mt-5">
                {!showPaymentSchedule ? (
                  <button
                    type="button"
                    onClick={() => setShowPaymentSchedule(true)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus size={14} /> Add Payment Schedule
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700">Payment Schedule</h3>
                      <button
                        type="button"
                        onClick={() => { setShowPaymentSchedule(false); setPaymentSchedule([]); }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >Remove</button>
                    </div>
                    <div className="flex gap-2 mb-4 flex-wrap items-center">
                      <span className="text-xs text-gray-500">Quick split:</span>
                      {([1, 2, 3] as const).map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => applyQuickSplit(n)}
                          className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                        >{n} payment{n > 1 ? 's' : ''}</button>
                      ))}
                      <button
                        type="button"
                        onClick={() => applyQuickSplit('custom')}
                        className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                      >Custom</button>
                    </div>
                    {paymentSchedule.length > 0 && (
                      <div className="space-y-2 mb-3">
                        <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                          <div className="col-span-3">Label</div>
                          <div className="col-span-2">%</div>
                          <div className="col-span-3">Amount</div>
                          <div className="col-span-3">Milestone / Due</div>
                          <div className="col-span-1"></div>
                        </div>
                        {paymentSchedule.map((row, i) => (
                          <div key={i} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-12 sm:col-span-3">
                              <input
                                value={row.label}
                                onChange={e => updateScheduleRow(i, 'label', e.target.value)}
                                placeholder="e.g. Advance"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={row.percentage}
                                onChange={e => updateScheduleRow(i, 'percentage', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div className="col-span-4 sm:col-span-3">
                              <input
                                readOnly
                                value={formatCurrency((row.percentage / 100) * totalAmount)}
                                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm bg-gray-50 text-gray-700"
                              />
                            </div>
                            <div className="col-span-3 sm:col-span-3">
                              <input
                                value={row.milestone}
                                onChange={e => updateScheduleRow(i, 'milestone', e.target.value)}
                                placeholder="e.g. On confirmation"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div className="col-span-1 flex justify-center">
                              <button
                                type="button"
                                onClick={() => setPaymentSchedule(prev => prev.filter((_, j) => j !== i))}
                                className="p-1 text-red-400 hover:text-red-600 transition-colors"
                              ><X size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setPaymentSchedule(prev => [...prev, { label: '', percentage: 0, milestone: '' }])}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                    ><Plus size={12} /> Add row</button>
                    {paymentSchedule.length > 0 && (
                      scheduleTotalPct === 100
                        ? <p className="text-xs text-green-600 font-medium mt-2">✓ 100% covered</p>
                        : <p className="text-xs text-amber-600 font-medium mt-2">⚠ Percentages add up to {scheduleTotalPct}% (must be 100%)</p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            /* ── Generic: Line Items Card ── */
            <Card>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Line Items</h2>
              <div className="space-y-3">
                <div className="hidden lg:grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase px-1">
                  <div className="col-span-5">Description</div>
                  <div className="col-span-1">Qty</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-2">Rate (₹)</div>
                  <div className="col-span-2">Amount (₹)</div>
                </div>
                {items.map((item, index) => {
                  const qty = parseFloat(item.quantity) || 0;
                  const rate = parseFloat(item.rate) || 0;
                  const amount = qty * rate;
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-3 lg:border-0 lg:p-0">
                      <div className="grid grid-cols-2 lg:grid-cols-12 gap-2">
                        <div className="col-span-2 lg:col-span-5">
                          <input
                            placeholder="Description *"
                            value={item.description}
                            onChange={e => updateItem(index, 'description', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-1 lg:col-span-1">
                          <input
                            type="number"
                            placeholder="Qty"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={e => updateItem(index, 'quantity', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-1 lg:col-span-2">
                          <input
                            placeholder="Unit"
                            value={item.unit}
                            onChange={e => updateItem(index, 'unit', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-1 lg:col-span-2">
                          <input
                            type="number"
                            placeholder="Rate"
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={e => updateItem(index, 'rate', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-1 lg:col-span-2 flex gap-1">
                          <input
                            readOnly
                            value={formatCurrency(amount)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm bg-gray-50 font-semibold text-gray-900"
                          />
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0"
                            ><Trash2 size={14} /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus size={15} /> Add Line Item
                </Button>
              </div>
              {/* GST Options */}
              <div className="mt-6 border-t border-gray-100 pt-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">GST Options</h3>
                <label className="flex items-center gap-2 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={includeGst}
                    onChange={e => setIncludeGst(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Include GST in this quotation</span>
                </label>
                {includeGst && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-gray-700">GST Rate</label>
                      <select
                        value={gstRate}
                        onChange={e => setGstRate(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {GST_RATE_OPTIONS.map(r => (
                          <option key={r} value={r}>{r}%</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-gray-700">Place of Supply</label>
                      <select
                        value={placeOfSupplyCode}
                        onChange={e => setPlaceOfSupplyCode(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {INDIAN_STATES.map(st => (
                          <option key={st.code} value={st.code}>{st.name} ({st.code})</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500">
                        {isIGST ? 'Inter-state — IGST applies' : 'Intra-state — CGST + SGST applies'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {/* Totals Summary */}
              <div className="border-t border-gray-200 pt-4 flex justify-end">
                <div className="w-full sm:w-80 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-600 shrink-0">Discount</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex rounded border border-gray-200 text-xs overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setDiscountType('percent')}
                          className={`px-2 py-1 transition-colors ${discountType === 'percent' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                        >%</button>
                        <button
                          type="button"
                          onClick={() => setDiscountType('flat')}
                          className={`px-2 py-1 transition-colors border-l border-gray-200 ${discountType === 'flat' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                        >₹</button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discountValue}
                        onChange={e => setDiscountValue(e.target.value)}
                        placeholder="0"
                        className="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className={`text-sm font-medium min-w-[5rem] text-right ${discountAmt > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {discountAmt > 0 ? `-${formatCurrency(discountAmt)}` : '—'}
                      </span>
                    </div>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between text-gray-700 border-t border-dashed border-gray-200 pt-2">
                      <span>Taxable Value</span>
                      <span className="font-medium">{formatCurrency(taxableValue)}</span>
                    </div>
                  )}
                  {includeGst && (
                    <>
                      {!isIGST ? (
                        <>
                          <div className="flex justify-between text-gray-600">
                            <span>CGST ({gstRate / 2}%)</span>
                            <span>{formatCurrency(cgstAmount)}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>SGST ({gstRate / 2}%)</span>
                            <span>{formatCurrency(sgstAmount)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-gray-600">
                          <span>IGST ({gstRate}%)</span>
                          <span>{formatCurrency(igstAmount)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2">
                    <span>Grand Total</span>
                    <span className="text-blue-700">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>
              {/* Payment Schedule */}
              <div className="border-t border-gray-100 pt-5 mt-5">
                {!showPaymentSchedule ? (
                  <button
                    type="button"
                    onClick={() => setShowPaymentSchedule(true)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  ><Plus size={14} /> Add Payment Schedule</button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700">Payment Schedule</h3>
                      <button
                        type="button"
                        onClick={() => { setShowPaymentSchedule(false); setPaymentSchedule([]); }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >Remove</button>
                    </div>
                    <div className="flex gap-2 mb-4 flex-wrap items-center">
                      <span className="text-xs text-gray-500">Quick split:</span>
                      {([1, 2, 3] as const).map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => applyQuickSplit(n)}
                          className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                        >{n} payment{n > 1 ? 's' : ''}</button>
                      ))}
                      <button
                        type="button"
                        onClick={() => applyQuickSplit('custom')}
                        className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                      >Custom</button>
                    </div>
                    {paymentSchedule.length > 0 && (
                      <div className="space-y-2 mb-3">
                        <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                          <div className="col-span-3">Label</div>
                          <div className="col-span-2">%</div>
                          <div className="col-span-3">Amount</div>
                          <div className="col-span-3">Milestone / Due</div>
                          <div className="col-span-1"></div>
                        </div>
                        {paymentSchedule.map((row, i) => (
                          <div key={i} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-12 sm:col-span-3">
                              <input
                                value={row.label}
                                onChange={e => updateScheduleRow(i, 'label', e.target.value)}
                                placeholder="e.g. Advance"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={row.percentage}
                                onChange={e => updateScheduleRow(i, 'percentage', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div className="col-span-4 sm:col-span-3">
                              <input
                                readOnly
                                value={formatCurrency((row.percentage / 100) * totalAmount)}
                                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm bg-gray-50 text-gray-700"
                              />
                            </div>
                            <div className="col-span-3 sm:col-span-3">
                              <input
                                value={row.milestone}
                                onChange={e => updateScheduleRow(i, 'milestone', e.target.value)}
                                placeholder="e.g. On confirmation"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div className="col-span-1 flex justify-center">
                              <button
                                type="button"
                                onClick={() => setPaymentSchedule(prev => prev.filter((_, j) => j !== i))}
                                className="p-1 text-red-400 hover:text-red-600 transition-colors"
                              ><X size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setPaymentSchedule(prev => [...prev, { label: '', percentage: 0, milestone: '' }])}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                    ><Plus size={12} /> Add row</button>
                    {paymentSchedule.length > 0 && (
                      scheduleTotalPct === 100
                        ? <p className="text-xs text-green-600 font-medium mt-2">✓ 100% covered</p>
                        : <p className="text-xs text-amber-600 font-medium mt-2">⚠ Percentages add up to {scheduleTotalPct}% (must be 100%)</p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}
          </>
        )}

        {/* ── Section F: Notes & Terms ── */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            {isRitera ? 'Terms & Conditions' : 'Notes & Terms'}
          </h2>
          <div className="space-y-4">
            {/* Notes: only for non-Ritera */}
            {!isRitera && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Delivery timeline, payment schedule, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Terms & Conditions</label>
              <textarea
                value={terms}
                onChange={e => setTerms(e.target.value)}
                rows={isRitera ? 6 : 5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 pb-8">
          <Button type="submit" size="lg" loading={saving}>
            {isEditing ? 'Update Quotation' : 'Save Quotation'}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => navigate('/quotations')}>
            Cancel
          </Button>
        </div>

      </form>
    </div>
  );
}
