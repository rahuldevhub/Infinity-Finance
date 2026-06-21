import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, FileText, Wallet, BarChart2, Settings, Plus,
  ClipboardList, BadgeCheck, Receipt, Users,
} from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';

type SectionId = 'sales' | 'finance' | 'gst';

const SECTION_ROUTES: Record<SectionId, string[]> = {
  sales: ['/clients', '/quotations', '/proforma', '/invoices', '/receipts'],
  finance: ['/expenses', '/cash-flow'],
  gst: ['/gst-summary', '/gst-filing'],
};

interface Tab {
  to: string;
  icon: React.ElementType;
  label: string;
  section?: SectionId;
}

const TABS: Tab[] = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/sales', icon: FileText, label: 'Sales', section: 'sales' },
  { to: '/finance', icon: Wallet, label: 'Finance', section: 'finance' },
  { to: '/gst', icon: BarChart2, label: 'GST', section: 'gst' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const CREATE_ITEMS = [
  { to: '/invoices/new', icon: FileText, label: 'Invoice' },
  { to: '/quotations/new', icon: ClipboardList, label: 'Quotation' },
  { to: '/receipts/new', icon: BadgeCheck, label: 'Receipt' },
  { to: '/expenses', icon: Receipt, label: 'Expense' },
  { to: '/clients', icon: Users, label: 'Client' },
  { to: '/cash-flow', icon: Wallet, label: 'Transaction' },
];

function isTabActive(tab: Tab, path: string): boolean {
  if (tab.to === '/') return path === '/';
  if (tab.section) return path === tab.to || SECTION_ROUTES[tab.section].some((r) => path.startsWith(r));
  return path.startsWith(tab.to);
}

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const path = location.pathname;

  // Close the create sheet whenever the route changes.
  useEffect(() => { setCreateOpen(false); }, [path]);

  return (
    <>
      {/* Create FAB */}
      <button
        onClick={() => setCreateOpen(true)}
        className="lg:hidden fixed right-4 bottom-20 z-50 w-14 h-14 rounded-full text-white flex items-center justify-center shadow-lg shadow-slate-900/30 active:scale-95 transition-transform"
        style={{ background: 'var(--accent)' }}
        aria-label="Create"
      >
        <Plus size={26} />
      </button>

      {/* Bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100 z-50 safe-bottom">
        <div className="flex items-stretch">
          {TABS.map((tab) => {
            const active = isTabActive(tab, path);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className="relative flex-1 flex flex-col items-center gap-0.5 py-2.5"
                style={{ color: active ? 'var(--accent)' : '#94a3b8' }}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-tab"
                    className="absolute top-0 h-0.5 w-8 rounded-full"
                    style={{ background: 'var(--accent)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-semibold">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Create bottom sheet */}
      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Create">
        <div className="grid grid-cols-3 gap-3">
          {CREATE_ITEMS.map(({ to, icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => { setCreateOpen(false); navigate(to); }}
              className="flex flex-col items-center gap-2 rounded-2xl p-3 bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <span
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(var(--accent-rgb),0.10)', color: 'var(--accent)' }}
              >
                <Icon size={20} />
              </span>
              <span className="text-xs font-semibold text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
