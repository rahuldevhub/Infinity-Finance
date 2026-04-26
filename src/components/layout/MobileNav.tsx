import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Receipt, Wallet,
  Menu, X, ClipboardList, Users, BarChart2,
  FileCog, Settings, FileCheck, BadgeCheck
} from 'lucide-react';

const primaryTabs = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/cash-flow', icon: Wallet, label: 'Cash Flow' },
];

const drawerLinks = [
  { to: '/quotations', icon: ClipboardList, label: 'Quotations' },
  { to: '/proforma', icon: FileCheck, label: 'Proforma' },
  { to: '/receipts', icon: BadgeCheck, label: 'Receipts' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/gst-summary', icon: BarChart2, label: 'GST Summary' },
  { to: '/gst-filing', icon: FileCog, label: 'GST Filing' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function MobileNav() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const isDrawerRouteActive = drawerLinks.some((l) => location.pathname === l.to);

  return (
    <>
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* More drawer — slides up from above the tab bar */}
      <div
        className={`md:hidden fixed left-0 right-0 bg-white border-t border-gray-200 z-50 transition-transform duration-200 ease-out ${
          drawerOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ bottom: 64 }}
      >
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <p
              className="text-gray-400 font-medium uppercase"
              style={{ fontSize: 10, letterSpacing: '0.08em' }}
            >
              More
            </p>
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {drawerLinks.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-center transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <Icon size={20} />
                <span className="text-xs font-medium leading-tight">{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-bottom">
        <div className="flex items-center justify-around px-1 py-1">
          {primaryTabs.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors flex-1 ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`
              }
            >
              <Icon size={22} />
              <span className="text-xs font-medium">{label}</span>
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors flex-1 ${
              drawerOpen || isDrawerRouteActive ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <Menu size={22} />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
