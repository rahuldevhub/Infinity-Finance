import { useState } from 'react';
import { CheckCircle2, FileCheck2, FileText, LockKeyhole } from 'lucide-react';
import type { Client, Project } from '../../types';
import { issueProjectFinalInvoice, issueProjectProforma } from '../../services/projectPayments';
import { useProjectPayments } from '../../hooks/useProjectPayments';
import { formatCurrency, formatDate, toLocalDateString } from '../../utils/formatters';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

export interface WorkspaceProforma {
  id: string;
  project_id: string | null;
  proforma_number: string | null;
  date: string | null;
  total_amount: number;
  status: string;
  is_project_proforma: boolean;
  issued_at: string | null;
  created_at: string;
}

export interface WorkspaceInvoice {
  id: string;
  project_id: string | null;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  payment_status: string;
  is_final_project_invoice: boolean;
  issued_at: string | null;
  created_at: string;
}

type SnapshotItem = { description?: string };
type SnapshotStage = { label?: string; percentage?: number; amount?: number; milestone?: string | null };
type Snapshot = {
  projectName?: string;
  projectDescription?: string | null;
  company?: string | null;
  title?: string | null;
  package?: { packageName?: string; deliverables?: string[]; services?: Record<string, string[]> } | null;
  items?: SnapshotItem[];
  paymentSchedule?: SnapshotStage[];
  terms?: string | null;
  commercials?: {
    basePrice?: number;
    discountType?: string;
    discountValue?: number;
    discountAmount?: number;
    taxableAmount?: number;
    gstRate?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    total?: number;
  };
};

function snapshotFor(project: Project): Snapshot | null {
  return (project.approved_commercial_snapshot || null) as Snapshot | null;
}

function CommercialSnapshot({ project, client }: { project: Project; client: Client }) {
  const snapshot = snapshotFor(project);
  if (!snapshot) return null;
  const commercials = snapshot.commercials || {};
  const services = (snapshot.items || []).map((item) => item.description).filter(Boolean) as string[];
  const deliverables = snapshot.package?.deliverables || [];
  const schedule = snapshot.paymentSchedule || [];
  const gst = Number(commercials.cgstAmount || 0) + Number(commercials.sgstAmount || 0) + Number(commercials.igstAmount || 0);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div><p className="text-xs uppercase text-gray-400">Client</p><p className="font-semibold text-gray-900">{client.name}</p></div>
        <div><p className="text-xs uppercase text-gray-400">Company</p><p className="font-semibold text-gray-900 capitalize">{snapshot.company || project.company || project.sub_brand || '—'}</p></div>
        <div><p className="text-xs uppercase text-gray-400">Project</p><p className="font-semibold text-gray-900">{snapshot.projectName || project.name}</p></div>
        <div><p className="text-xs uppercase text-gray-400">Package</p><p className="font-semibold text-gray-900">{snapshot.package?.packageName || snapshot.title || 'Custom project'}</p></div>
      </div>

      {(services.length > 0 || deliverables.length > 0) && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Approved services & deliverables</p>
          <ul className="grid sm:grid-cols-2 gap-x-5 gap-y-1 text-sm text-gray-700">
            {[...services, ...deliverables].map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 text-sm">
        <div className="flex justify-between p-3"><span className="text-gray-500">Base price</span><strong>{formatCurrency(Number(commercials.basePrice || 0))}</strong></div>
        <div className="flex justify-between p-3"><span className="text-gray-500">Discount{commercials.discountType === 'percent' ? ` (${Number(commercials.discountValue || 0)}%)` : ''}</span><strong>- {formatCurrency(Number(commercials.discountAmount || 0))}</strong></div>
        <div className="flex justify-between p-3"><span className="text-gray-500">Taxable value</span><strong>{formatCurrency(Number(commercials.taxableAmount || 0))}</strong></div>
        <div className="flex justify-between p-3"><span className="text-gray-500">GST ({Number(commercials.gstRate || 0)}%)</span><strong>{formatCurrency(gst)}</strong></div>
        <div className="flex justify-between p-3 text-base"><span className="font-semibold">Full project value</span><strong>{formatCurrency(Number(commercials.total || project.contract_value || 0))}</strong></div>
      </div>

      {schedule.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Payment plan</p>
          <div className="grid sm:grid-cols-3 gap-2">
            {schedule.map((stage, index) => (
              <div key={`${stage.label}-${index}`} className="rounded-xl border border-gray-100 p-3">
                <p className="font-semibold text-sm">{stage.label || `Installment ${index + 1}`}</p>
                <p className="text-xs text-gray-500 mt-1">{Number(stage.percentage || 0)}% · {formatCurrency(Number(stage.amount || 0))}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {(snapshot.projectDescription || snapshot.terms) && <p className="text-xs text-gray-500">{snapshot.projectDescription || snapshot.terms}</p>}
    </div>
  );
}

export function ProjectProformaDocument({
  project,
  client,
  proformas,
  onChanged,
}: {
  project: Project;
  client: Client;
  proformas: WorkspaceProforma[];
  onChanged: () => Promise<void>;
}) {
  const [showIssue, setShowIssue] = useState(false);
  const [issueDate, setIssueDate] = useState(toLocalDateString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const document = proformas.find((item) => item.is_project_proforma);
  const legacy = proformas.filter((item) => !item.is_project_proforma);

  async function issue(event: React.FormEvent) {
    event.preventDefault();
    if (!document) return;
    setSaving(true);
    setError('');
    try {
      await issueProjectProforma(document.id, issueDate);
      setShowIssue(false);
      await onChanged();
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : 'Proforma could not be issued');
    } finally {
      setSaving(false);
    }
  }

  if (!project.approved_commercial_snapshot) {
    return <Card><p className="text-sm text-gray-500">A single full-value proforma will be prepared after the quotation is approved.</p></Card>;
  }

  if (!document) {
    return (
      <Card>
        <div className="flex items-start gap-3"><FileCheck2 className="text-amber-500" size={22} /><div><h3 className="font-bold">Corrected proforma not available for this earlier approval</h3><p className="text-sm text-gray-500 mt-1">{legacy.length} legacy installment proforma{legacy.length === 1 ? '' : 's'} remain preserved. No historical financial record was changed.</p></div></div>
      </Card>
    );
  }

  const issued = Boolean(document.proforma_number && document.date);
  return (
    <>
      <Card>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div className="flex gap-3"><FileCheck2 className="text-blue-600" size={24} /><div><div className="flex items-center gap-2"><h2 className="font-bold text-lg">Proforma Invoice</h2><Badge variant={issued ? 'green' : 'yellow'}>{issued ? 'Issued' : 'Draft · Not issued'}</Badge></div><p className="text-sm text-gray-500 mt-1">Full approved project amount. This does not record money received.</p></div></div>
          {!issued && <Button onClick={() => setShowIssue(true)}>Issue Proforma</Button>}
        </div>
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400 uppercase">Number</p><p className="font-semibold mt-1">{document.proforma_number || 'Not issued'}</p></div>
          <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400 uppercase">Date</p><p className="font-semibold mt-1">{document.date ? formatDate(document.date) : 'Not issued'}</p></div>
          <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400 uppercase">Amount</p><p className="font-semibold mt-1">{formatCurrency(Number(document.total_amount))}</p></div>
        </div>
        <CommercialSnapshot project={project} client={client} />
      </Card>
      <Modal isOpen={showIssue} onClose={() => setShowIssue(false)} title="Issue Proforma" icon={<FileCheck2 size={18} />}>
        <form onSubmit={issue} className="space-y-4">
          <p className="text-sm text-gray-500">The PRF number will be generated from the selected issue month. It cannot be assigned during quotation approval.</p>
          <Input label="Proforma issue date" type="date" required value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setShowIssue(false)}>Cancel</Button><Button type="submit" loading={saving}>Issue Proforma</Button></div>
        </form>
      </Modal>
    </>
  );
}

export function ProjectFinalInvoiceDocument({
  project,
  client,
  invoice,
  onChanged,
  onOpenTimeline,
}: {
  project: Project;
  client: Client;
  invoice?: WorkspaceInvoice;
  onChanged: () => Promise<void>;
  onOpenTimeline?: () => void;
}) {
  const { summary, loading, error: paymentError } = useProjectPayments(project.id);
  const [showIssue, setShowIssue] = useState(false);
  const [issueDate, setIssueDate] = useState(toLocalDateString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const approved = Boolean(project.approved_commercial_snapshot && project.approved_quotation_id);
  const projectCompleted = project.status === 'completed';
  const paymentComplete = summary?.payment_state === 'paid' && Number(summary.outstanding || 0) === 0;
  const ready = approved && projectCompleted && paymentComplete;
  const progress = Math.min(100, Math.max(0, Number(summary?.payment_progress || 0)));

  async function issue(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await issueProjectFinalInvoice(project.id, issueDate);
      setShowIssue(false);
      await onChanged();
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : 'Final invoice could not be issued');
    } finally {
      setSaving(false);
    }
  }

  if (!approved) return <Card><p className="text-sm text-gray-500">The final invoice will be prepared from the approved commercial snapshot.</p></Card>;

  return (
    <>
      <Card>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div className="flex gap-3">{invoice ? <CheckCircle2 className="text-green-600" size={24} /> : ready ? <FileText className="text-blue-600" size={24} /> : <LockKeyhole className="text-amber-600" size={24} />}<div><div className="flex items-center gap-2"><h2 className="font-bold text-lg">Final Invoice</h2><Badge variant={invoice ? 'green' : ready ? 'blue' : 'yellow'}>{invoice ? 'Issued' : ready ? 'Ready to issue' : 'Locked'}</Badge></div><p className="text-sm text-gray-500 mt-1">One final tax invoice for the full approved project value.</p></div></div>
          {!invoice && (
            <div className="flex flex-wrap gap-2">
              {!projectCompleted && paymentComplete && onOpenTimeline && (
                <Button variant="outline" onClick={onOpenTimeline}><CheckCircle2 size={16} /> Complete Project</Button>
              )}
              <Button disabled={!ready || loading} onClick={() => setShowIssue(true)}>Create / Issue Invoice</Button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-100 p-4 mb-5">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Payment progress</span><strong>{formatCurrency(Number(summary?.total_received || 0))} / {formatCurrency(Number(summary?.contract_value || project.contract_value || 0))}</strong></div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mt-3"><div className="h-full bg-green-600 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
          <div className="flex justify-between mt-2 text-xs text-gray-500"><span>{progress.toFixed(0)}% received</span><span>Outstanding {formatCurrency(Number(summary?.outstanding ?? project.contract_value ?? 0))}</span></div>
          {!invoice && !ready && (
            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {!projectCompleted && paymentComplete
                ? <p><strong>Payment is complete.</strong> Confirm the project work is complete to unlock the final invoice.</p>
                : <p>Invoice unlocks when the approved project is marked completed, 100% paid, and outstanding is ₹0.00.</p>}
            </div>
          )}
          {paymentError && <p className="text-xs text-red-600 mt-3">{paymentError}</p>}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400 uppercase">Number</p><p className="font-semibold mt-1">{invoice?.invoice_number || 'Not issued'}</p></div>
          <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400 uppercase">Date</p><p className="font-semibold mt-1">{invoice ? formatDate(invoice.invoice_date) : 'Not issued'}</p></div>
          <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400 uppercase">Amount</p><p className="font-semibold mt-1">{formatCurrency(Number(invoice?.total_amount || project.contract_value || 0))}</p></div>
        </div>
        <CommercialSnapshot project={project} client={client} />
      </Card>
      <Modal isOpen={showIssue} onClose={() => setShowIssue(false)} title="Issue Final Invoice" icon={<FileText size={18} />}>
        <form onSubmit={issue} className="space-y-4">
          <p className="text-sm text-gray-500">The INV number will be generated from the selected invoice issue month. The issued values are frozen from the approved commercial snapshot.</p>
          <Input label="Invoice issue date" type="date" required value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setShowIssue(false)}>Cancel</Button><Button type="submit" loading={saving} disabled={!ready}>Issue Invoice</Button></div>
        </form>
      </Modal>
    </>
  );
}
