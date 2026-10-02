import { FolderKanban, FileText, Receipt, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Badge } from '../ui/Badge';

const STATUS_VARIANT = {
  draft: 'gray',
  quotation: 'blue',
  active: 'green',
  completed: 'green',
  cancelled: 'red',
} as const;

interface ProjectCardProps {
  project: Project;
  quotationNumbers?: string[];
  proformaNumbers?: string[];
  invoiceNumbers?: string[];
  receiptCount?: number;
  collected?: number;
  outstanding?: number | null;
  progress?: number;
}

export function ProjectCard({
  project,
  quotationNumbers = [],
  proformaNumbers = [],
  invoiceNumbers = [],
  receiptCount = 0,
  collected = 0,
  outstanding = null,
  progress = 0,
}: ProjectCardProps) {
  const navigate = useNavigate();
  const documentCount = quotationNumbers.length + proformaNumbers.length + invoiceNumbers.length + receiptCount;

  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project.id}`)}
      className="card-surface hover-lift w-full p-5 text-left focus:outline-none focus:ring-2 focus:ring-slate-300"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
          <FolderKanban size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900 truncate">{project.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">Created {formatDate(project.created_at)}</p>
            </div>
            <Badge variant={STATUS_VARIANT[project.status]}>{project.status}</Badge>
          </div>

          {project.description && (
            <p className="text-sm text-gray-500 mt-3 line-clamp-2">{project.description}</p>
          )}

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Contract</p>
              <p className="text-sm font-bold text-gray-800 mt-0.5">{project.contract_value == null ? '—' : formatCurrency(project.contract_value)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Received</p>
              <p className="text-sm font-bold text-green-700 mt-0.5">{formatCurrency(collected)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Outstanding</p>
              <p className="text-sm font-bold text-amber-700 mt-0.5">{outstanding == null ? '—' : formatCurrency(outstanding)}</p>
            </div>
          </div>

          {project.contract_value != null && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Payment progress</span><span>{progress}%</span></div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${progress}%` }} /></div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
            {quotationNumbers[0] && <span className="inline-flex items-center gap-1"><FileText size={12} />{quotationNumbers[0]}</span>}
            {proformaNumbers[0] && <span>{proformaNumbers[0]}</span>}
            {invoiceNumbers[0] && <span>{invoiceNumbers[0]}</span>}
            {receiptCount > 0 && <span className="inline-flex items-center gap-1"><Receipt size={12} />{receiptCount} receipt{receiptCount === 1 ? '' : 's'}</span>}
            <span>{documentCount} document{documentCount === 1 ? '' : 's'}</span>
          </div>
        </div>
        <ChevronRight size={18} className="text-gray-300 mt-2 shrink-0" />
      </div>
    </button>
  );
}
