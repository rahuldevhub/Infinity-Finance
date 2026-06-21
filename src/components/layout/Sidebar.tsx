import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, FileText, Receipt, BarChart2,
  FileCog, Users, Settings, LogOut, Building2,
  Wallet, ClipboardList, FileCheck, BadgeCheck,
  ChevronsUpDown, Check,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'OVERVIEW',
    items: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    label: 'SALES',
    items: [
      { to: '/clients', icon: Users, label: 'Clients' },
      { to: '/quotations', icon: ClipboardList, label: 'Quotations' },
      { to: '/proforma', icon: FileCheck, label: 'Proforma Invoices' },
      { to: '/invoices', icon: FileText, label: 'Invoices' },
      { to: '/receipts', icon: BadgeCheck, label: 'Payment Receipts' },
    ],
  },
  {
    label: 'FINANCE',
    items: [
      { to: '/expenses', icon: Receipt, label: 'Expenses' },
      { to: '/cash-flow', icon: Wallet, label: 'Cash Flow' },
    ],
  },
  {
    label: 'GST',
    items: [
      { to: '/gst-summary', icon: BarChart2, label: 'GST Summary' },
      { to: '/gst-filing', icon: FileCog, label: 'GST Filing' },
    ],
  },
];

function WorkspaceSwitcher() {
  const { workspace, setWorkspace, workspaces } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative px-3 pt-4 pb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: workspace.accent }}>
          <Building2 size={19} className="text-white" />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-bold text-gray-900 truncate flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: workspace.accent }} />
            {workspace.name}
          </p>
          <p className="text-[11px] text-gray-400 truncate">{workspace.sub}</p>
        </div>
        <ChevronsUpDown size={15} className="text-gray-300 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg shadow-gray-200/60">
          <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Workspaces</p>
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => { setWorkspace(w.id); setOpen(false); }}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-gray-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: w.accent }}>
                <Building2 size={15} className="text-white" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium text-gray-800 truncate">{w.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{w.sub}</p>
              </div>
              {workspace.id === w.id && <Check size={15} className="shrink-0" style={{ color: w.accent }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavRow({ to, Icon, label }: { to: string; Icon: React.ElementType; label: string }) {
  return (
    <NavLink to={to} end={to === '/'} className="relative block">
      {({ isActive }) => (
        <div className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium">
          {isActive && (
            <motion.span
              layoutId="sidebar-active"
              className="absolute inset-0 rounded-lg"
              style={{ background: 'rgba(var(--accent-rgb), 0.10)' }}
              transition={{ type: 'spring', stiffness: 480, damping: 38 }}
            />
          )}
          <Icon
            size={18}
            className="relative z-10 shrink-0"
            style={{ color: isActive ? 'var(--accent)' : '#9ca3af' }}
          />
          <span
            className="relative z-10"
            style={{ color: isActive ? 'var(--accent)' : '#4b5563' }}
          >
            {label}
          </span>
        </div>
      )}
    </NavLink>
  );
}

interface SidebarProps {
  onSignOut: () => void;
  userName: string;
}

export function Sidebar({ onSignOut, userName }: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0">
      <div className="border-b border-gray-100/80">
        <WorkspaceSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {navSections.map((section, si) => (
          <div key={si} className="mb-1">
            {section.label && (
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-6 mt-4 mb-2">
                {section.label}
              </p>
            )}
            <div className="px-3 space-y-1">
              {section.items.map(({ to, icon: Icon, label }) => (
                <NavRow key={to} to={to} Icon={Icon} label={label} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pt-2">
        <NavRow to="/settings" Icon={Settings} label="Settings" />
      </div>

      <div className="px-3 py-4 border-t border-gray-100/80 mt-2">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(var(--accent-rgb), 0.12)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700 truncate">{userName}</span>
        </div>
        <button
          onClick={onSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 w-full transition-colors"
        >
          <LogOut size={18} className="text-gray-400" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
