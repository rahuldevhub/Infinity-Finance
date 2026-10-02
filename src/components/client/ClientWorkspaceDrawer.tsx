import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, FileText, Mail, MapPin, Phone, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Client, Invoice, PaymentReceipt, ProformaInvoice, Project } from '../../types';
import type { Quotation } from '../../hooks/useQuotations';
import { usePDFDownload } from '../../hooks/usePDFDownload';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';
import { InvoicePDF } from '../invoice/InvoicePDF';
import { NonGSTInvoicePDF } from '../invoice/NonGSTInvoicePDF';
import { QuotationPDF } from '../quotation/QuotationPDF';
import { ProformaPDF } from '../proforma/ProformaPDF';
import ReceiptPDF from '../receipt/ReceiptPDF';
import { COMPANY_LABELS, type CompanyCode } from '../../domain/company';
import { inferFinancialCompany } from '../../domain/dashboardSourceScope';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { deleteClientFinancialDocument, deleteClientProject, deleteClientRecord } from '../../services/clientCleanup';

type DocumentTab = 'all' | 'invoice' | 'receipt' | 'quotation' | 'proforma';
type DrawerDocument = {
  id: string;
  type: Exclude<DocumentTab, 'all'>;
  number: string;
  date: string;
  status: string;
  amount: number;
  raw: Invoice | PaymentReceipt | Quotation | ProformaInvoice;
};

type DocumentAction = { item: DrawerDocument };

interface ClientLinks {
  projects: Project[];
  invoices: Invoice[];
  receipts: PaymentReceipt[];
  quotations: Quotation[];
  proformas: ProformaInvoice[];
}

const EMPTY_LINKS: ClientLinks = { projects: [], invoices: [], receipts: [], quotations: [], proformas: [] };
const TAB_LABELS: Array<{ id: DocumentTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'invoice', label: 'Invoices' },
  { id: 'receipt', label: 'Payment receipts' },
  { id: 'quotation', label: 'Quotations' },
  { id: 'proforma', label: 'Proforma' },
];

function belongsToWorkspace(row: { company?: CompanyCode | null; sub_brand?: string | null }, workspaceId: string) {
  return workspaceId === 'infinity' || inferFinancialCompany(row) === workspaceId;
}

function linksForWorkspace(links: ClientLinks, workspaceId: string): ClientLinks {
  return {
    projects: links.projects.filter((row) => belongsToWorkspace(row, workspaceId)),
    invoices: links.invoices.filter((row) => belongsToWorkspace(row, workspaceId)),
    receipts: links.receipts.filter((row) => belongsToWorkspace(row, workspaceId)),
    quotations: links.quotations.filter((row) => belongsToWorkspace(row, workspaceId)),
    proformas: links.proformas.filter((row) => belongsToWorkspace(row, workspaceId)),
  };
}

async function loadClientLinks(clientId: string): Promise<ClientLinks> {
  const [projects, invoices, receipts, quotations, proformas] = await Promise.all([
    supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('invoices').select('*').eq('client_id', clientId).order('invoice_date', { ascending: false }),
    supabase.from('payment_receipts').select('*').eq('client_id', clientId).order('date', { ascending: false }),
    supabase.from('quotations').select('*').eq('client_id', clientId).order('date', { ascending: false }),
    supabase.from('proforma_invoices').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
  ]);
  const firstError = projects.error || invoices.error || receipts.error || quotations.error || proformas.error;
  if (firstError) throw new Error(firstError.message || 'Could not load client records.');
  return {
    projects: (projects.data || []) as Project[],
    invoices: (invoices.data || []) as Invoice[],
    receipts: (receipts.data || []) as PaymentReceipt[],
    quotations: (quotations.data || []) as Quotation[],
    proformas: (proformas.data || []) as ProformaInvoice[],
  };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (['paid', 'approved', 'completed', 'converted'].includes(normalized)) return 'bg-emerald-50 text-emerald-700';
  if (['cancelled', 'void', 'voided'].includes(normalized)) return 'bg-red-50 text-red-700';
  return 'bg-amber-50 text-amber-700';
}

function documentMeta(type: DrawerDocument['type']) {
  if (type === 'invoice') return { label: 'Invoice', route: 'invoices' };
  if (type === 'receipt') return { label: 'Receipt', route: 'receipts' };
  if (type === 'quotation') return { label: 'Quotation', route: 'quotations' };
  return { label: 'Proforma', route: 'proforma' };
}

export function ClientWorkspaceDrawer({
  client,
  workspaceId,
  onClose,
  onEdit,
  onDeleted,
}: {
  client: Client | null;
  workspaceId: string;
  onClose: () => void;
  onEdit: (client: Client) => void;
  onDeleted: () => Promise<void> | void;
}) {
  const navigate = useNavigate();
  const { settings } = useBusinessSettings();
  const { downloadPDF, loading: downloading } = usePDFDownload();
  const [links, setLinks] = useState<ClientLinks>(EMPTY_LINKS);
  const [loading, setLoading] = useState(false);
  const [linksReliable, setLinksReliable] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<DocumentTab>('all');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [documentAction, setDocumentAction] = useState<DocumentAction | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [projectAction, setProjectAction] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [toast, setToast] = useState('');
  const documentCenterRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset the route-scoped drawer before its client queries begin.
    setLoading(true);
    setLinksReliable(false);
    setError('');
    setActiveTab('all');
    setShowDelete(false);
    setDocumentAction(null);
    setProjectAction(null);
    void loadClientLinks(client.id).then((loadedLinks) => {
      if (cancelled) return;
      setLinks(loadedLinks);
      setLinksReliable(true);
    }).catch((loadError: unknown) => {
      if (!cancelled) {
        setLinksReliable(false);
        setError(errorMessage(loadError, 'Could not load client records.'));
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [client, onClose]);

  const visible = useMemo(() => linksForWorkspace(links, workspaceId), [links, workspaceId]);

  const documents = useMemo<DrawerDocument[]>(() => [
    ...visible.invoices.map((row) => ({ id: row.id, type: 'invoice' as const, number: row.invoice_number, date: row.invoice_date, status: row.payment_status, amount: Number(row.total_amount), raw: row })),
    ...visible.receipts.map((row) => ({ id: row.id, type: 'receipt' as const, number: row.receipt_number, date: row.date, status: row.is_void ? 'voided' : row.payment_mode, amount: Number(row.amount_received), raw: row })),
    ...visible.quotations.map((row) => ({ id: row.id, type: 'quotation' as const, number: row.quotation_number, date: row.date, status: row.status, amount: Number(row.total_amount), raw: row })),
    ...visible.proformas.map((row) => ({ id: row.id, type: 'proforma' as const, number: row.proforma_number || 'Draft proforma', date: row.date || row.created_at, status: row.status, amount: Number(row.total_amount), raw: row })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [visible]);

  const counts = useMemo(() => documents.reduce<Record<DocumentTab, number>>((result, item) => {
    result.all += 1;
    result[item.type] += 1;
    return result;
  }, { all: 0, invoice: 0, receipt: 0, quotation: 0, proforma: 0 }), [documents]);

  const totalReceipts = visible.receipts.filter((row) => !row.is_void).reduce((sum, row) => sum + Number(row.amount_received || 0), 0);
  const outstanding = visible.invoices.reduce((sum, invoice) => {
    if (invoice.payment_status === 'paid') return sum;
    const received = visible.receipts.filter((receipt) => !receipt.is_void && receipt.invoice_id === invoice.id).reduce((value, receipt) => value + Number(receipt.amount_received || 0), 0);
    return sum + Math.max(0, Number(invoice.total_amount || 0) - received);
  }, 0);
  const filteredDocuments = activeTab === 'all' ? documents : documents.filter((item) => item.type === activeTab);
  const financialBlockers = [
    { label: 'Invoices', count: visible.invoices.length },
    { label: 'Payment receipts', count: visible.receipts.length },
    { label: 'Quotations', count: visible.quotations.length },
    { label: 'Proforma invoices', count: visible.proformas.length },
  ].filter((item) => item.count > 0);
  const projectBlockers = visible.projects;

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  async function downloadDocument(item: DrawerDocument) {
    if (!client) return;
    if (item.type === 'invoice') {
      const invoice = { ...(item.raw as Invoice), client };
      const document = invoice.invoice_type === 'non_gst' ? <NonGSTInvoicePDF invoice={invoice} settings={settings} /> : <InvoicePDF invoice={invoice} settings={settings} />;
      await downloadPDF(document, `${item.number}.pdf`);
    } else if (item.type === 'receipt') {
      await downloadPDF(<ReceiptPDF receipt={{ ...(item.raw as PaymentReceipt), client }} client={client} />, `${item.number}.pdf`);
    } else if (item.type === 'quotation') {
      await downloadPDF(<QuotationPDF quotation={item.raw as Quotation} client={client} businessSettings={settings} />, `${item.number}.pdf`);
    } else {
      const proforma = { ...(item.raw as ProformaInvoice), client };
      await downloadPDF(
        <ProformaPDF proforma={proforma} businessSettings={settings} template="modern" />,
        `${item.number}.pdf`,
        <ProformaPDF proforma={proforma} businessSettings={settings} template="legacy" />,
      );
    }
  }

  async function deleteClient() {
    if (!client || !linksReliable || financialBlockers.length || projectBlockers.length) return;
    setDeleting(true);
    setError('');
    try {
      const latestLinks = await loadClientLinks(client.id);
      const latestVisible = linksForWorkspace(latestLinks, workspaceId);
      setLinks(latestLinks);
      const latestFinancialCount = latestVisible.invoices.length
        + latestVisible.receipts.length
        + latestVisible.quotations.length
        + latestVisible.proformas.length;
      if (latestFinancialCount > 0 || latestVisible.projects.length > 0) {
        const reason = latestFinancialCount > 0
          ? `${latestFinancialCount} linked financial record${latestFinancialCount === 1 ? '' : 's'} still remain.`
          : `${latestVisible.projects.length} linked project${latestVisible.projects.length === 1 ? '' : 's'} still remain. Delete the project first.`;
        setError(`Client was not deleted. ${reason}`);
        return;
      }
      await deleteClientRecord(client.id, workspaceId);
      await onDeleted();
      onClose();
    } catch (deleteError) {
      console.error('Client Workspace client deletion failed', deleteError);
      setError(errorMessage(deleteError, "Couldn't delete this client. No changes were made."));
    } finally {
      setDeleting(false);
    }
  }

  async function applyDocumentAction() {
    if (!documentAction) return;
    const { item } = documentAction;
    setDeletingDocument(true);
    setError('');
    try {
      await deleteClientFinancialDocument(item.type, item.id, workspaceId);
      setLinks((current) => ({
        ...current,
        invoices: item.type === 'invoice' ? current.invoices.filter((row) => row.id !== item.id) : current.invoices,
        receipts: item.type === 'receipt' ? current.receipts.filter((row) => row.id !== item.id) : current.receipts,
        quotations: item.type === 'quotation' ? current.quotations.filter((row) => row.id !== item.id) : current.quotations,
        proformas: item.type === 'proforma' ? current.proformas.filter((row) => row.id !== item.id) : current.proformas,
      }));
      const label = item.type === 'receipt' ? 'Payment receipt' : documentMeta(item.type).label;
      showToast(`${label} deleted`);
      setDocumentAction(null);
    } catch (actionError) {
      console.error('Client Workspace document deletion failed', { type: item.type, id: item.id, error: actionError });
      setError(`Couldn't delete this ${item.type === 'receipt' ? 'payment receipt' : item.type}. No changes were made.`);
    } finally {
      setDeletingDocument(false);
    }
  }

  async function applyProjectDelete() {
    if (!projectAction) return;
    setDeletingProject(true);
    setError('');
    try {
      await deleteClientProject(projectAction.id, workspaceId);
      setLinks((current) => ({ ...current, projects: current.projects.filter((project) => project.id !== projectAction.id) }));
      showToast('Project deleted');
      setProjectAction(null);
    } catch (projectError) {
      console.error('Client Workspace project deletion failed', { id: projectAction.id, error: projectError });
      setError("Couldn't delete this project. No changes were made.");
    } finally {
      setDeletingProject(false);
    }
  }

  if (!client) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={`${client.name} workspace`}>
      <button className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]" onClick={onClose} aria-label="Close client workspace" />
      <aside className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl sm:max-w-[520px] motion-safe:animate-[slideIn_.22s_ease-out]">
        <header className="shrink-0 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
              {client.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-bold text-slate-950">{client.name}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{client.gstin ? 'GST' : 'B2C'}</span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{client.default_company ? COMPANY_LABELS[client.default_company] : 'Legacy client · owner workspace'}</p>
            </div>
            <button onClick={onClose} className="-mr-2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X size={20} /></button>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <span className="flex min-w-0 items-center gap-2"><Mail size={14} className="shrink-0 text-slate-400" /><span className="truncate">{client.email || 'No email'}</span></span>
            <span className="flex items-center gap-2"><Phone size={14} className="shrink-0 text-slate-400" />{client.phone || 'No phone'}</span>
            <span className="flex min-w-0 items-center gap-2 sm:col-span-2"><MapPin size={14} className="shrink-0 text-slate-400" /><span className="truncate">{[client.address, client.state].filter(Boolean).join(', ') || 'No billing address'}</span></span>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => onEdit(client)} className="min-h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Edit details</button>
            <button onClick={() => navigate(`/clients/${client.id}`)} className="min-h-10 flex-1 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800">Open full workspace</button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <section aria-label="Client financial summary" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Projects', visible.projects.length.toString()],
              ['Invoices', visible.invoices.length.toString()],
              ['Receipts', formatCurrency(totalReceipts)],
              ['Outstanding', formatCurrency(outstanding)],
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate text-sm font-bold text-slate-900" title={value}>{value}</p></div>)}
          </section>

          <section ref={documentCenterRef} className="mt-6 scroll-mt-5">
            <div className="flex items-center justify-between">
              <div><h3 className="font-bold text-slate-950">Document center</h3><p className="text-xs text-slate-500">Every financial record linked to this client</p></div>
              <FileText size={18} className="text-slate-400" />
            </div>
            <div className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist">
              {TAB_LABELS.map((tab) => <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{tab.label} <span className={activeTab === tab.id ? 'text-slate-300' : 'text-slate-400'}>{counts[tab.id]}</span></button>)}
            </div>

            <div className="mt-3 space-y-2">
              {loading ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />) : filteredDocuments.length ? filteredDocuments.map((item) => {
                const meta = documentMeta(item.type);
                return <article key={`${item.type}-${item.id}`} className="rounded-xl border border-slate-200 p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100"><FileText size={16} className="text-slate-600" /></div>
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-slate-900">{item.number}</p><span className="text-[11px] font-semibold text-slate-400">{meta.label}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(item.status)}`}>{item.status}</span></div><p className="mt-1 text-xs text-slate-500">{formatDate(item.date)} · {formatCurrency(item.amount)}</p></div>
                  </div>
                  <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                    <button onClick={() => navigate(`/${meta.route}/${item.id}/edit`)} className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink size={13} /> View</button>
                    <button disabled={downloading} onClick={() => void downloadDocument(item)} className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Download size={13} /> Download</button>
                    <button onClick={() => setDocumentAction({ item })} className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 size={13} /> Delete</button>
                  </div>
                </article>;
              }) : <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center"><FileText size={22} className="mx-auto text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-700">No {activeTab === 'all' ? 'documents' : TAB_LABELS.find((tab) => tab.id === activeTab)?.label.toLowerCase()} yet</p><p className="mt-1 text-xs text-slate-500">{activeTab === 'all' ? 'This client has no financial records.' : 'Create one from the matching financial section when this client is ready.'}</p></div>}
            </div>
          </section>

          <section className="mt-6 border-t border-slate-200 pt-5">
            {!showDelete ? <button onClick={() => setShowDelete(true)} className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 size={15} /> Delete client</button>
              : !linksReliable ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-bold text-amber-950">Linked records could not be verified</h3><p className="mt-1 text-sm text-amber-800">Close and reopen this client before trying again. Deletion is disabled to protect existing data.</p><button onClick={() => setShowDelete(false)} className="mt-4 min-h-10 rounded-lg border border-amber-300 px-3 text-sm font-semibold text-amber-900">Close</button></div>
              : financialBlockers.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-bold text-amber-950">Client can’t be deleted yet</h3><p className="mt-1 text-sm text-amber-800">These financial records are linked to this client.</p><ul className="mt-3 space-y-1 text-sm text-amber-900">{financialBlockers.map((item) => <li key={item.label} className="flex justify-between"><span>{item.label}</span><strong>{item.count}</strong></li>)}</ul><div className="mt-4 flex gap-2"><button onClick={() => { setActiveTab('all'); documentCenterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="min-h-10 flex-1 rounded-lg bg-amber-900 px-3 text-sm font-semibold text-white">Review records</button><button onClick={() => setShowDelete(false)} className="min-h-10 rounded-lg border border-amber-300 px-3 text-sm font-semibold text-amber-900">Close</button></div></div>
              : projectBlockers.length ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-bold text-slate-950">Financial records cleared</h3><p className="mt-1 text-sm text-slate-600">No invoices, receipts, quotations or proforma invoices are linked. Remove the {projectBlockers.length === 1 ? 'project' : 'projects'} below to finish deleting the client.</p><div className="mt-3 space-y-2">{projectBlockers.map((project) => <div key={project.id} className="rounded-lg border border-slate-200 bg-white p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{project.name}</p><p className="text-xs capitalize text-slate-500">{project.status}</p></div><div className="mt-3 flex gap-2"><button onClick={() => navigate(`/projects/${project.id}`)} className="min-h-9 flex-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">View project</button><button onClick={() => setProjectAction(project)} className="min-h-9 flex-1 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50">Delete project</button></div></div>)}</div><button onClick={() => setShowDelete(false)} className="mt-4 min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700">Close</button></div>
              : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 className="font-bold text-emerald-950">Ready to delete</h3><p className="mt-1 text-sm text-emerald-800">No invoices, receipts, quotations or proforma invoices are linked to this client.</p><div className="mt-4 flex gap-2"><button disabled={deleting} onClick={() => void deleteClient()} className="min-h-10 flex-1 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white disabled:opacity-50">{deleting ? 'Deleting…' : 'Delete client'}</button><button onClick={() => setShowDelete(false)} className="min-h-10 rounded-lg border border-emerald-300 px-3 text-sm font-semibold text-emerald-900">Cancel</button></div></div>}
          </section>
        </div>
      </aside>
      {documentAction && <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4"><button className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setDocumentAction(null)} aria-label="Cancel document deletion" /><div className="relative w-full rounded-t-2xl bg-white p-6 shadow-2xl sm:max-w-sm sm:rounded-2xl"><h3 className="text-lg font-bold text-slate-950">Delete {documentAction.item.type === 'receipt' ? 'payment receipt' : documentAction.item.type}?</h3><p className="mt-2 text-sm text-slate-600">You are about to permanently delete:</p><div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="text-sm font-bold text-slate-900">{documentAction.item.number}</p><p className="mt-0.5 text-sm text-slate-600">{formatCurrency(documentAction.item.amount)}</p></div><p className="mt-3 text-sm font-medium text-red-700">This action cannot be undone.</p><div className="mt-6 flex justify-end gap-2"><button onClick={() => setDocumentAction(null)} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Cancel</button><button disabled={deletingDocument} onClick={() => void applyDocumentAction()} className="min-h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{deletingDocument ? 'Deleting…' : `Delete ${documentAction.item.type === 'receipt' ? 'receipt' : documentAction.item.type}`}</button></div></div></div>}
      {projectAction && <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4"><button className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setProjectAction(null)} aria-label="Cancel project deletion" /><div className="relative w-full rounded-t-2xl bg-white p-6 shadow-2xl sm:max-w-sm sm:rounded-2xl"><h3 className="text-lg font-bold text-slate-950">Delete project?</h3><p className="mt-2 text-sm text-slate-600">You are about to permanently delete:</p><p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-900">{projectAction.name}</p><p className="mt-3 text-sm font-medium text-red-700">Its timeline and workspace history will also be removed. This cannot be undone.</p><div className="mt-6 flex justify-end gap-2"><button onClick={() => setProjectAction(null)} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Cancel</button><button disabled={deletingProject} onClick={() => void applyProjectDelete()} className="min-h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{deletingProject ? 'Deleting…' : 'Delete project'}</button></div></div></div>}
      {toast && <div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-xl">{toast}</div>}
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } } @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; } }`}</style>
    </div>
  );
}
