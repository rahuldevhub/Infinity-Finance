import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit2, FilePlus2, FolderKanban, Mail, MapPin, Phone, Plus, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useProjects } from '../hooks/useProjects';
import type { Client, Project } from '../types';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ProjectCard } from '../components/project/ProjectCard';
import { ClientFinancialDocuments, type FinancialDocumentRow } from '../components/project/ClientFinancialDocuments';
import { formatCurrency } from '../utils/formatters';
import { calculateProjectPaymentSummary } from '../domain/paymentCalculations';
import { COMPANY_CODES, COMPANY_LABELS, inheritProjectCompany, type CompanyCode } from '../domain/company';
import { useSchemaReadiness } from '../hooks/useSchemaReadiness';
import { SchemaReadinessError } from '../components/project/SchemaReadinessError';
import { AgreementPanel } from '../components/agreement/AgreementPanel';
import { ClientEmailsPanel } from '../components/client/ClientEmailsPanel';
import { ClientActivity } from '../components/client/ClientActivity';
import { Badge } from '../components/ui/Badge';
import { ProjectCommercialSummary } from '../components/project/ProjectCommercialSummary';
import type { Quotation } from '../hooks/useQuotations';
import { QuotationLifecycleCard } from '../components/project/QuotationLifecycleCard';
import { WorkspaceProjectPayments } from '../components/project/WorkspaceProjectPayments';
import { acceptProjectQuotation } from '../services/projectPayments';
import {
  ProjectFinalInvoiceDocument,
  ProjectProformaDocument,
  type WorkspaceInvoice,
  type WorkspaceProforma,
} from '../components/project/ProjectDocumentLifecycle';
import { ProjectExecutionTimeline } from '../components/project/ProjectExecutionTimeline';

type Tab = 'overview' | 'projects' | 'timeline' | 'agreement' | 'quotations' | 'proformas' | 'payments' | 'receipts' | 'invoices' | 'emails' | 'activity';

interface ClientDocument {
  id: string;
  project_id: string | null;
  created_at: string;
}

type QuotationRecord = Quotation & ClientDocument;

type ProformaRecord = WorkspaceProforma & ClientDocument;

type InvoiceRecord = WorkspaceInvoice & ClientDocument;

interface ReceiptRecord extends ClientDocument {
  receipt_number: string;
  date: string;
  amount_received: number;
  payment_mode: string;
  reconciliation_managed: boolean;
  is_void: boolean;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'projects', label: 'Project' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'agreement', label: 'Agreement' },
  { id: 'quotations', label: 'Order Form' },
  { id: 'proformas', label: 'Proforma' },
  { id: 'payments', label: 'Payments' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'invoices', label: 'Invoice' },
  { id: 'emails', label: 'Emails' },
  { id: 'activity', label: 'Activity' },
];

export function ClientDetail() {
  const { clientId = '' } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const readiness = useSchemaReadiness();
  const { projects, loading: projectsLoading, createProject, refetch: refetchProjects } = useProjects({ clientId, enabled: readiness.ready });
  const [client, setClient] = useState<Client | null>(null);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [proformas, setProformas] = useState<ProformaRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [savingProject, setSavingProject] = useState(false);
  const [projectError, setProjectError] = useState('');
  const [projectForm, setProjectForm] = useState({ name: '', description: '', service_details: '', proposed_price: '', company: 'ritera' as CompanyCode });
  const [clientForm, setClientForm] = useState({ name: '', email: '', phone: '', address: '', state: '', gstin: '', default_company: 'ritera' as CompanyCode });
  const [approvingQuotationId, setApprovingQuotationId] = useState<string | null>(null);

  const loadClientFolder = useCallback(async () => {
    if (!clientId || !readiness.ready) return;
    setLoading(true);
    setError('');
    try {
      const [clientResult, quotationResult, proformaResult, invoiceResult, receiptResult] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase.from('quotations').select('*').eq('client_id', clientId).order('date', { ascending: false }),
        supabase.from('proforma_invoices').select('id, project_id, proforma_number, date, total_amount, status, is_project_proforma, issued_at, created_at').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('invoices').select('id, project_id, invoice_number, invoice_date, total_amount, payment_status, is_final_project_invoice, issued_at, created_at').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('payment_receipts').select('id, project_id, receipt_number, date, amount_received, payment_mode, reconciliation_managed, is_void, created_at').eq('client_id', clientId).order('date', { ascending: false }),
      ]);

      const firstError = clientResult.error || quotationResult.error || proformaResult.error || invoiceResult.error || receiptResult.error;
      if (firstError) throw firstError;
      setClient(clientResult.data as Client);
      setQuotations((quotationResult.data || []) as QuotationRecord[]);
      setProformas((proformaResult.data || []) as ProformaRecord[]);
      setInvoices((invoiceResult.data || []) as InvoiceRecord[]);
      setReceipts((receiptResult.data || []) as ReceiptRecord[]);
    } catch (loadError) {
      console.error('Client Workspace load failed', {
        message: loadError instanceof Error ? loadError.message : 'Unknown query error',
      });
      setError(loadError instanceof Error ? loadError.message : 'Failed to load client folder');
    } finally {
      setLoading(false);
    }
  }, [clientId, readiness.ready]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the route-scoped client folder when the client id changes.
    void loadClientFolder();
  }, [loadClientFolder]);

  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects]
  );

  const projectPaymentSummaries = useMemo(() => new Map(projects.map((project) => {
    const projectReceipts = receipts.filter((item) =>
      item.project_id === project.id && item.reconciliation_managed && !item.is_void
    );
    return [project.id, calculateProjectPaymentSummary(
      project.id,
      project.contract_value,
      projectReceipts.map((item) => Number(item.amount_received)),
    )];
  })), [projects, receipts]);

  const totalContractValue = projects.reduce((sum, project) => sum + Number(project.contract_value || 0), 0);
  const totalProposedValue = projects.reduce((sum, project) => sum + Number(project.contract_value ?? project.proposed_price ?? project.onboarding_snapshot?.commercials?.proposedTotal ?? 0), 0);
  const totalPayments = receipts.filter((item) => item.reconciliation_managed && !item.is_void).reduce((sum, item) => sum + Number(item.amount_received), 0);
  const configuredOutstanding = [...projectPaymentSummaries.values()].reduce(
    (sum, summary) => sum + (summary.outstanding || 0),
    0,
  );
  const configuredProjectCount = [...projectPaymentSummaries.values()].filter((summary) => summary.outstanding != null).length;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || projects[0];
  const selectedQuotation = selectedProject
    ? quotations.find((item) => item.project_id === selectedProject.id && (item.status === 'approved' || item.status === 'converted'))
      || quotations.find((item) => item.project_id === selectedProject.id)
    : undefined;

  const quotationRows: FinancialDocumentRow[] = quotations.map((item) => ({
    id: item.id,
    number: item.quotation_number,
    date: item.date,
    amount: Number(item.total_amount),
    status: item.status,
    projectName: item.project_id ? projectNames.get(item.project_id) : null,
  }));
  const proformaRows: FinancialDocumentRow[] = proformas.map((item) => ({
    id: item.id,
    number: item.proforma_number,
    date: item.date,
    amount: Number(item.total_amount),
    status: item.status,
    projectName: item.project_id ? projectNames.get(item.project_id) : null,
  }));
  const invoiceRows: FinancialDocumentRow[] = invoices.map((item) => ({
    id: item.id,
    number: item.invoice_number,
    date: item.invoice_date,
    amount: Number(item.total_amount),
    status: item.payment_status,
    projectName: item.project_id ? projectNames.get(item.project_id) : null,
  }));
  const receiptRows: FinancialDocumentRow[] = receipts.map((item) => ({
    id: item.id,
    number: item.receipt_number,
    date: item.date,
    amount: Number(item.amount_received),
    status: item.payment_mode,
    projectName: item.project_id ? projectNames.get(item.project_id) : null,
  }));

  async function handleCreateProject(event: React.FormEvent) {
    event.preventDefault();
    if (!projectForm.name.trim()) {
      setProjectError('Project name is required.');
      return;
    }
    setSavingProject(true);
    setProjectError('');
    try {
      const created = await createProject({
        client_id: clientId,
        name: projectForm.name.trim(),
        description: projectForm.description.trim() || null,
        service_details: projectForm.service_details.trim() || null,
        proposed_price: projectForm.proposed_price ? Number(projectForm.proposed_price) : null,
        company: inheritProjectCompany(client?.default_company, projectForm.company),
        sub_brand: COMPANY_LABELS[inheritProjectCompany(client?.default_company, projectForm.company)],
        created_by: user?.id || null,
      });
      setShowProjectForm(false);
      setProjectForm({ name: '', description: '', service_details: '', proposed_price: '', company: client?.default_company || 'ritera' });
      navigate(`/projects/${created.id}`);
    } catch (createError) {
      setProjectError(createError instanceof Error ? createError.message : 'Failed to create project');
    } finally {
      setSavingProject(false);
    }
  }

  function openEditClient() {
    if (!client) return;
    setClientForm({ name: client.name, email: client.email || '', phone: client.phone || '', address: client.address || '', state: client.state || '', gstin: client.gstin || '', default_company: client.default_company || 'ritera' });
    setShowEditClient(true);
  }

  async function saveClient(event: React.FormEvent) {
    event.preventDefault();
    const { error: updateError } = await supabase.from('clients').update({ ...clientForm, email: clientForm.email || null, phone: clientForm.phone || null, gstin: clientForm.gstin || null }).eq('id', clientId);
    if (updateError) { setError(updateError.message); return; }
    setShowEditClient(false); await loadClientFolder();
  }

  async function approveQuotation(quotationId: string) {
    setApprovingQuotationId(quotationId);
    setError('');
    try {
      await acceptProjectQuotation(quotationId);
      await loadClientFolder();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Quotation approval failed');
    } finally {
      setApprovingQuotationId(null);
    }
  }

  function projectCard(project: Project) {
    const projectQuotations = quotations.filter((item) => item.project_id === project.id);
    const projectProformas = proformas.filter((item) => item.project_id === project.id);
    const projectInvoices = invoices.filter((item) => item.project_id === project.id);
    const projectReceipts = receipts.filter((item) => item.project_id === project.id);
    const reconciledReceipts = projectReceipts.filter((item) => item.reconciliation_managed && !item.is_void);
    const paymentSummary = projectPaymentSummaries.get(project.id) || calculateProjectPaymentSummary(project.id, project.contract_value, []);
    return (
      <ProjectCard
        key={project.id}
        project={project}
        quotationNumbers={projectQuotations.map((item) => item.quotation_number)}
        proformaNumbers={projectProformas.map((item) => item.proforma_number).filter((number): number is string => Boolean(number))}
        invoiceNumbers={projectInvoices.map((item) => item.invoice_number)}
        receiptCount={reconciledReceipts.length}
        collected={paymentSummary.total_received}
        outstanding={paymentSummary.outstanding}
        progress={paymentSummary.payment_progress}
      />
    );
  }

  if (readiness.loading) return <div><TopBar title="Client Workspace" /><div className="p-8 text-sm text-gray-400">Checking schema readiness...</div></div>;
  if (!readiness.ready) return <div><TopBar title="Client Workspace" /><div className="px-4 md:px-6"><SchemaReadinessError missing={readiness.missing} onRetry={() => void readiness.retry()} /></div></div>;
  if (loading || projectsLoading) {
    return <div><TopBar title="Client Folder" /><div className="p-8 text-sm text-gray-400">Loading client folder...</div></div>;
  }

  if (error || !client) {
    return <div><TopBar title="Client Folder" /><div className="p-8 text-sm text-red-600">{error || 'Client not found.'}</div></div>;
  }

  return (
    <div>
      <TopBar
        title={client.name}
        subtitle="Client Workspace"
        actions={<Button variant="ghost" size="sm" onClick={() => navigate('/clients')}><ArrowLeft size={15} /> Clients</Button>}
      />

      <div className="px-4 md:px-6 py-6 space-y-5">
        <Card>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div>
              <div className="flex items-center gap-3"><h1 className="text-2xl font-extrabold text-gray-900">{client.name}</h1><Badge variant="blue">{client.default_company ? COMPANY_LABELS[client.default_company] : 'Legacy client'}</Badge></div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm text-gray-500">
                {client.email && <span className="inline-flex items-center gap-1.5"><Mail size={14} />{client.email}</span>}
                {client.phone && <span className="inline-flex items-center gap-1.5"><Phone size={14} />{client.phone}</span>}
                {client.gstin && <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} />GSTIN {client.gstin}</span>}
                {(client.address || client.state) && <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{[client.address, client.state].filter(Boolean).join(', ')}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={openEditClient}><Edit2 size={15} /> Edit Client</Button><Button variant="outline" onClick={() => navigate(selectedProject ? `/quotations/new?project_id=${selectedProject.id}` : `/quotations/new?client_id=${client.id}`)}><FilePlus2 size={15} /> Create Quotation</Button><Button variant="outline" onClick={() => setActiveTab('emails')}><Mail size={15} /> Send Email</Button><Button onClick={() => { setProjectForm((current) => ({ ...current, company: client.default_company || 'ritera' })); setShowProjectForm(true); }}><Plus size={16} /> New Project</Button></div>
          </div>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="!p-4"><p className="text-xs text-gray-400 uppercase">Contract / Proposed Value</p><p className="text-xl font-bold mt-1">{projects.length > 0 ? formatCurrency(totalProposedValue) : 'Not configured'}</p><p className="text-[11px] text-gray-400">{configuredProjectCount > 0 ? `${formatCurrency(totalContractValue)} confirmed` : 'Awaiting quotation acceptance'}</p></Card>
          <Card className="!p-4"><p className="text-xs text-gray-400 uppercase">Received</p><p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(totalPayments)}</p><p className="text-[11px] text-gray-400">Reconciled receipts only</p></Card>
          <Card className="!p-4"><p className="text-xs text-gray-400 uppercase">Outstanding</p><p className="text-xl font-bold text-amber-700 mt-1">{configuredProjectCount > 0 ? formatCurrency(configuredOutstanding) : 'Not configured'}</p><p className="text-[11px] text-gray-400">Confirmed contracts only</p></Card>
          <Card className="!p-4"><p className="text-xs text-gray-400 uppercase">Active Projects</p><p className="text-2xl font-bold mt-1">{projects.filter((project) => project.status === 'active').length}</p></Card>
        </div>

        <div className="overflow-x-auto border-b border-gray-200">
          <div className="flex min-w-max gap-1">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3 text-sm font-semibold border-b-2 ${activeTab === tab.id ? 'border-slate-800 text-slate-900' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {(activeTab === 'overview' || activeTab === 'projects') && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">Projects</h2>
              {projects.length > 1 ? <select value={selectedProject?.id || ''} onChange={(event) => setSelectedProjectId(event.target.value)} className="border rounded-lg px-3 py-2 text-sm">{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select> : <span className="text-xs text-gray-400">Commercial engagement</span>}
            </div>
            {projects.length === 0 ? (
              <Card className="text-center py-12"><FolderKanban size={30} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-500">No projects yet.</p><Button size="sm" className="mt-4" onClick={() => setShowProjectForm(true)}><Plus size={14} /> Create first project</Button></Card>
            ) : (
              <div className="space-y-4">{selectedProject && <ProjectCommercialSummary project={selectedProject} payment={projectPaymentSummaries.get(selectedProject.id)} />}{activeTab === 'overview' && projects.length > 1 && <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{projects.map(projectCard)}</div>}</div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-4">
            {projects.length > 1 && <div className="flex justify-end"><select value={selectedProject?.id || ''} onChange={(event) => setSelectedProjectId(event.target.value)} className="border rounded-lg px-3 py-2 text-sm">{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>}
            {selectedProject ? <ProjectExecutionTimeline project={selectedProject} onProjectChanged={async () => { await Promise.all([loadClientFolder(), refetchProjects()]); }} /> : <Card><p className="text-sm text-gray-500">Create a project before adding timeline tasks.</p></Card>}
          </div>
        )}

        {activeTab === 'quotations' && (
          <div className="space-y-4">
            {selectedProject && selectedQuotation ? (
              <QuotationLifecycleCard
                quotation={selectedQuotation}
                project={selectedProject}
                client={client}
                onEdit={() => navigate(`/quotations/${selectedQuotation.id}/edit`)}
                onApprove={() => void approveQuotation(selectedQuotation.id)}
                approving={approvingQuotationId === selectedQuotation.id}
              />
            ) : <Card><p className="text-sm text-gray-500">No project quotation is available.</p></Card>}
            {quotations.length > 1 && <Card padding={false}><ClientFinancialDocuments rows={quotationRows} emptyLabel="No quotations for this client." /></Card>}
          </div>
        )}
        {activeTab === 'proformas' && selectedProject && (
          <div className="space-y-4">
            <ProjectProformaDocument project={selectedProject} client={client} proformas={proformas.filter((item) => item.project_id === selectedProject.id)} onChanged={loadClientFolder} />
            {proformas.some((item) => item.project_id !== selectedProject.id || !item.is_project_proforma) && <Card padding={false}><ClientFinancialDocuments rows={proformaRows} emptyLabel="No proformas for this client." /></Card>}
          </div>
        )}
        {activeTab === 'payments' && <div className="space-y-4">{projects.map((project) => <WorkspaceProjectPayments key={project.id} project={project} />)}</div>}
        {activeTab === 'receipts' && <Card padding={false}><ClientFinancialDocuments rows={receiptRows} emptyLabel="No payment receipts for this client." /></Card>}
        {activeTab === 'invoices' && selectedProject && (
          <div className="space-y-4">
            <ProjectFinalInvoiceDocument
              project={selectedProject}
              client={client}
              invoice={invoices.find((item) => item.project_id === selectedProject.id && item.is_final_project_invoice)}
              onChanged={loadClientFolder}
              onOpenTimeline={() => setActiveTab('timeline')}
            />
            {invoices.some((item) => item.project_id !== selectedProject.id || !item.is_final_project_invoice) && <Card padding={false}><ClientFinancialDocuments rows={invoiceRows} emptyLabel="No invoices for this client." /></Card>}
          </div>
        )}
        {activeTab === 'agreement' && <AgreementPanel client={client} projects={projects} />}
        {activeTab === 'emails' && <ClientEmailsPanel client={client} projects={projects} />}
        {activeTab === 'activity' && <ClientActivity client={client} projects={projects} />}
      </div>

      <Modal isOpen={showProjectForm} onClose={() => setShowProjectForm(false)} title="New Project" icon={<FolderKanban size={18} />}>
        <form onSubmit={handleCreateProject} className="space-y-4">
          <Input label="Project Name" value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} required placeholder="My First Book" />
          <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700">Description</label><textarea value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" placeholder="Short project description" /></div>
          <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700">Company</label><select required value={projectForm.company} onChange={(event) => setProjectForm((current) => ({ ...current, company: event.target.value as CompanyCode }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{COMPANY_CODES.map((company) => <option key={company} value={company}>{COMPANY_LABELS[company]}</option>)}</select></div>
          <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700">Service details</label><textarea value={projectForm.service_details} onChange={(event) => setProjectForm((current) => ({ ...current, service_details: event.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <Input label="Proposed price (non-binding)" type="number" min="0" step="0.01" value={projectForm.proposed_price} onChange={(event) => setProjectForm((current) => ({ ...current, proposed_price: event.target.value }))} />
          <p className="text-xs text-gray-500">Proposed price does not create a contract or payment obligation.</p>
          {projectError && <p className="text-sm text-red-600">{projectError}</p>}
          <div className="flex gap-3"><Button type="submit" loading={savingProject}>Create Project</Button><Button type="button" variant="outline" onClick={() => setShowProjectForm(false)}>Cancel</Button></div>
        </form>
      </Modal>
      <Modal isOpen={showEditClient} onClose={() => setShowEditClient(false)} title="Edit Client">
        <form onSubmit={saveClient} className="space-y-4"><Input label="Name" required value={clientForm.name} onChange={(event) => setClientForm((current) => ({ ...current, name: event.target.value }))} /><Input label="Email" type="email" value={clientForm.email} onChange={(event) => setClientForm((current) => ({ ...current, email: event.target.value }))} /><Input label="Phone" value={clientForm.phone} onChange={(event) => setClientForm((current) => ({ ...current, phone: event.target.value }))} /><Input label="Address" value={clientForm.address} onChange={(event) => setClientForm((current) => ({ ...current, address: event.target.value }))} /><Input label="State" value={clientForm.state} onChange={(event) => setClientForm((current) => ({ ...current, state: event.target.value }))} /><Input label="GSTIN" value={clientForm.gstin} onChange={(event) => setClientForm((current) => ({ ...current, gstin: event.target.value }))} /><div><label className="text-sm font-medium">Default company</label><select value={clientForm.default_company} onChange={(event) => setClientForm((current) => ({ ...current, default_company: event.target.value as CompanyCode }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">{COMPANY_CODES.map((company) => <option key={company} value={company}>{COMPANY_LABELS[company]}</option>)}</select></div><div className="flex gap-3"><Button type="submit">Save</Button><Button type="button" variant="outline" onClick={() => setShowEditClient(false)}>Cancel</Button></div></form>
      </Modal>
    </div>
  );
}
