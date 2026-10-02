import { FileCheck, FileText, Receipt, ScrollText } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

export interface ProjectTimelineEvent {
  id: string;
  type: 'quotation' | 'proforma' | 'invoice' | 'receipt';
  title: string;
  createdAt: string;
  amount?: number;
}

const ICONS = {
  quotation: FileText,
  proforma: ScrollText,
  invoice: FileCheck,
  receipt: Receipt,
};

export function ProjectTimeline({ events }: { events: ProjectTimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (sorted.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No project activity yet.</p>;
  }

  return (
    <div className="space-y-0">
      {sorted.map((event, index) => {
        const Icon = ICONS[event.type];
        return (
          <div key={`${event.type}-${event.id}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                <Icon size={15} />
              </div>
              {index < sorted.length - 1 && <div className="w-px min-h-8 flex-1 bg-gray-200" />}
            </div>
            <div className="pb-5 min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-gray-800">{event.title}</p>
                {event.amount != null && <span className="text-sm font-semibold text-gray-700">{formatCurrency(event.amount)}</span>}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(event.createdAt)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
