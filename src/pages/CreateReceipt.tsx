import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { useReceipts, generateReceiptNumber } from '../hooks/useReceipts';
import type { PaymentMode } from '../hooks/useReceipts';
import ReceiptPDF from '../components/receipt/ReceiptPDF';
import { useClients } from '../hooks/useClients';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { useAuth } from '../hooks/useAuth';
import { ClientSelector } from '../components/invoice/ClientSelector';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { formatCurrency, toLocalDateString } from '../utils/formatters';
import { sendReceiptEmail } from '../utils/sendReceiptEmail';
import { supabase } from '../lib/supabase';

// ── Constants ──────────────────────────────────────────────────────────────────

const PAYMENT_MODES: PaymentMode[] = ['cash', 'bank', 'upi', 'card', 'razorpay', 'cheque'];

const MODE_LABELS: Record<PaymentMode, string> = {
  cash: 'Cash', bank: 'Bank', upi: 'UPI', card: 'Card', razorpay: 'Razorpay', cheque: 'Cheque',
};

const SUB_BRANDS = ['Ritera Publishing', 'Ratixinfo Tech'];

const DEFAULT_NOTES = 'Thank you for your payment. We look forward to serving you.';

// ── Component ──────────────────────────────────────────────────────────────────

export function CreateReceipt() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(params.id);

  const prefillProformaId = searchParams.get('proforma_id');
  const prefillInvoiceId = searchParams.get('invoice_id');
  const prefillAmount = searchParams.get('amount');
  const prefillTowards = searchParams.get('towards');

  const { user } = useAuth();
  const { createReceipt, updateReceipt } = useReceipts();
  const { clients, createClient } = useClients();
  const { settings } = useBusinessSettings();

  // ── Form State ──
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(toLocalDateString());
  const [subBrand, setSubBrand] = useState('Ritera Publishing');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('bank');
  const [paymentReference, setPaymentReference] = useState('');
  const [towards, setTowards] = useState('');
  const [notes, setNotes] = useState(DEFAULT_NOTES);

  // ── Client ──
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [useManualClient, setUseManualClient] = useState(false);
  const [clientNameOverride, setClientNameOverride] = useState('');

  // ── Email ──
  const [clientEmail, setClientEmail] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; email: string; error?: string } | null>(null);

  // ── Linked ──
  const [linkedProformaId, setLinkedProformaId] = useState<string | null>(null);
  const [linkedInvoiceId, setLinkedInvoiceId] = useState<string | null>(null);

  // ── UI State ──
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(isEditing);
  const [savedReceipt, setSavedReceipt] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

  // ── Generate receipt number ──
  useEffect(() => {
    if (!isEditing) {
      generateReceiptNumber().then(setReceiptNumber).catch(() => {});
    }
  }, [isEditing]);

  // ── Pre-fill from proforma URL param ──
  useEffect(() => {
    if (!prefillProformaId || isEditing) return;

    async function loadProforma() {
      const { data } = await supabase
        .from('proforma_invoices')
        .select('*, client:clients(*)')
        .eq('id', prefillProformaId)
        .single();
      if (!data) return;

      setLinkedProformaId(data.id);
      setSubBrand(data.sub_brand || 'Ritera Publishing');
      setTowards(prefillTowards || `Proforma ${data.proforma_number}`);
      if (prefillAmount) setAmount(prefillAmount);
      else setAmount(String(data.total_amount || ''));

      if (data.client) {
        setSelectedClient(data.client);
        setUseManualClient(false);
        if (data.client.email) setClientEmail(data.client.email);
      } else if (data.client_name_override) {
        setUseManualClient(true);
        setClientNameOverride(data.client_name_override || '');
      }
    }

    loadProforma();
  }, [prefillProformaId, isEditing, prefillAmount, prefillTowards]);

  // ── Pre-fill from invoice URL param ──
  useEffect(() => {
    if (!prefillInvoiceId || isEditing) return;

    async function loadInvoice() {
      const { data } = await supabase
        .from('invoices')
        .select('*, client:clients(*)')
        .eq('id', prefillInvoiceId)
        .single();
      if (!data) return;

      setLinkedInvoiceId(data.id);
      setSubBrand(data.sub_brand || 'Ritera Publishing');
      setTowards(prefillTowards || `Invoice ${data.invoice_number}`);
      if (prefillAmount) setAmount(prefillAmount);
      else setAmount(String(data.total_amount || ''));

      if (data.client) {
        setSelectedClient(data.client);
        setUseManualClient(false);
        if (data.client.email) setClientEmail(data.client.email);
      } else if (data.client_name_override) {
        setUseManualClient(true);
        setClientNameOverride(data.client_name_override || '');
      }
    }

    loadInvoice();
  }, [prefillInvoiceId, isEditing, prefillAmount, prefillTowards]);

  // ── Load existing receipt for edit ──
  useEffect(() => {
    if (!isEditing || !params.id) return;

    async function loadReceipt() {
      setLoadingEdit(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('payment_receipts')
          .select('*, client:clients(*)')
          .eq('id', params.id)
          .single();
        if (fetchError) throw fetchError;
        if (!data) return;

        setReceiptNumber(data.receipt_number);
        setPaymentDate(data.date);
        setSubBrand(data.sub_brand);
        setAmount(String(data.amount_received));
        setPaymentMode(data.payment_mode);
        setPaymentReference(data.payment_reference || '');
        setTowards(data.towards || '');
        setNotes(data.notes || DEFAULT_NOTES);
        setLinkedProformaId(data.proforma_id || null);
        setLinkedInvoiceId(data.invoice_id || null);
        if (data.client_email) setClientEmail(data.client_email);

        if (data.client) {
          setSelectedClient(data.client);
          setUseManualClient(false);
        } else if (data.client_name_override) {
          setUseManualClient(true);
          setClientNameOverride(data.client_name_override || '');
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load receipt');
      } finally {
        setLoadingEdit(false);
      }
    }

    loadReceipt();
  }, [isEditing, params.id]);

  // ── Client selection with email auto-fill ──────────────────────────────────

  function handleClientSelect(c: any) {
    setSelectedClient(c);
    if (c?.email && !clientEmail) setClientEmail(c.email);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    setError('');
    if (!receiptNumber.trim()) { setError('Receipt number is required.'); return; }
    if (!useManualClient && !selectedClient) {
      setError('Please select a client or enter client name manually.');
      return;
    }
    if (useManualClient && !clientNameOverride.trim()) { setError('Client name is required.'); return; }
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    const payload = {
      receipt_number: receiptNumber,
      date: paymentDate,
      client_id: !useManualClient && selectedClient ? selectedClient.id : null,
      client_name_override: useManualClient ? clientNameOverride : null,
      sub_brand: subBrand,
      amount_received: amountNum,
      payment_mode: paymentMode,
      payment_reference: paymentReference.trim() || null,
      towards: towards.trim() || null,
      proforma_id: linkedProformaId || null,
      invoice_id: linkedInvoiceId || null,
      notes: notes.trim() || null,
      created_by: user?.id || '',
      client_email: clientEmail.trim() || null,
    };

    setSaving(true);
    try {
      if (isEditing && params.id) {
        await updateReceipt(params.id, payload);
        navigate('/receipts');
      } else {
        const created = await createReceipt(payload);

        if (sendEmail && clientEmail.trim()) {
          const clientName = selectedClient?.name || clientNameOverride || 'Client';
          const result = await sendReceiptEmail(created, clientEmail.trim(), clientName);
          setEmailStatus({ sent: result.success, email: clientEmail.trim(), error: result.error });
        }

        setSavedReceipt(created);
      }
    } catch (e: any) {
      setError(e.message || `Failed to ${isEditing ? 'update' : 'create'} receipt`);
    } finally {
      setSaving(false);
    }
  }

  // ── Post-save PDF download ─────────────────────────────────────────────────

  async function handleDownloadPDF() {
    if (!savedReceipt || !settings) return;
    setDownloading(true);
    try {
      const clientForPDF = selectedClient
        ? { ...selectedClient }
        : useManualClient && clientNameOverride
        ? { name: clientNameOverride, email: null, address: null }
        : null;
      const blob = await pdf(
        <ReceiptPDF receipt={{ ...savedReceipt, client: clientForPDF }} client={clientForPDF} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt-${savedReceipt.receipt_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  // ── Post-save success screen ───────────────────────────────────────────────

  if (savedReceipt) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar title="New Payment Receipt" />
        <div className="max-w-lg mx-auto mt-20 text-center px-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Receipt Created!</h2>
          <p className="text-gray-500 mb-2">{savedReceipt.receipt_number}</p>
          <p className="text-gray-900 font-semibold text-xl mb-6">{formatCurrency(savedReceipt.amount_received)}</p>

          {/* Email status badge */}
          {emailStatus && (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm mb-6 border ${
              emailStatus.sent
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {emailStatus.sent
                ? <CheckCircle size={15} />
                : <AlertCircle size={15} />}
              {emailStatus.sent
                ? `Receipt emailed to ${emailStatus.email}`
                : `Email failed: ${emailStatus.error}`}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={handleDownloadPDF} disabled={downloading} variant="secondary">
              <Download size={16} className="mr-2" />
              {downloading ? 'Generating PDF…' : 'Download PDF'}
            </Button>
            <Button onClick={() => navigate('/receipts/new')}>Create Another</Button>
            <Button variant="secondary" onClick={() => navigate('/receipts')}>View All Receipts</Button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingEdit) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar title="Edit Receipt" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title={isEditing ? 'Edit Receipt' : 'New Payment Receipt'} />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Back link */}
        <button
          onClick={() => navigate('/receipts')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={16} /> Back to Receipts
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* ── Receipt Details ── */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Receipt Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Receipt Number</label>
              <Input
                value={receiptNumber}
                onChange={e => setReceiptNumber(e.target.value)}
                placeholder="RCP-2025-0001"
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date</label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
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
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              {useManualClient ? 'Pick from client list' : 'Enter manually'}
            </button>
          </div>

          {useManualClient ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Name</label>
              <Input
                value={clientNameOverride}
                onChange={e => setClientNameOverride(e.target.value)}
                placeholder="Client / company name"
              />
            </div>
          ) : (
            <ClientSelector
              clients={clients}
              selected={selectedClient}
              onSelect={handleClientSelect}
              onClear={() => { setSelectedClient(null); setClientEmail(''); }}
              onCreateClient={createClient}
            />
          )}

          {/* Email field */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <span className="flex items-center gap-1.5">
                <Mail size={12} className="text-gray-400" />
                Client Email <span className="text-gray-400 font-normal">(for receipt delivery)</span>
              </span>
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Send email checkbox — only show if email is entered and not editing */}
          {clientEmail.trim() && !isEditing && (
            <label className="flex items-center gap-2.5 mt-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={e => setSendEmail(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-sm text-gray-700">
                Send receipt to client by email after saving
              </span>
            </label>
          )}
        </Card>

        {/* ── Amount ── */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Amount Received</h3>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">INR</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg pl-14 pr-4 py-3 text-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
            <p className="text-xs text-gray-400 mt-2">{formatCurrency(parseFloat(amount))}</p>
          )}
        </Card>

        {/* ── Payment Mode ── */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment Mode</h3>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_MODES.map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setPaymentMode(mode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  paymentMode === mode
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >
                {MODE_LABELS[mode]}
              </button>
            ))}
          </div>

          {(paymentMode === 'bank' || paymentMode === 'upi' || paymentMode === 'cheque' || paymentMode === 'razorpay' || paymentMode === 'card') && (
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {paymentMode === 'cheque' ? 'Cheque Number' :
                 paymentMode === 'upi' ? 'UPI Transaction ID' :
                 paymentMode === 'razorpay' ? 'Razorpay Order ID' :
                 'Reference / Transaction ID'}
                {' '}<span className="text-gray-400">(optional)</span>
              </label>
              <Input
                value={paymentReference}
                onChange={e => setPaymentReference(e.target.value)}
                placeholder={
                  paymentMode === 'cheque' ? 'e.g. 001234' :
                  paymentMode === 'upi' ? 'e.g. 4567890123456789' :
                  'Transaction reference number'
                }
              />
            </div>
          )}
        </Card>

        {/* ── Towards ── */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Payment Towards <span className="font-normal text-gray-400">(optional)</span>
          </h3>
          <Input
            value={towards}
            onChange={e => setTowards(e.target.value)}
            placeholder="e.g. PRF-2025-0001, advance payment, project name…"
          />
        </Card>

        {/* ── Notes ── */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Notes</h3>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            placeholder="Additional notes…"
          />
        </Card>

        {/* ── Action Buttons ── */}
        <div className="flex gap-3 justify-end pb-8">
          <Button variant="secondary" onClick={() => navigate('/receipts')} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? (sendEmail && clientEmail.trim() ? 'Saving & Sending…' : 'Saving…')
              : isEditing ? 'Update Receipt' : 'Create Receipt'}
          </Button>
        </div>

      </div>
    </div>
  );
}
