import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatCurrency, formatDate } from '../../utils/formatters';

export interface FinancialDocumentRow {
  id: string;
  number: string | null;
  date: string | null;
  amount: number;
  status?: string | null;
  projectName?: string | null;
  actions?: ReactNode;
}

interface ClientFinancialDocumentsProps {
  rows: FinancialDocumentRow[];
  emptyLabel: string;
}

export function ClientFinancialDocuments({ rows, emptyLabel }: ClientFinancialDocumentsProps) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        <FileText size={28} className="mx-auto mb-2 text-gray-300" />
        <p className="text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/70">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Number</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Project</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
            {rows.some((row) => row.actions) && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-semibold text-gray-900">{row.number || 'Not issued'}</td>
              <td className="px-4 py-3 text-gray-500">{row.date ? formatDate(row.date) : 'Not issued'}</td>
              <td className="px-4 py-3 text-gray-500">{row.projectName || 'Unassigned'}</td>
              <td className="px-4 py-3 capitalize text-gray-500">{row.status || '—'}</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(row.amount)}</td>
              {rows.some((item) => item.actions) && <td className="px-4 py-3 text-right">{row.actions}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
