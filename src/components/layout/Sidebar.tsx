import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Receipt, BarChart2,
  FileCog, Users, Settings, LogOut, Building2,
  Wallet, ClipboardList, FileCheck, BadgeCheck
} from 'lucide-react';

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
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'CLIENTS',
    items: [
      { to: '/clients', icon: Users, label: 'Clients' },
    ],
  },
  {
    label: 'SALES',
    items: [
      { to: '/quotations', icon: ClipboardList, label: 'Quotations' },
      { to: '/proforma', icon: FileCheck, label: 'Proforma Invoices' },
      { to: '/invoices', icon: FileText, label: 'Invoices' },
      { to: '/receipts', icon: BadgeCheck, label: 'Payment Receipts' },
    ],
  },
  {
    label: 'EXPENSES',
    items: [
      { to: '/expenses', icon: Receipt, label: 'Expenses' },
    ],
  },
  {
    label: 'INTERNAL',
    items: [
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

interface SidebarProps {
  onSignOut: () => void;
  userName: string;
}

export function Sidebar({ onSignOut, userName }: SidebarProps) {
  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Infinity Enterprises</p>
            <p className="text-xs text-gray-500">Accounting</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-6' : ''}>
            {section.label && (
              <p
                className="px-3 mb-1 text-gray-400 font-medium uppercase"
                style={{ fontSize: 10, letterSpacing: '0.08em' }}
              >
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Settings — pinned above user block */}
      <div className="px-3 pt-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
            ${isActive
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`
          }
        >
          <Settings size={18} />
          Settings
        </NavLink>
      </div>

      {/* User */}
      <div className="px-3 py-4 border-t border-gray-200 mt-2">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-sm font-semibold text-blue-700">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700 truncate">{userName}</span>
        </div>
        <button
          onClick={onSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 w-full transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
