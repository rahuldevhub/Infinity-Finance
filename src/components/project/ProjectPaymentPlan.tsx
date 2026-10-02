import { CalendarDays, CircleDollarSign, Pencil } from 'lucide-react';
import type { ScheduleItemWithSummary } from '../../hooks/useProjectPayments';
import type { ProjectPaymentSummary } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ProjectPaymentPlanProps {
  summary: ProjectPaymentSummary | null;
  installments: ScheduleItemWithSummary[];
  loading?: boolean;
  error?: string | null;
  onRecordPayment: (installmentId?: string) => void;
  onEditSchedule?: () => void;
  canEditSchedule?: boolean;
}

const STATE_VARIANT = {
  pending: 'gray',
  partial: 'blue',
  paid: 'green',
} as const;

export function ProjectPaymentPlan({
  summary,
  installments,
  loading = false,
  error,
  onRecordPayment,
  onEditSchedule,
  canEditSchedule = true,
}: ProjectPaymentPlanProps) {
  if (loading) return <Card><p className="text-sm text-gray-400">Loading payment plan...</p></Card>;

  if (!summary || summary.payment_state === 'unconfigured') {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <CircleDollarSign className="text-gray-300" size={24} />
          <div>
            <h2 className="font-bold text-gray-900">Payment Plan</h2>
            <p className="text-sm text-gray-500 mt-1">Accept a project quotation to confirm the contract value and activate its payment schedule.</p>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>
        </div>
      </Card>
    );
  }

  const canRecord = summary.outstanding != null && summary.outstanding > 0;
  const canEdit = canEditSchedule && summary.total_received === 0 && Boolean(onEditSchedule);

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-gray-900">Payment Plan</h2>
            <Badge variant={STATE_VARIANT[summary.payment_state]}>
              {summary.payment_state}
            </Badge>
          </div>
          <p className="text-xs text-gray-400 mt-1">Derived from reconciled payment receipts</p>
        </div>
        <div className="flex gap-2">
          {canEdit && <Button variant="outline" size="sm" onClick={onEditSchedule}><Pencil size={14} /> Edit Plan</Button>}
          <Button size="sm" disabled={!canRecord} onClick={() => onRecordPayment()}><CircleDollarSign size={15} /> {canRecord ? 'Record Payment' : 'Payment Complete'}</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-5">
        <div className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] uppercase text-gray-400">Project Value</p><p className="font-bold mt-1">{formatCurrency(summary.contract_value || 0)}</p></div>
        <div className="rounded-xl bg-green-50 p-3"><p className="text-[10px] uppercase text-green-600">Received</p><p className="font-bold text-green-700 mt-1">{formatCurrency(summary.total_received)}</p></div>
        <div className="rounded-xl bg-amber-50 p-3"><p className="text-[10px] uppercase text-amber-600">Outstanding</p><p className="font-bold text-amber-700 mt-1">{formatCurrency(summary.outstanding || 0)}</p></div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs mb-1.5"><span className="text-gray-500">Payment progress</span><span className="font-bold text-gray-800">{summary.payment_progress}%</span></div>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${summary.payment_progress}%` }} /></div>
      </div>

      <div className="mt-6 space-y-3">
        {installments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No structured installments found.</p>
        ) : installments.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-900">{item.installment_number}. {item.label}</p>
                {item.milestone && <p className="text-xs text-gray-500 mt-0.5">{item.milestone}</p>}
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                  {item.percentage != null && <span>{item.percentage}%</span>}
                  {item.due_date && <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{formatDate(item.due_date)}</span>}
                </div>
              </div>
              <Badge variant={STATE_VARIANT[item.payment_state]}>{item.payment_state}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div><p className="text-gray-400">Expected</p><p className="font-semibold text-gray-800">{formatCurrency(item.amount)}</p></div>
              <div><p className="text-gray-400">Received</p><p className="font-semibold text-green-700">{formatCurrency(item.received)}</p></div>
              <div><p className="text-gray-400">Remaining</p><p className="font-semibold text-amber-700">{formatCurrency(item.remaining)}</p></div>
            </div>
            {item.remaining > 0 && (
              <button type="button" onClick={() => onRecordPayment(item.id)} className="text-xs font-semibold text-blue-600 hover:underline mt-3">Record against this installment</button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
