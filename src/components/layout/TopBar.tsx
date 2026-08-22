import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, HelpCircle, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

// Quick-jump destinations for the global search box.
const SEARCH_TARGETS: { label: string; to: string; kind: 'Page' | 'Create' }[] = [
  { label: 'Dashboard', to: '/', kind: 'Page' },
  { label: 'Clients', to: '/clients', kind: 'Page' },
  { label: 'Quotations', to: '/quotations', kind: 'Page' },
  { label: 'Proforma Invoices', to: '/proforma', kind: 'Page' },
  { label: 'Invoices', to: '/invoices', kind: 'Page' },
  { label: 'Payment Receipts', to: '/receipts', kind: 'Page' },
  { label: 'Expenses', to: '/expenses', kind: 'Page' },
  { label: 'Cash Flow', to: '/cash-flow', kind: 'Page' },
  { label: 'GST Summary', to: '/gst-summary', kind: 'Page' },
  { label: 'GST Filing', to: '/gst-filing', kind: 'Page' },
  { label: 'Settings', to: '/settings', kind: 'Page' },
  { label: 'New invoice', to: '/invoices/new', kind: 'Create' },
  { label: 'New quotation', to: '/quotations/new', kind: 'Create' },
  { label: 'New proforma', to: '/proforma/new', kind: 'Create' },
  { label: 'New receipt', to: '/receipts/new', kind: 'Create' },
];

function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = q.trim()
    ? SEARCH_TARGETS.filter((t) => t.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function go(to: string) {
    setQ('');
    setOpen(false);
    navigate(to);
  }

  return (
    <div ref={ref} className="relative hidden md:block w-full max-w-md">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) go(results[0].to);
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Search pages, clients, invoices..."
        className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg shadow-gray-200/60">
          {results.map((r) => (
            <button
              key={r.to}
              onClick={() => go(r.to)}
              className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2.5 text-sm text-gray-700">
                <Search size={14} className="text-gray-400" />
                {r.label}
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.kind === 'Create' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                {r.kind}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && q.trim() && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-400 shadow-lg shadow-gray-200/60">
          No matches for "{q}"
        </div>
      )}
    </div>
  );
}

function ProfileMenu() {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const name = profile?.full_name || user?.email || 'User';
  const role = profile?.role ? profile.role.toUpperCase() : '';

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl pl-1 pr-2 py-1 hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <span className="text-sm font-semibold text-blue-700">{name.charAt(0).toUpperCase()}</span>
        </div>
        <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">{name}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg shadow-gray-200/60">
          <div className="px-3 py-2.5 border-b border-gray-100 mb-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
            {role && <p className="text-[11px] text-gray-400 mt-0.5">{role}</p>}
          </div>
          <button
            onClick={() => { setOpen(false); navigate('/settings'); }}
            className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <SettingsIcon size={16} className="text-gray-400" />
            Settings
          </button>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={16} className="text-gray-400" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-5 md:px-8 py-4 flex items-center gap-4 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-none">
        <div className="md:hidden w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xs">IG</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-gray-500 truncate md:whitespace-normal">{subtitle}</p>}
        </div>
      </div>

      <div className="hidden md:flex flex-1 justify-center px-2">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {actions && <div className="flex items-center gap-2 mr-1">{actions}</div>}
        <button
          className="hidden sm:flex w-9 h-9 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          title="Help"
          type="button"
        >
          <HelpCircle size={18} />
        </button>
        <button
          className="relative hidden sm:flex w-9 h-9 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          title="Notifications"
          type="button"
        >
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500" />
        </button>
        <div className="hidden sm:block w-px h-6 bg-gray-200 mx-1.5" />
        <ProfileMenu />
      </div>
    </header>
  );
}
