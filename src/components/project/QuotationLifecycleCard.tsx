import { CheckCircle2, Edit2, LockKeyhole } from 'lucide-react';
import type { Quotation } from '../../hooks/useQuotations';
import type { Client, Project } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface Props {
  quotation: Quotation;
  project: Project;
  client: Client;
  onEdit: () => void;
  onApprove: () => void;
  approving?: boolean;
}

function packageDetails(notes: string | null) {
  if (!notes) return null;
  try {
    const value = JSON.parse(notes) as {
      packageName?: string;
      services?: Record<string, string[]>;
      excludedServices?: string[];
      paidAddons?: string[];
      complementary?: string[];
      notes?: string;
    };
    const excluded = new Set(value.excludedServices || []);
    const deliverables = Object.values(value.services || {}).flat().filter((item) => !excluded.has(item));
    return { ...value, deliverables };
  } catch {
    return { notes, deliverables: [] as string[] };
  }
}

export function QuotationLifecycleCard({ quotation, project, client, onEdit, onApprove, approving }: Props) {
  const details = packageDetails(quotation.notes);
  const locked = quotation.status === 'approved' || quotation.status === 'converted';
  const base = Number(quotation.taxable_value) + Number(quotation.discount_amount || 0);
  const gst = Number(quotation.cgst_amount) + Number(quotation.sgst_amount) + Number(quotation.igst_amount);

  return (
    <Card>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-extrabold text-gray-900">{quotation.quotation_number}</h2>
            <Badge variant={locked ? 'green' : quotation.status === 'sent' ? 'blue' : 'gray'}>{quotation.status}</Badge>
            <span className="text-xs text-gray-400">Revision {quotation.revision_number || 1}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{quotation.title}</p>
          <p className="text-xs text-gray-400 mt-1">Created {formatDate(quotation.date)} · Updated {formatDate(quotation.updated_at || quotation.created_at)}</p>
          {quotation.accepted_at && <p className="text-xs text-green-700 mt-1">Accepted {formatDate(quotation.accepted_at)}</p>}
        </div>
        <div className="flex gap-2">
          {!locked && <Button variant="outline" size="sm" onClick={onEdit}><Edit2 size={14} /> Edit</Button>}
          {!locked && <Button size="sm" onClick={onApprove} loading={approving}><CheckCircle2 size={14} /> Approve / Accept</Button>}
          {locked && <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700"><LockKeyhole size={14} /> Commercially locked</span>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 text-sm">
        <div className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] uppercase text-gray-400">Client</p><p className="font-semibold mt-1">{client.name}</p></div>
        <div className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] uppercase text-gray-400">Company</p><p className="font-semibold mt-1">{quotation.sub_brand}</p></div>
        <div className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] uppercase text-gray-400">Project</p><p className="font-semibold mt-1">{project.name}</p></div>
        <div className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] uppercase text-gray-400">Package</p><p className="font-semibold mt-1">{details?.packageName || 'Custom scope'}</p></div>
      </div>

      {(project.description || details?.deliverables.length) && (
        <div className="grid lg:grid-cols-2 gap-5 mt-5">
          <div><p className="text-xs font-bold uppercase text-gray-400">Project description</p><p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{project.description || 'No description supplied.'}</p></div>
          <div><p className="text-xs font-bold uppercase text-gray-400">Deliverables</p><ul className="mt-2 grid sm:grid-cols-2 gap-1 text-sm text-gray-600">{details?.deliverables.map((item) => <li key={item}>• {item}</li>)}</ul></div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
        <div><p className="text-xs text-gray-400">Base price</p><p className="font-bold">{formatCurrency(base)}</p></div>
        <div><p className="text-xs text-gray-400">Discount</p><p className="font-bold">{formatCurrency(Number(quotation.discount_amount || 0))}</p></div>
        <div><p className="text-xs text-gray-400">Taxable</p><p className="font-bold">{formatCurrency(Number(quotation.taxable_value))}</p></div>
        <div><p className="text-xs text-gray-400">GST ({quotation.gst_rate}%)</p><p className="font-bold">{formatCurrency(gst)}</p></div>
        <div><p className="text-xs text-gray-400">Total proposed</p><p className="text-lg font-extrabold text-blue-700">{formatCurrency(Number(quotation.total_amount))}</p></div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-bold uppercase text-gray-400">Payment schedule</p>
        <div className="grid md:grid-cols-3 gap-3 mt-2">
          {(quotation.payment_schedule || []).map((item, index) => (
            <div key={`${item.label}-${index}`} className="rounded-xl border border-gray-100 p-3">
              <p className="text-sm font-bold">{index + 1}. {item.label}</p>
              <p className="text-xs text-gray-400 mt-1">{item.percentage}% · {item.milestone || 'No milestone set'}</p>
              <p className="font-bold text-gray-800 mt-2">{formatCurrency(Number(item.amount))}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
