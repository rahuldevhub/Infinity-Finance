import { Check } from 'lucide-react';
import type { Project, ProjectPaymentSummary } from '../../types';
import { COMPANY_LABELS } from '../../domain/company';
import { formatCurrency } from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export function ProjectCommercialSummary({ project, payment }: { project: Project; payment?: ProjectPaymentSummary }) {
  const snapshot = project.approved_commercial_snapshot || project.current_commercial_spec || project.onboarding_snapshot;
  const rawCommercials = snapshot && typeof snapshot.commercials === 'object' ? snapshot.commercials as Record<string, unknown> : null;
  const onboardingCommercials = project.onboarding_snapshot?.commercials;
  const commercials = rawCommercials ? {
    basePrice: Number(rawCommercials.basePrice || 0),
    discountAmount: Number(rawCommercials.discountAmount || 0),
    taxableAmount: Number(rawCommercials.taxableAmount || 0),
    gstAmount: Number(rawCommercials.gstAmount || Number(rawCommercials.cgstAmount || 0) + Number(rawCommercials.sgstAmount || 0) + Number(rawCommercials.igstAmount || 0)),
    proposedTotal: Number(rawCommercials.total || rawCommercials.proposedTotal || 0),
  } : onboardingCommercials;
  const rawPackage = snapshot && typeof snapshot.package === 'object' ? snapshot.package as { packageName?: string; deliverables?: string[]; services?: Record<string, string[]>; excludedServices?: string[] } : project.onboarding_snapshot?.package;
  const excluded = new Set(rawPackage && 'excludedServices' in rawPackage ? rawPackage.excludedServices || [] : []);
  const deliverables = rawPackage?.deliverables || Object.values(rawPackage?.services || {}).flat().filter((item) => !excluded.has(item));
  const rawSchedule = snapshot && Array.isArray(snapshot.paymentSchedule) ? snapshot.paymentSchedule as Array<{ label: string; percentage: number; amount: number }> : project.onboarding_snapshot?.paymentSchedule;
  const value = project.contract_value ?? project.proposed_price ?? commercials?.proposedTotal ?? null;
  const isContract = project.contract_value != null;
  return <div className="space-y-4">
    <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-lg font-bold">{project.name}</h2><Badge variant={project.status === 'active' || project.status === 'completed' ? 'green' : 'gray'}>{project.status}</Badge></div><p className="text-sm text-gray-500 mt-1">{project.company ? COMPANY_LABELS[project.company] : project.sub_brand || 'Company not recorded'} · {rawPackage?.packageName || 'Custom scope'}</p>{project.description && <p className="text-sm text-gray-600 mt-3">{project.description}</p>}</div><div className="text-right"><p className="text-xs uppercase text-gray-400">{isContract ? 'Contract Value' : 'Proposed Value'}</p><p className="text-xl font-bold">{value == null ? 'Not configured' : formatCurrency(value)}</p></div></div></Card>
    {deliverables.length > 0 && <Card><h3 className="font-bold mb-3">Deliverables</h3><div className="grid md:grid-cols-2 gap-2">{deliverables.map((item, index) => <div key={`${index}-${item}`} className="flex gap-2 text-sm text-gray-700"><Check size={15} className="text-green-600 shrink-0 mt-0.5" />{item}</div>)}</div></Card>}
    {commercials && <Card><h3 className="font-bold mb-3">Commercials</h3><div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm"><div><p className="text-gray-400">Base Price</p><p className="font-semibold">{formatCurrency(commercials.basePrice)}</p></div><div><p className="text-gray-400">Discount</p><p className="font-semibold">{formatCurrency(commercials.discountAmount)}</p></div><div><p className="text-gray-400">Taxable</p><p className="font-semibold">{formatCurrency(commercials.taxableAmount)}</p></div><div><p className="text-gray-400">GST</p><p className="font-semibold">{formatCurrency(commercials.gstAmount)}</p></div><div><p className="text-gray-400">{isContract ? 'Contract' : 'Proposed'}</p><p className="font-bold">{formatCurrency(value || 0)}</p></div></div></Card>}
    {rawSchedule && <Card><h3 className="font-bold mb-3">{isContract ? 'Activated Payment Plan' : 'Proposed Payment Plan'}</h3><div className="space-y-2">{rawSchedule.map((item, index) => <div key={index} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"><span>{item.label} · {item.percentage}%</span><span className="font-semibold">{formatCurrency(item.amount)}</span></div>)}</div>{isContract && payment && <div className="mt-4 pt-4 border-t flex justify-between text-sm"><span>Received {formatCurrency(payment.total_received)}</span><span>Outstanding {payment.outstanding == null ? '—' : formatCurrency(payment.outstanding)}</span></div>}<p className="text-xs text-gray-400 mt-3">{isContract ? 'Approved terms are frozen; actual receipts are the payment source of truth.' : 'Draft only. This activates through quotation approval.'}</p></Card>}
  </div>;
}
