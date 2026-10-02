import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CircleDollarSign, Eye, FilePlus2, FolderKanban, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProjects } from '../hooks/useProjects';
import { useProjectPayments } from '../hooks/useProjectPayments';
import type { Project, ProjectStatus } from '../types';
import type { PaymentScheduleDraftItem } from '../services/projectPayments';
import { toMinorUnits } from '../domain/paymentCalculations';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ClientFinancialDocuments, type FinancialDocumentRow } from '../components/project/ClientFinancialDocuments';
import { ProjectPaymentPlan } from '../components/project/ProjectPaymentPlan';
import { ProjectTimeline, type ProjectTimelineEvent } from '../components/project/ProjectTimeline';
import { ProjectExecutionTimeline } from '../components/project/ProjectExecutionTimeline';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  ProjectFinalInvoiceDocument,
  ProjectProformaDocument,
  type WorkspaceInvoice,
  type WorkspaceProforma,
} from '../components/project/ProjectDocumentLifecycle';

interface ProjectQuotation {
  id: string;
  quotation_number: string;
  date: string;
  total_amount: number;
  status: string;
  accepted_at: string | null;
  created_at: string;
}

type ProjectProforma = WorkspaceProforma;
type ProjectInvoice = WorkspaceInvoice;

interface ProjectReceipt {
  id: string;
  receipt_number: string;
  date: string;
  amount_received: number;
  payment_mode: string;
  payment_schedule_item_id: string | null;
  reconciliation_managed: boolean;
  is_void: boolean;
  created_at: string;
}

const STATUS_VARIANT = {
  draft: 'gray',
  quotation: 'blue',
  active: 'green',
  completed: 'green',
  cancelled: 'red',
} as const;

const PROJECT_STATUSES: ProjectStatus[] = ['draft', 'quotation', 'active', 'completed', 'cancelled'];

export function ProjectDetail() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { getProject, updateProject, deleteProject } = useProjects();
  const {
    summary: paymentSummary,
    installments,
    loading: paymentsLoading,
    error: paymentsError,
    replaceSchedule,
  } = useProjectPayments(projectId);
  const [project, setProject] = useState<Project | null>(null);
  const [quotations, setQuotations] = useState<ProjectQuotation[]>([]);
  const [proformas, setProformas] = useState<ProjectProforma[]>([]);
  const [invoices, setInvoices] = useState<ProjectInvoice[]>([]);
  const [receipts, setReceipts] = useState<ProjectReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<PaymentScheduleDraftItem[]>([]);

  const loadProjectFolder = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const [projectData, quotationResult, proformaResult, invoiceResult, receiptResult] = await Promise.all([
        getProject(projectId),
        supabase.from('quotations').select('id, quotation_number, date, total_amount, status, accepted_at, created_at').eq('project_id', projectId).order('date', { ascending: false }),
        supabase.from('proforma_invoices').select('id, project_id, proforma_number, date, total_amount, status, is_project_proforma, issued_at, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('invoices').select('id, project_id, invoice_number, invoice_date, total_amount, payment_status, is_final_project_invoice, issued_at, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('payment_receipts').select('id, receipt_number, date, amount_received, payment_mode, payment_schedule_item_id, reconciliation_managed, is_void, created_at').eq('project_id', projectId).order('date', { ascending: false }),
      ]);
      const firstError = quotationResult.error || proformaResult.error || invoiceResult.error || receiptResult.error;
      if (firstError) throw firstError;
      setProject(projectData);
      setQuotations((quotationResult.data || []) as ProjectQuotation[]);
      setProformas((proformaResult.data || []) as ProjectProforma[]);
      setInvoices((invoiceResult.data || []) as ProjectInvoice[]);
      setReceipts((receiptResult.data || []) as ProjectReceipt[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load project folder');
    } finally {
      setLoading(false);
    }
  }, [getProject, projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the route-scoped project folder when the project id changes.
    void loadProjectFolder();
  }, [loadProjectFolder]);

  const documentCount = quotations.length + proformas.length + invoices.length + receipts.length;
  const collected = paymentSummary?.total_received || 0;

  const timelineEvents = useMemo<ProjectTimelineEvent[]>(() => [
    ...quotations.map((item) => ({ id: item.id, type: 'quotation' as const, title: `Quotation ${item.quotation_number} created`, createdAt: item.created_at, amount: Number(item.total_amount) })),
    ...quotations.filter((item) => item.accepted_at).map((item) => ({ id: `${item.id}-accepted`, type: 'quotation' as const, title: `Quotation ${item.quotation_number} approved`, createdAt: item.accepted_at as string })),
    ...proformas.map((item) => ({ id: item.id, type: 'proforma' as const, title: item.proforma_number ? `Proforma ${item.proforma_number} issued` : 'Draft proforma prepared', createdAt: item.created_at, amount: Number(item.total_amount) })),
    ...invoices.map((item) => ({ id: item.id, type: 'invoice' as const, title: `Invoice ${item.invoice_number} created`, createdAt: item.created_at, amount: Number(item.total_amount) })),
    ...receipts.map((item) => ({
      id: item.id,
      type: 'receipt' as const,
      title: item.is_void
        ? `Receipt ${item.receipt_number} voided`
        : `${formatCurrency(Number(item.amount_received))} received · Receipt ${item.receipt_number}${item.reconciliation_managed ? '' : ' (legacy)'}`,
      createdAt: item.created_at,
    })),
  ], [invoices, proformas, quotations, receipts]);

  const quotationRows: FinancialDocumentRow[] = quotations.map((item) => ({ id: item.id, number: item.quotation_number, date: item.date, amount: Number(item.total_amount), status: item.status, projectName: project?.name }));
  const proformaRows: FinancialDocumentRow[] = proformas.map((item) => ({ id: item.id, number: item.proforma_number, date: item.date, amount: Number(item.total_amount), status: item.status, projectName: project?.name }));
  const invoiceRows: FinancialDocumentRow[] = invoices.map((item) => ({ id: item.id, number: item.invoice_number, date: item.invoice_date, amount: Number(item.total_amount), status: item.payment_status, projectName: project?.name }));
  const receiptRows: FinancialDocumentRow[] = receipts.map((item) => ({ id: item.id, number: item.receipt_number, date: item.date, amount: Number(item.amount_received), status: item.is_void ? 'void' : item.payment_mode, projectName: project?.name, actions: <Button size="sm" variant="ghost" onClick={() => navigate('/receipts')}><Eye size={13} /> View / download / send</Button> }));
  function openScheduleEditor() {
    setActionError('');
    setScheduleDraft(installments.map((item) => ({
      label: item.label,
      milestone: item.milestone,
      percentage: item.percentage,
      amount: item.amount,
      due_date: item.due_date,
    })));
    setShowScheduleEditor(true);
  }

  async function handleSaveSchedule(event: React.FormEvent) {
    event.preventDefault();
    if (!project?.contract_value) return;
    if (scheduleDraft.length === 0 || scheduleDraft.some((item) => !item.label.trim() || item.amount <= 0)) {
      setActionError('Each installment needs a label and a positive amount.');
      return;
    }
    const scheduleMinor = scheduleDraft.reduce((sum, item) => sum + toMinorUnits(item.amount), 0);
    if (scheduleMinor !== toMinorUnits(project.contract_value)) {
      setActionError(`Installments must total ${formatCurrency(project.contract_value)} exactly.`);
      return;
    }
    setSavingSchedule(true);
    setActionError('');
    try {
      await replaceSchedule(
        scheduleDraft.map((item) => ({ ...item, label: item.label.trim() })),
        installments[0]?.quotation_id,
        installments[0]?.proforma_id,
      );
      setShowScheduleEditor(false);
    } catch (scheduleError) {
      setActionError(scheduleError instanceof Error ? scheduleError.message : 'Payment plan could not be updated');
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleStatusChange(status: ProjectStatus) {
    if (!project) return;
    setUpdatingStatus(true);
    setActionError('');
    try {
      const updated = await updateProject(project.id, { status });
      setProject(updated);
    } catch (statusError) {
      setActionError(statusError instanceof Error ? statusError.message : 'Failed to update project status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDelete() {
    if (!project) return;
    if (documentCount > 0) {
      setActionError('This project has linked financial documents. Mark it cancelled instead of deleting it.');
      return;
    }
    if (!window.confirm(`Delete project “${project.name}”?`)) return;
    try {
      await deleteProject(project.id);
      navigate(`/clients/${project.client_id}`);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Project could not be deleted');
    }
  }

  if (loading || paymentsLoading) return <div><TopBar title="Project Folder" /><div className="p-8 text-sm text-gray-400">Loading project folder...</div></div>;
  if (error || !project) return <div><TopBar title="Project Folder" /><div className="p-8 text-sm text-red-600">{error || 'Project not found.'}</div></div>;

  return (
    <div>
      <TopBar
        title={project.name}
        subtitle="Project financial folder"
        actions={<Button variant="ghost" size="sm" onClick={() => navigate(`/clients/${project.client_id}`)}><ArrowLeft size={15} /> Client</Button>}
      />
      <div className="px-4 md:px-6 py-6 space-y-5">
        <Card>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="flex gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0"><FolderKanban size={22} /></div>
              <div>
                <div className="flex items-center gap-2 flex-wrap"><h1 className="text-2xl font-extrabold text-gray-900">{project.name}</h1><Badge variant={STATUS_VARIANT[project.status]}>{project.status}</Badge></div>
                <button onClick={() => navigate(`/clients/${project.client_id}`)} className="text-sm text-blue-600 hover:underline mt-1">{project.client?.name || 'View client'}</button>
                {project.description && <p className="text-sm text-gray-500 mt-3 max-w-3xl">{project.description}</p>}
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-400"><span>Created {formatDate(project.created_at)}</span>{project.sub_brand && <span>{project.sub_brand}</span>}{project.contract_value != null && <span>Contract value {formatCurrency(project.contract_value)}</span>}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <select disabled={updatingStatus} value={project.status} onChange={(event) => void handleStatusChange(event.target.value as ProjectStatus)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white capitalize">{PROJECT_STATUSES.map((status) => <option key={status} value={status} disabled={status === 'completed'}>{status}</option>)}</select>
              <Button variant="danger" onClick={() => void handleDelete()}><Trash2 size={15} /> Delete</Button>
            </div>
          </div>
          {actionError && <p className="mt-4 text-sm text-red-600">{actionError}</p>}
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate(`/quotations/new?project_id=${project.id}`)}><FilePlus2 size={15} /> Create Quotation</Button>
          <Button onClick={() => navigate(`/receipts/new?project_id=${project.id}`)} disabled={!paymentSummary || paymentSummary.payment_state === 'unconfigured' || paymentSummary.payment_state === 'paid'}><CircleDollarSign size={15} /> Record Payment</Button>
        </div>

        <ProjectPaymentPlan
          summary={paymentSummary}
          installments={installments}
          error={paymentsError}
          onRecordPayment={(installmentId) => navigate(`/receipts/new?project_id=${project.id}${installmentId ? `&schedule_item_id=${installmentId}` : ''}`)}
          onEditSchedule={openScheduleEditor}
          canEditSchedule={false}
        />

        <ProjectExecutionTimeline project={project} onProjectChanged={loadProjectFolder} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="!p-4"><p className="text-xs uppercase text-gray-400">Documents</p><p className="text-2xl font-bold mt-1">{documentCount}</p></Card>
          <Card className="!p-4"><p className="text-xs uppercase text-gray-400">Quotations</p><p className="text-2xl font-bold mt-1">{quotations.length}</p></Card>
          <Card className="!p-4"><p className="text-xs uppercase text-gray-400">Collected</p><p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(collected)}</p></Card>
          <Card className="!p-4"><p className="text-xs uppercase text-gray-400">Outstanding</p><p className="text-xl font-bold text-amber-700 mt-1">{paymentSummary?.outstanding == null ? 'Not configured' : formatCurrency(paymentSummary.outstanding)}</p><p className="text-[11px] text-gray-400 capitalize">{paymentSummary?.payment_state || 'unconfigured'}</p></Card>
        </div>

        <div className="grid xl:grid-cols-[2fr_1fr] gap-5">
          <div className="space-y-5">
            <Card padding={false}><div className="px-5 py-4 border-b border-gray-100"><h2 className="font-bold text-gray-900">Quotations</h2></div><ClientFinancialDocuments rows={quotationRows} emptyLabel="No quotation linked to this project." /></Card>
            {project.client && <ProjectProformaDocument project={project} client={project.client} proformas={proformas} onChanged={loadProjectFolder} />}
            <Card padding={false}><div className="px-5 py-4 border-b border-gray-100"><h2 className="font-bold text-gray-900">Payments / Receipts</h2></div><ClientFinancialDocuments rows={receiptRows} emptyLabel="No receipt linked to this project." /></Card>
            {project.client && <ProjectFinalInvoiceDocument project={project} client={project.client} invoice={invoices.find((item) => item.is_final_project_invoice)} onChanged={loadProjectFolder} />}
            {proformas.some((item) => !item.is_project_proforma) && <Card padding={false}><div className="px-5 py-4 border-b border-gray-100"><h2 className="font-bold text-gray-900">Legacy proformas</h2></div><ClientFinancialDocuments rows={proformaRows.filter((row) => proformas.find((item) => item.id === row.id && !item.is_project_proforma))} emptyLabel="No legacy proformas." /></Card>}
            {invoices.some((item) => !item.is_final_project_invoice) && <Card padding={false}><div className="px-5 py-4 border-b border-gray-100"><h2 className="font-bold text-gray-900">Other invoices</h2></div><ClientFinancialDocuments rows={invoiceRows.filter((row) => invoices.find((item) => item.id === row.id && !item.is_final_project_invoice))} emptyLabel="No other invoices." /></Card>}
          </div>
          <Card><h2 className="font-bold text-gray-900 mb-5">Financial activity</h2><ProjectTimeline events={timelineEvents} /></Card>
        </div>
      </div>

      <Modal isOpen={showScheduleEditor} onClose={() => setShowScheduleEditor(false)} title="Edit Payment Plan" size="lg">
        <form onSubmit={handleSaveSchedule} className="space-y-4">
          <p className="text-sm text-gray-500">Installments must total exactly {formatCurrency(project.contract_value || 0)}. The plan is locked after the first reconciled payment.</p>
          {scheduleDraft.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-end rounded-xl border border-gray-100 p-3">
              <div className="col-span-12 sm:col-span-4"><Input label="Label" value={item.label} onChange={(event) => setScheduleDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, label: event.target.value } : row))} /></div>
              <div className="col-span-5 sm:col-span-2"><Input label="Percent" type="number" min="0" max="100" step="0.0001" value={item.percentage ?? ''} onChange={(event) => setScheduleDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, percentage: event.target.value === '' ? null : Number(event.target.value) } : row))} /></div>
              <div className="col-span-7 sm:col-span-3"><Input label="Amount" type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => setScheduleDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, amount: Number(event.target.value) } : row))} /></div>
              <div className="col-span-10 sm:col-span-2"><Input label="Due date" type="date" value={item.due_date || ''} onChange={(event) => setScheduleDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, due_date: event.target.value || null } : row))} /></div>
              <button type="button" onClick={() => setScheduleDraft((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="col-span-2 sm:col-span-1 h-10 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center"><X size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setScheduleDraft((current) => [...current, { label: `Installment ${current.length + 1}`, milestone: null, percentage: null, amount: 0, due_date: null }])} className="text-sm font-semibold text-blue-600 hover:underline">+ Add installment</button>
          {actionError && <p className="text-sm text-red-600">{actionError}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setShowScheduleEditor(false)}>Cancel</Button><Button type="submit" loading={savingSchedule}>Save Payment Plan</Button></div>
        </form>
      </Modal>
    </div>
  );
}
