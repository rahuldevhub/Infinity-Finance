import { Link } from 'react-router-dom';
import {
  ChevronRight, Users, ClipboardList, FileCheck, FileText,
  BadgeCheck, Receipt, Wallet, BarChart2, FileCog,
} from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';

type SectionId = 'sales' | 'finance' | 'gst';

interface HubItem {
  to: string;
  icon: React.ElementType;
  label: string;
  desc: string;
}

const CONFIG: Record<SectionId, { title: string; subtitle: string; items: HubItem[] }> = {
  sales: {
    title: 'Sales',
    subtitle: 'Clients, quotes, invoices & receipts',
    items: [
      { to: '/clients', icon: Users, label: 'Clients', desc: 'Customer directory' },
      { to: '/quotations', icon: ClipboardList, label: 'Quotations', desc: 'Estimates & quotes' },
      { to: '/proforma', icon: FileCheck, label: 'Proforma Invoices', desc: 'Pre-invoices' },
      { to: '/invoices', icon: FileText, label: 'Invoices', desc: 'GST & non-GST invoices' },
      { to: '/receipts', icon: BadgeCheck, label: 'Payment Receipts', desc: 'Money received' },
    ],
  },
  finance: {
    title: 'Finance',
    subtitle: 'Expenses & cash flow',
    items: [
      { to: '/expenses', icon: Receipt, label: 'Expenses', desc: 'Spending & ITC' },
      { to: '/cash-flow', icon: Wallet, label: 'Cash Flow', desc: 'Money in & out' },
    ],
  },
  gst: {
    title: 'GST',
    subtitle: 'Summary & return filing',
    items: [
      { to: '/gst-summary', icon: BarChart2, label: 'GST Summary', desc: 'Output, ITC & net' },
      { to: '/gst-filing', icon: FileCog, label: 'GST Filing', desc: 'GSTR-1 & 3B' },
    ],
  },
};

export function SectionHub({ section }: { section: SectionId }) {
  const cfg = CONFIG[section];
  return (
    <div>
      <TopBar title={cfg.title} subtitle={cfg.subtitle} />
      <div className="px-4 md:px-6 py-6 max-w-2xl space-y-3">
        {cfg.items.map(({ to, icon: Icon, label, desc }) => (
          <Link
            key={to}
            to={to}
            className="card-surface hover-lift flex items-center gap-4 p-4 active:scale-[0.99] transition-transform"
          >
            <span
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(var(--accent-rgb),0.08)', color: 'var(--accent)' }}
            >
              <Icon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
            <ChevronRight size={18} className="text-gray-300 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
