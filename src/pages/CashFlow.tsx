import { useState } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Download, X,
  TrendingUp, TrendingDown, Wallet, Banknote, CreditCard, Scale, PiggyBank,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useCashFlow } from '../hooks/useCashFlow';
import type { CashTransaction } from '../hooks/useCashFlow';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../context/WorkspaceContext';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Card, CardTitle } from '../components/ui/Card';
import { CompactMetric } from '../components/dashboard/DashboardCards';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, formatDate, getMonthRange, getMonthLabel, toLocalDateString } from '../utils/formatters';

// ─── Constants ────────────────────────────────────────────────────────────────

const IN_CATEGORIES = [
  'Client Payment',
  'Advance Received',
  'Personal Transfer In',
  'Loan Received',
  'Investment',
  'Other Income',
];

const OUT_CATEGORIES = [
  'Vendor Payment',
  'Salary',
  'Rent',
  'Travel',
  'Office Expense',
  'Personal Withdrawal',
  'Tax Payment',
  'Investment',
  'Other Expense',
];

const ALL_CATEGORIES = Array.from(new Set([...IN_CATEGORIES, ...OUT_CATEGORIES])).sort();

const SUB_BRANDS = ['Ritera Publishing', 'Ratixinfo Tech', 'Personal'];

const PAYMENT_MODES: Array<{ value: CashTransaction['payment_mode']; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'razorpay', label: 'Razorpay' },
];

type SortBy = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

// ─── Payment mode badges — colored pills ──────────────────────────────────────

function paymentModeBadge(mode: CashTransaction['payment_mode']) {
  switch (mode) {
    case 'cash':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">CASH</span>;
    case 'bank':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">BANK</span>;
    case 'upi':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">UPI</span>;
    case 'card':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">CARD</span>;
    case 'razorpay':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-700">RAZORPAY</span>;
  }
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-gray-700 mb-1">Day {label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Empty form state factory ─────────────────────────────────────────────────

function defaultForm() {
  return {
    date: toLocalDateString(),
    type: 'in' as CashTransaction['type'],
    category: IN_CATEGORIES[0],
    description: '',
    amount: '',
    payment_mode: 'upi' as CashTransaction['payment_mode'],
    reference: '',
    sub_brand: '',
  };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CashFlow() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const accent = workspace.accent;

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const { start, end } = getMonthRange(year, month);
  const { transactions, loading, openingBalance, createTransaction, updateTransaction, deleteTransaction } = useCashFlow({ start, end });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<CashTransaction | null>(null);

  // ── Filter / sort state ───────────────────────────────────────────────────

  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date-desc');

  const hasActiveFilters = filterType !== 'all' || filterCategory !== '' || filterMode !== '' || sortBy !== 'date-desc';

  function resetFilters() {
    setFilterType('all');
    setFilterCategory('');
    setFilterMode('');
    setSortBy('date-desc');
  }

  // ── Month navigation ─────────────────────────────────────────────────────

  function prevMonth() {
    resetFilters();
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())) return;
    resetFilters();
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();

  // ── Summary calculations (always from full month data) ────────────────────

  const totalIn = transactions.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const netBalance = openingBalance + totalIn - totalOut;
  const netProfit = totalIn - totalOut;
  const totalCash = transactions.filter((t) => t.payment_mode === 'cash').reduce((s, t) => s + t.amount, 0);
  const totalDigital = transactions
    .filter((t) => ['bank', 'upi', 'card', 'razorpay'].includes(t.payment_mode))
    .reduce((s, t) => s + t.amount, 0);

  // ── Chart data (full month data) ──────────────────────────────────────────

  const dailyMap: Record<number, { in: number; out: number }> = {};
  transactions.forEach((t) => {
    const day = new Date(t.date).getDate();
    if (!dailyMap[day]) dailyMap[day] = { in: 0, out: 0 };
    dailyMap[day][t.type] += t.amount;
  });
  const chartData = Object.keys(dailyMap)
    .map(Number)
    .sort((a, b) => a - b)
    .map((day) => ({
      day,
      In: dailyMap[day].in,
      Out: dailyMap[day].out,
    }));

  // ── Filtered + sorted transactions ────────────────────────────────────────

  let filteredTransactions = [...transactions];
  if (filterType !== 'all') filteredTransactions = filteredTransactions.filter((t) => t.type === filterType);
  if (filterCategory) filteredTransactions = filteredTransactions.filter((t) => t.category === filterCategory);
  if (filterMode) filteredTransactions = filteredTransactions.filter((t) => t.payment_mode === filterMode);

  filteredTransactions.sort((a, b) => {
    switch (sortBy) {
      case 'date-asc':    return a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at);
      case 'date-desc':   return b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at);
      case 'amount-asc':  return a.amount - b.amount;
      case 'amount-desc': return b.amount - a.amount;
    }
  });

  const showBalRow = filterType === 'all' && openingBalance !== 0;

  // ── CSV Export (filtered data) ────────────────────────────────────────────

  function exportCSV() {
    const headers = ['Date', 'Type', 'Category', 'Description', 'Payment Mode', 'Amount', 'Reference', 'Sub Brand'];
    const rows = filteredTransactions.map((t) => [
      t.date,
      t.type,
      t.category,
      `"${t.description.replace(/"/g, '""')}"`,
      t.payment_mode,
      t.amount,
      t.reference ?? '',
      t.sub_brand ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash_flow_${getMonthLabel(year, month).replace(' ', '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Form helpers ──────────────────────────────────────────────────────────

  function handleTypeChange(type: CashTransaction['type']) {
    setForm((f) => ({
      ...f,
      type,
      category: type === 'in' ? IN_CATEGORIES[0] : OUT_CATEGORIES[0],
    }));
  }

  function openEdit(t: CashTransaction) {
    setForm({
      date: t.date,
      type: t.type,
      category: t.category,
      description: t.description,
      amount: String(t.amount),
      payment_mode: t.payment_mode,
      reference: t.reference ?? '',
      sub_brand: t.sub_brand ?? '',
    });
    setEditingTransaction(t);
    setFormError('');
    setShowForm(true);
  }

  function closeModal() {
    setShowForm(false);
    setFormError('');
    setEditingTransaction(null);
  }

  function openAddForm() {
    setForm(defaultForm());
    setEditingTransaction(null);
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.description.trim()) { setFormError('Description is required.'); return; }
    const amount = parseFloat(form.amount as string);
    if (isNaN(amount) || amount <= 0) { setFormError('Enter a valid amount greater than 0.'); return; }

    setSubmitting(true);
    try {
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, {
          date: form.date,
          type: form.type,
          category: form.category,
          description: form.description.trim(),
          amount,
          payment_mode: form.payment_mode,
          reference: form.reference.trim() || null,
          sub_brand: form.sub_brand || null,
          created_by: editingTransaction.created_by,
        });
      } else {
        await createTransaction({
          date: form.date,
          type: form.type,
          category: form.category,
          description: form.description.trim(),
          amount,
          payment_mode: form.payment_mode,
          reference: form.reference.trim() || null,
          sub_brand: form.sub_brand || null,
          created_by: user?.id ?? '',
        });
      }
      closeModal();
      setForm(defaultForm());
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save transaction.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this transaction?')) return;
    deleteTransaction(id).catch(() => {});
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <TopBar
        title="Cash Flow"
        actions={
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-opacity hover:opacity-90"
            style={{ background: accent }}
          >
            <Plus size={16} /> Add Transaction
          </button>
        }
      />

      <div className="px-4 md:px-6 py-6 space-y-6">

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm w-fit">
          <button onClick={prevMonth} className="text-gray-400 hover:text-gray-700 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-gray-800 min-w-[130px] text-center select-none">
            {getMonthLabel(year, month)}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* ── Overview: hero chart + compact metric rail ── */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-5">
            <div className="h-[360px] card-surface animate-pulse" />
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[78px] card-surface animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-5">

            {/* Hero — Net Balance + daily chart */}
            <div className="card-surface p-6 flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Wallet size={13} style={{ color: netBalance >= 0 ? '#16a34a' : '#dc2626' }} /> Net Balance
                  </p>
                  <div className="flex items-end gap-3 mt-1.5">
                    <span
                      className="text-3xl font-extrabold"
                      style={{ fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.03em', color: netBalance >= 0 ? '#16a34a' : '#b91c1c' }}
                    >
                      {netBalance < 0 && '−'}{formatCurrency(Math.abs(netBalance))}
                    </span>
                    <span
                      className="mb-1 inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full"
                      style={netBalance >= 0
                        ? { background: '#dcfce7', color: '#16a34a' }
                        : { background: '#fef2f2', color: '#b91c1c' }}
                    >
                      {netBalance >= 0 ? 'SURPLUS' : 'DEFICIT'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Scale size={12} /> Opening {openingBalance < 0 && '−'}{formatCurrency(Math.abs(openingBalance))}</span>
                    <span>In <span className="font-semibold text-green-600">{formatCurrency(totalIn)}</span></span>
                    <span>Out <span className="font-semibold text-red-600">{formatCurrency(totalOut)}</span></span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-semibold text-gray-500">Daily Cash Flow</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 justify-end">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />In</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />Out</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex-1 min-h-[240px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" />
                          <stop offset="100%" stopColor="#16a34a" />
                        </linearGradient>
                        <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f87171" />
                          <stop offset="100%" stopColor="#dc2626" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={48} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f9fafb' }} />
                      <Bar dataKey="In" fill="url(#gradIn)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                      <Bar dataKey="Out" fill="url(#gradOut)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[240px]">
                    <p className="text-sm text-gray-400">No transactions in {getMonthLabel(year, month)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Compact metric rail */}
            <div className="flex flex-col gap-4">
              <CompactMetric Icon={TrendingUp} iconBg="#f0fdf4" iconColor="#16a34a" label="Money In" value={formatCurrency(totalIn)} valueColor="#16a34a" />
              <CompactMetric Icon={TrendingDown} iconBg="#fef2f2" iconColor="#dc2626" label="Money Out" value={formatCurrency(totalOut)} valueColor="#dc2626" />
              <CompactMetric
                Icon={PiggyBank}
                iconBg={netProfit >= 0 ? '#f0fdf4' : '#fef2f2'}
                iconColor={netProfit >= 0 ? '#16a34a' : '#dc2626'}
                label="Net Profit"
                value={`${netProfit < 0 ? '−' : ''}${formatCurrency(Math.abs(netProfit))}`}
                valueColor={netProfit >= 0 ? '#16a34a' : '#dc2626'}
              />
              <CompactMetric Icon={Banknote} iconBg="#fffbeb" iconColor="#d97706" label="Cash" value={formatCurrency(totalCash)} />
              <CompactMetric Icon={CreditCard} iconBg="#f0f9ff" iconColor="#0ea5e9" label="Digital" value={formatCurrency(totalDigital)} />
            </div>
          </div>
        )}

        {/* Transactions Table */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Transactions</CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredTransactions.length === 0}>
              <Download size={14} /> Export CSV
            </Button>
          </div>

          {/* Filter / Sort Bar — modern pills */}
          <div className="px-6 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-2 flex-wrap items-start sm:items-center">
            {/* Type pills */}
            <div className="flex gap-1.5 shrink-0">
              {(['all', 'in', 'out'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setFilterType(v)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    filterType === v ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={filterType === v ? { background: accent } : undefined}
                >
                  {v === 'all' ? 'All' : v === 'in' ? 'IN' : 'OUT'}
                </button>
              ))}
            </div>

            {/* Category */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="">All Categories</option>
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Payment mode */}
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="">All Modes</option>
              {PAYMENT_MODES.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="date-desc">Date: Newest First</option>
              <option value="date-asc">Date: Oldest First</option>
              <option value="amount-desc">Amount: Highest First</option>
              <option value="amount-asc">Amount: Lowest First</option>
            </select>

            {/* Reset */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                <X size={12} /> Reset filters
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mode</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sub-brand</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-5 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <>
                    {/* Opening Balance row */}
                    {showBalRow && (
                      <tr className="bg-slate-50">
                        <td className="px-5 py-4 text-gray-500 whitespace-nowrap text-sm border-l-[3px] border-l-slate-300">
                          {formatDate(start)}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">BAL</span>
                        </td>
                        <td className="px-5 py-4 text-gray-500 text-sm">Opening Balance</td>
                        <td className="px-5 py-4 text-gray-400 text-sm">Carried Forward</td>
                        <td className="px-5 py-4 text-gray-300">—</td>
                        <td className="px-5 py-4 text-gray-300 text-xs">—</td>
                        <td className="px-5 py-4 text-gray-300 text-xs">—</td>
                        <td className="px-5 py-4 text-right font-bold whitespace-nowrap text-slate-600">
                          {openingBalance < 0 && '−'}{formatCurrency(Math.abs(openingBalance))}
                        </td>
                        <td className="px-5 py-4 text-center text-gray-300 text-xs">—</td>
                      </tr>
                    )}

                    {/* Regular transaction rows */}
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} className="group hover:bg-gray-50 transition-colors">
                        <td className={`px-5 py-4 text-gray-700 whitespace-nowrap border-l-[3px] ${t.type === 'in' ? 'border-l-green-500' : 'border-l-red-500'}`}>
                          {formatDate(t.date)}
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={t.type === 'in' ? 'green' : 'red'}>
                            {t.type === 'in' ? 'IN' : 'OUT'}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-gray-700">{t.category}</td>
                        <td className="px-5 py-4 text-gray-700 max-w-[200px] truncate">{t.description}</td>
                        <td className="px-5 py-4">{paymentModeBadge(t.payment_mode)}</td>
                        <td className="px-5 py-4 text-gray-500 text-xs">{t.reference ?? '—'}</td>
                        <td className="px-5 py-4 text-gray-500 text-xs">{t.sub_brand ?? '—'}</td>
                        <td className={`px-5 py-4 text-right font-bold text-base whitespace-nowrap ${t.type === 'in' ? 'text-green-700' : 'text-red-700'}`}>
                          {t.type === 'out' && '−'}{formatCurrency(t.amount)}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(t)}
                              className="p-1 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors"
                              title="Edit transaction"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(t.id)}
                              className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                              title="Delete transaction"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {/* Empty states */}
                    {filteredTransactions.length === 0 && showBalRow && (
                      <tr>
                        <td colSpan={9} className="px-6 py-8 text-center text-gray-400 text-sm italic">
                          No transactions recorded this month.
                        </td>
                      </tr>
                    )}
                    {filteredTransactions.length === 0 && !showBalRow && transactions.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <span className="text-5xl">💸</span>
                            <p className="text-gray-600 font-semibold text-base">No transactions in {getMonthLabel(year, month)}</p>
                            <button
                              onClick={openAddForm}
                              className="mt-1 inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
                              style={{ background: accent }}
                            >
                              <Plus size={14} /> Add Transaction
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {filteredTransactions.length === 0 && !showBalRow && transactions.length > 0 && (
                      <tr>
                        <td colSpan={9} className="px-6 py-10 text-center text-gray-400 text-sm">
                          No transactions match the current filters.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Add / Edit Transaction Modal */}
      <Modal
        isOpen={showForm}
        onClose={closeModal}
        title={editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Date */}
          <Input
            label="Date"
            type="date"
            required
            value={form.date}
            max={toLocalDateString(today)}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />

          {/* Type selector */}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Type</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('in')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                  form.type === 'in'
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-green-50 hover:border-green-400'
                }`}
              >
                Money IN
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('out')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                  form.type === 'out'
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-400'
                }`}
              >
                Money OUT
              </button>
            </div>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {(form.type === 'in' ? IN_CATEGORIES : OUT_CATEGORIES).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <Input
            label="Description"
            type="text"
            required
            placeholder="Brief description of transaction"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          {/* Amount */}
          <Input
            label="Amount (₹)"
            type="number"
            required
            min={0.01}
            step={0.01}
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />

          {/* Payment Mode */}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Payment Mode</span>
            <div className="flex gap-2 flex-wrap">
              {PAYMENT_MODES.map((pm) => (
                <button
                  key={pm.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, payment_mode: pm.value }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.payment_mode === pm.value
                      ? 'text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                  style={form.payment_mode === pm.value ? { background: accent, borderColor: accent } : undefined}
                >
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reference */}
          <Input
            label="Reference (optional)"
            type="text"
            placeholder="Cheque no, UPI ID, etc."
            value={form.reference}
            onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
          />

          {/* Sub-brand */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Sub-brand (optional)</label>
            <select
              value={form.sub_brand}
              onChange={(e) => setForm((f) => ({ ...f, sub_brand: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">— None —</option>
              {SUB_BRANDS.map((sb) => (
                <option key={sb} value={sb}>{sb}</option>
              ))}
            </select>
          </div>

          {/* Error */}
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          {/* Submit */}
          <Button type="submit" className="w-full" loading={submitting}>
            {editingTransaction ? 'Update Transaction' : 'Add Transaction'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
