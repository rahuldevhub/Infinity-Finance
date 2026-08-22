import { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Download, X, Search,
  Scale, PiggyBank, Wallet, ArrowUpRight, ArrowDownRight, ArrowDown, ArrowUp,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format } from 'date-fns';
import { animate } from 'framer-motion';
import { useCashFlow } from '../hooks/useCashFlow';
import type { CashTransaction } from '../hooks/useCashFlow';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { BottomSheet } from '../components/ui/BottomSheet';
import { formatCurrency, formatDate, getMonthRange, getMonthLabel, toLocalDateString } from '../utils/formatters';

// ─── Design tokens (page-scoped — Cash Flow uses green as its primary accent) ─

const GREEN = '#16a34a';
const GREEN_SOFT = '#ecfdf3';
const RED = '#dc2626';
const RED_SOFT = '#fef2f2';
const INK = '#172033';

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

// ─── Local date parsing (avoid UTC-shift bugs — see formatters.ts) ────────────

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

// ─── Count-up number (respects prefers-reduced-motion) ────────────────────────

function CountUp({ value, negative = false }: { value: number; negative?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const render = (v: number) => {
      node.textContent = `${negative && v < 0 ? '−' : ''}${formatCurrency(Math.abs(v))}`;
    };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) { render(value); return; }
    render(0);
    const controls = animate(0, value, { duration: 0.6, ease: 'easeOut', onUpdate: render });
    return () => controls.stop();
  }, [value, negative]);
  return <span ref={ref} />;
}

// ─── Chart data point — Date / Money In / Money Out / Running Balance ─────────

interface DayPoint {
  day: number;
  label: string;
  fullLabel: string;
  In: number;
  Out: number;
  Balance: number;
}

// ─── Summary strip item ────────────────────────────────────────────────────────

function SummaryItem({
  Icon, label, value, negative, valueColor,
}: {
  Icon: React.ElementType;
  label: string;
  value: number;
  negative?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-4 shrink-0 min-w-[168px] sm:min-w-0 sm:flex-1 snap-start">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        <Icon size={12} className="opacity-60" /> {label}
      </span>
      <span className="text-xl font-extrabold" style={{ color: valueColor ?? INK, fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.02em' }}>
        <CountUp value={value} negative={negative} />
      </span>
    </div>
  );
}

// ─── Summary row (Cash Flow Summary rail panel) ────────────────────────────────

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-bold" style={{ color: color ?? INK }}>{value}</span>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date-desc');

  // ── Mobile-only UI state (bottom sheets) ──────────────────────────────────
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [actionTxn, setActionTxn] = useState<CashTransaction | null>(null);
  const mobileFilterCount = [filterCategory !== '', filterMode !== '', sortBy !== 'date-desc'].filter(Boolean).length;

  const hasActiveFilters = filterType !== 'all' || filterCategory !== '' || filterMode !== '' || searchQuery !== '' || sortBy !== 'date-desc';

  function resetFilters() {
    setFilterType('all');
    setFilterCategory('');
    setFilterMode('');
    setSearchQuery('');
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

  function jumpToThisMonth() {
    resetFilters();
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();

  // ── Summary calculations (always from full month data) ────────────────────

  const totalIn = transactions.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const netProfit = totalIn - totalOut;
  const closingBalance = openingBalance + netProfit;

  // ── Daily series: Inflow / Outflow bars + running Balance line ────────────

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lastDay = isCurrentMonth ? Math.min(daysInMonth, today.getDate()) : daysInMonth;

  const perDay: Record<number, { in: number; out: number }> = {};
  transactions.forEach((t) => {
    const d = parseLocalDate(t.date).getDate();
    if (!perDay[d]) perDay[d] = { in: 0, out: 0 };
    perDay[d][t.type] += t.amount;
  });

  let running = openingBalance;
  const series: DayPoint[] = Array.from({ length: lastDay }, (_, i) => {
    const day = i + 1;
    const dIn = perDay[day]?.in ?? 0;
    const dOut = perDay[day]?.out ?? 0;
    running += dIn - dOut;
    const dateObj = new Date(year, month, day);
    return {
      day,
      label: format(dateObj, 'd MMM'),
      fullLabel: format(dateObj, 'd MMM yyyy'),
      In: dIn,
      Out: dOut,
      Balance: running,
    };
  });
  const lastPointIndex = series.length - 1;

  // ── Top transactions ────────────────────────────────────────────────────

  const topInflow = transactions.filter((t) => t.type === 'in').reduce<CashTransaction | null>((max, t) => (!max || t.amount > max.amount ? t : max), null);
  const topOutflow = transactions.filter((t) => t.type === 'out').reduce<CashTransaction | null>((max, t) => (!max || t.amount > max.amount ? t : max), null);

  // ── Filtered + sorted transactions ────────────────────────────────────────

  let filteredTransactions = [...transactions];
  if (filterType !== 'all') filteredTransactions = filteredTransactions.filter((t) => t.type === filterType);
  if (filterCategory) filteredTransactions = filteredTransactions.filter((t) => t.category === filterCategory);
  if (filterMode) filteredTransactions = filteredTransactions.filter((t) => t.payment_mode === filterMode);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filteredTransactions = filteredTransactions.filter((t) =>
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      (t.reference ?? '').toLowerCase().includes(q)
    );
  }

  filteredTransactions.sort((a, b) => {
    switch (sortBy) {
      case 'date-asc':    return a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at);
      case 'date-desc':   return b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at);
      case 'amount-asc':  return a.amount - b.amount;
      case 'amount-desc': return b.amount - a.amount;
    }
  });

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
        subtitle="Track your money in, money out and running balance."
        actions={
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-opacity hover:opacity-90"
            style={{ background: GREEN }}
          >
            <Plus size={16} /> <span className="hidden sm:inline">Add Transaction</span>
          </button>
        }
      />

      <div className="px-4 md:px-6 py-6 space-y-6">

        {/* ================================================================
            MOBILE — purpose-built Cash Flow experience (< md)
        ================================================================= */}
        <div className="md:hidden space-y-4">

          {/* Period controls */}
          <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-1.5 py-1 shadow-sm">
            <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 active:bg-gray-100 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <span className="flex-1 text-sm font-semibold text-gray-800 text-center select-none">
              {getMonthLabel(year, month)}
            </span>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 active:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isCurrentMonth ? (
              <span className="flex-1 text-center text-xs font-semibold px-3 py-2.5 rounded-xl" style={{ background: GREEN_SOFT, color: GREEN }}>
                This Month
              </span>
            ) : (
              <button
                onClick={jumpToThisMonth}
                className="flex-1 text-xs font-semibold px-3 py-2.5 rounded-xl bg-gray-100 text-gray-600 active:bg-gray-200 transition-colors"
              >
                Jump to This Month
              </button>
            )}
            <button
              onClick={exportCSV}
              disabled={filteredTransactions.length === 0}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-600 active:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Download size={14} /> Export
            </button>
          </div>

          {/* Closing balance — hero metric */}
          {loading ? (
            <div className="h-[132px] card-surface animate-pulse" />
          ) : (
            <div className="card-surface p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Closing Balance</p>
              <p className="text-[32px] leading-tight font-extrabold mt-1" style={{ color: INK, fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.02em' }}>
                <CountUp value={closingBalance} negative />
              </p>
              <p className="text-xs font-semibold mt-1.5" style={{ color: netProfit >= 0 ? GREEN : RED }}>
                {netProfit >= 0 ? '+' : '−'}{formatCurrency(Math.abs(netProfit))} net this month
              </p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <span className="text-xs text-gray-400">Opening balance</span>
                <span className="text-xs font-semibold text-gray-500">{formatCurrency(openingBalance)}</span>
              </div>
            </div>
          )}

          {/* Money in / out */}
          {!loading && (
            <div className="grid grid-cols-2 gap-3">
              <div className="card-surface p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Money In</p>
                <p className="text-xl font-extrabold mt-1" style={{ color: GREEN, fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.02em' }}>
                  {formatCurrency(totalIn)}
                </p>
              </div>
              <div className="card-surface p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Money Out</p>
                <p className="text-xl font-extrabold mt-1" style={{ color: RED, fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.02em' }}>
                  {formatCurrency(totalOut)}
                </p>
              </div>
            </div>
          )}

          {/* Cash Movement chart */}
          {loading ? (
            <div className="h-[280px] card-surface animate-pulse" />
          ) : (
            <div className="card-surface p-4">
              <h3 className="text-sm font-semibold" style={{ color: INK }}>Cash Movement</h3>
              <p className="text-xs text-gray-400 mb-2">Running balance this month</p>
              {series.length > 0 ? (
                <div style={{ height: 230 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 18, right: 6, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="balanceGradientMobile" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GREEN} stopOpacity={0.24} />
                          <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} minTickGap={32} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={38} />
                      <Tooltip
                        contentStyle={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                        formatter={(val) => ['₹' + Number(val).toLocaleString('en-IN'), 'Balance']}
                      />
                      <Area
                        type="monotone"
                        dataKey="Balance"
                        stroke={GREEN}
                        strokeWidth={2.5}
                        fill="url(#balanceGradientMobile)"
                        label={(props: { x?: number | string; y?: number | string; index?: number }) => {
                          if (props.index !== lastPointIndex || props.x === undefined || props.y === undefined) return <g />;
                          const bal = series[lastPointIndex].Balance;
                          const text = `${bal < 0 ? '−' : ''}${formatCurrency(Math.abs(bal))}`;
                          return (
                            <text
                              x={Number(props.x)}
                              y={Number(props.y) - 14}
                              textAnchor="end"
                              fontSize={11}
                              fontWeight={700}
                              fill={GREEN}
                              style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 4 }}
                            >
                              {text}
                            </text>
                          );
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ height: 230 }} className="flex items-center justify-center">
                  <p className="text-sm text-gray-400">No transactions in {getMonthLabel(year, month)}</p>
                </div>
              )}
            </div>
          )}

          {/* Cash Flow Summary — compact rows */}
          {!loading && (
            <div className="card-surface p-4">
              <h3 className="text-sm font-semibold mb-1" style={{ color: INK }}>Cash Flow Summary</h3>
              <div className="divide-y divide-gray-50">
                <SummaryRow label="Money In" value={formatCurrency(totalIn)} color={GREEN} />
                <SummaryRow label="Money Out" value={formatCurrency(totalOut)} color={RED} />
                <SummaryRow label="Net Profit" value={`${netProfit < 0 ? '−' : ''}${formatCurrency(Math.abs(netProfit))}`} color={netProfit >= 0 ? GREEN : RED} />
                <SummaryRow label="Closing Balance" value={`${closingBalance < 0 ? '−' : ''}${formatCurrency(Math.abs(closingBalance))}`} />
              </div>
            </div>
          )}

          {/* Top Transactions */}
          {!loading && (topInflow || topOutflow) && (
            <div className="card-surface p-4">
              <h3 className="text-sm font-semibold mb-3" style={{ color: INK }}>Top Transactions</h3>
              <div className="space-y-2">
                {topInflow && (
                  <div className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: GREEN_SOFT }}>
                    <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: '#fff' }}>
                      <ArrowDown size={14} style={{ color: GREEN }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: GREEN }}>Largest Inflow</p>
                      <p className="text-sm font-semibold text-gray-800 truncate">{topInflow.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold" style={{ color: GREEN }}>{formatCurrency(topInflow.amount)}</p>
                      <p className="text-[10px] text-gray-400">{formatDate(topInflow.date)}</p>
                    </div>
                  </div>
                )}
                {topOutflow && (
                  <div className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: RED_SOFT }}>
                    <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: '#fff' }}>
                      <ArrowUp size={14} style={{ color: RED }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: RED }}>Largest Outflow</p>
                      <p className="text-sm font-semibold text-gray-800 truncate">{topOutflow.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold" style={{ color: RED }}>{formatCurrency(topOutflow.amount)}</p>
                      <p className="text-[10px] text-gray-400">{formatDate(topOutflow.date)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="space-y-2.5">
            <div className="flex gap-1.5">
              {(['all', 'in', 'out'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setFilterType(v)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    filterType === v ? 'text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                  }`}
                  style={filterType === v ? { background: GREEN } : undefined}
                >
                  {v === 'all' ? 'All' : v === 'in' ? 'Inflow' : 'Outflow'}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transactions..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-100 focus:border-green-300"
              />
            </div>

            <button
              onClick={() => setShowMobileFilters(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 active:bg-gray-50 transition-colors"
            >
              <SlidersHorizontal size={14} /> Filters{mobileFilterCount > 0 ? ` • ${mobileFilterCount}` : ''}
            </button>
          </div>

          {/* Recent Transactions */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-2 px-0.5">Recent Transactions</h3>
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="card-surface p-3.5 flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-gray-100 rounded w-2/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                  </div>
                ))
              ) : filteredTransactions.length === 0 ? (
                transactions.length === 0 ? (
                  <div className="card-surface flex flex-col items-center gap-3 py-12 px-4 text-center">
                    <span className="text-4xl">💸</span>
                    <p className="text-gray-700 font-semibold">No transactions in {getMonthLabel(year, month)}</p>
                    <button
                      onClick={openAddForm}
                      className="mt-1 inline-flex items-center gap-2 px-4 py-2.5 text-white rounded-lg text-sm font-medium active:opacity-90 transition-opacity"
                      style={{ background: GREEN }}
                    >
                      <Plus size={14} /> Add Transaction
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 text-sm py-10">No transactions match the current filters.</p>
                )
              ) : (
                filteredTransactions.map((t) => (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActionTxn(t)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActionTxn(t); } }}
                    className="card-surface flex items-center gap-3 p-3.5 active:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <span
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: t.type === 'in' ? GREEN_SOFT : RED_SOFT }}
                    >
                      {t.type === 'in'
                        ? <ArrowDown size={16} style={{ color: GREEN }} />
                        : <ArrowUp size={16} style={{ color: RED }} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 text-sm truncate">{t.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{t.category}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{t.payment_mode.toUpperCase()} · {formatDate(t.date)}</p>
                    </div>
                    <p className="font-bold text-sm whitespace-nowrap shrink-0" style={{ color: t.type === 'in' ? GREEN : RED }}>
                      {t.type === 'out' && '−'}{formatCurrency(t.amount)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ================================================================
            DESKTOP — existing Cash Flow layout, unchanged
        ================================================================= */}
        <div className="hidden md:block space-y-6">

        {/* Period controls */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm">
              <button onClick={prevMonth} className="text-gray-400 hover:text-gray-700 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-gray-800 min-w-[120px] text-center select-none">
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
            {isCurrentMonth ? (
              <span className="text-xs font-semibold px-3 py-2 rounded-xl" style={{ background: GREEN_SOFT, color: GREEN }}>
                This Month
              </span>
            ) : (
              <button
                onClick={jumpToThisMonth}
                className="text-xs font-semibold px-3 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Jump to This Month
              </button>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredTransactions.length === 0}>
            <Download size={14} /> Export CSV
          </Button>
        </div>

        {/* Financial Summary Strip — one unified panel */}
        {loading ? (
          <div className="h-[92px] card-surface animate-pulse" />
        ) : (
          <div className="card-surface flex overflow-x-auto sm:overflow-visible divide-x divide-gray-100 snap-x snap-mandatory">
            <SummaryItem Icon={Scale} label="Opening Balance" value={openingBalance} negative />
            <SummaryItem Icon={ArrowUpRight} label="Total Inflow" value={totalIn} valueColor={GREEN} />
            <SummaryItem Icon={ArrowDownRight} label="Total Outflow" value={totalOut} valueColor={RED} />
            <SummaryItem Icon={PiggyBank} label="Net Profit" value={netProfit} negative valueColor={netProfit >= 0 ? GREEN : RED} />
            <SummaryItem Icon={Wallet} label="Closing Balance" value={closingBalance} negative valueColor={INK} />
          </div>
        )}

        {/* Cash Movement chart + supporting insights */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-5">
            <div className="card-surface animate-pulse" />
            <div className="flex flex-col gap-5">
              <div className="h-[220px] card-surface animate-pulse" />
              <div className="h-[190px] card-surface animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-5">

            {/* Cash Movement */}
            <div className="card-surface p-6 flex flex-col">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <h3 className="text-base font-semibold" style={{ color: INK }}>Cash Movement</h3>
              </div>

              {series.length > 0 ? (
                <div className="flex-1 min-h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 12, right: 28, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GREEN} stopOpacity={0.24} />
                          <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={44} />
                      <Tooltip
                        contentStyle={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                        formatter={(val) => ['₹' + Number(val).toLocaleString('en-IN'), 'Balance']}
                      />
                      <Area
                        type="monotone"
                        dataKey="Balance"
                        stroke={GREEN}
                        strokeWidth={2.5}
                        fill="url(#balanceGradient)"
                        label={(props: { x?: number | string; y?: number | string; index?: number }) => {
                          if (props.index !== lastPointIndex || props.x === undefined || props.y === undefined) return <g />;
                          const bal = series[lastPointIndex].Balance;
                          const text = `${bal < 0 ? '−' : ''}${formatCurrency(Math.abs(bal))}`;
                          return (
                            <text
                              x={Number(props.x)}
                              y={Number(props.y) - 14}
                              textAnchor="end"
                              fontSize={11}
                              fontWeight={700}
                              fill={GREEN}
                              style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 4 }}
                            >
                              {text}
                            </text>
                          );
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 min-h-[260px] flex items-center justify-center">
                  <p className="text-sm text-gray-400">No transactions in {getMonthLabel(year, month)}</p>
                </div>
              )}
            </div>

            {/* Right rail */}
            <div className="flex flex-col gap-5">

              {/* Cash Flow Summary */}
              <div className="card-surface p-5">
                <h3 className="text-sm font-semibold mb-1" style={{ color: INK }}>Cash Flow Summary</h3>
                <div className="divide-y divide-gray-50">
                  <SummaryRow label="Money In" value={formatCurrency(totalIn)} color={GREEN} />
                  <SummaryRow label="Money Out" value={formatCurrency(totalOut)} color={RED} />
                  <SummaryRow label="Net Profit" value={`${netProfit < 0 ? '−' : ''}${formatCurrency(Math.abs(netProfit))}`} color={netProfit >= 0 ? GREEN : RED} />
                  <SummaryRow label="Closing Balance" value={`${closingBalance < 0 ? '−' : ''}${formatCurrency(Math.abs(closingBalance))}`} />
                </div>
              </div>

              {/* Top Transactions */}
              <div className="card-surface p-5">
                <h3 className="text-sm font-semibold mb-3" style={{ color: INK }}>Top Transactions</h3>
                <div className="space-y-2">
                  {topInflow && (
                    <div className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: GREEN_SOFT }}>
                      <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: '#fff' }}>
                        <ArrowDown size={14} style={{ color: GREEN }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: GREEN }}>Largest Inflow</p>
                        <p className="text-sm font-semibold text-gray-800 truncate">{topInflow.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold" style={{ color: GREEN }}>{formatCurrency(topInflow.amount)}</p>
                        <p className="text-[10px] text-gray-400">{formatDate(topInflow.date)}</p>
                      </div>
                    </div>
                  )}
                  {topOutflow && (
                    <div className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: RED_SOFT }}>
                      <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: '#fff' }}>
                        <ArrowUp size={14} style={{ color: RED }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: RED }}>Largest Outflow</p>
                        <p className="text-sm font-semibold text-gray-800 truncate">{topOutflow.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold" style={{ color: RED }}>{formatCurrency(topOutflow.amount)}</p>
                        <p className="text-[10px] text-gray-400">{formatDate(topOutflow.date)}</p>
                      </div>
                    </div>
                  )}
                  {!topInflow && !topOutflow && (
                    <p className="text-xs text-gray-400 py-2">No transactions this month.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-100">
            <CardTitle>Recent Transactions</CardTitle>
          </div>

          {/* Filter / Search Bar */}
          <div className="px-6 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-2 flex-wrap items-stretch sm:items-center">
            <div className="flex gap-1.5 shrink-0">
              {(['all', 'in', 'out'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setFilterType(v)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    filterType === v ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={filterType === v ? { background: GREEN } : undefined}
                >
                  {v === 'all' ? 'All' : v === 'in' ? 'Inflow' : 'Outflow'}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[160px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transactions..."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-700 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-100 focus:border-green-300 shadow-sm"
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-100 shadow-sm"
            >
              <option value="">All Categories</option>
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-100 shadow-sm"
            >
              <option value="">All Modes</option>
              {PAYMENT_MODES.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-100 shadow-sm"
            >
              <option value="date-desc">Date: Newest First</option>
              <option value="date-asc">Date: Oldest First</option>
              <option value="amount-desc">Amount: Highest First</option>
              <option value="amount-asc">Amount: Lowest First</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: GREEN }}
              >
                <X size={12} /> Reset filters
              </button>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mode</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <>
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} className="group hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 text-gray-500 whitespace-nowrap text-sm">{formatDate(t.date)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span
                              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                              style={{ background: t.type === 'in' ? GREEN_SOFT : RED_SOFT }}
                            >
                              {t.type === 'in'
                                ? <ArrowDown size={14} style={{ color: GREEN }} />
                                : <ArrowUp size={14} style={{ color: RED }} />}
                            </span>
                            <p className="font-medium text-gray-800 max-w-[240px] truncate">{t.description}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600">{t.category}</td>
                        <td className="px-5 py-4">
                          <span className="text-[10px] font-semibold uppercase bg-gray-50 border border-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                            {t.payment_mode}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-base whitespace-nowrap" style={{ color: t.type === 'in' ? GREEN : RED }}>
                          {t.type === 'out' && '−'}{formatCurrency(t.amount)}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(t)}
                              className="p-1 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
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

                    {filteredTransactions.length === 0 && transactions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <span className="text-5xl">💸</span>
                            <p className="text-gray-600 font-semibold text-base">No transactions in {getMonthLabel(year, month)}</p>
                            <button
                              onClick={openAddForm}
                              className="mt-1 inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
                              style={{ background: GREEN }}
                            >
                              <Plus size={14} /> Add Transaction
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {filteredTransactions.length === 0 && transactions.length > 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                  style={form.payment_mode === pm.value ? { background: GREEN, borderColor: GREEN } : undefined}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
          <Button type="submit" className="w-full" loading={submitting} style={{ background: GREEN }}>
            {editingTransaction ? 'Update Transaction' : 'Add Transaction'}
          </Button>
        </form>
      </Modal>

      {/* Mobile filters bottom sheet */}
      <BottomSheet open={showMobileFilters} onClose={() => setShowMobileFilters(false)} title="Filters">
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-100"
            >
              <option value="">All Categories</option>
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Payment Mode</label>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-100"
            >
              <option value="">All Modes</option>
              {PAYMENT_MODES.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Sort</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-100"
            >
              <option value="date-desc">Date: Newest First</option>
              <option value="date-asc">Date: Oldest First</option>
              <option value="amount-desc">Amount: Highest First</option>
              <option value="amount-asc">Amount: Lowest First</option>
            </select>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: GREEN }}
            >
              <X size={12} /> Reset all filters
            </button>
          )}
          <Button onClick={() => setShowMobileFilters(false)} className="w-full" style={{ background: GREEN }}>
            Apply Filters
          </Button>
        </div>
      </BottomSheet>

      {/* Transaction details / actions bottom sheet */}
      <BottomSheet open={!!actionTxn} onClose={() => setActionTxn(null)} title="Transaction Details">
        {actionTxn && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span
                className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                style={{ background: actionTxn.type === 'in' ? GREEN_SOFT : RED_SOFT }}
              >
                {actionTxn.type === 'in'
                  ? <ArrowDown size={18} style={{ color: GREEN }} />
                  : <ArrowUp size={18} style={{ color: RED }} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 truncate">{actionTxn.description}</p>
                <p className="text-xs text-gray-400">{actionTxn.category}</p>
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 divide-y divide-gray-100">
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-xs text-gray-500">Amount</span>
                <span className="text-sm font-bold" style={{ color: actionTxn.type === 'in' ? GREEN : RED }}>
                  {actionTxn.type === 'out' && '−'}{formatCurrency(actionTxn.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-xs text-gray-500">Date</span>
                <span className="text-sm font-semibold text-gray-700">{formatDate(actionTxn.date)}</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-xs text-gray-500">Payment Mode</span>
                <span className="text-sm font-semibold text-gray-700">{actionTxn.payment_mode.toUpperCase()}</span>
              </div>
              {actionTxn.reference && (
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-xs text-gray-500">Reference</span>
                  <span className="text-sm font-semibold text-gray-700">{actionTxn.reference}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { const t = actionTxn; setActionTxn(null); openEdit(t); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 active:bg-gray-50 transition-colors"
              >
                <Pencil size={15} /> Edit
              </button>
              <button
                onClick={() => { const id = actionTxn.id; setActionTxn(null); handleDelete(id); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white active:opacity-90 transition-opacity"
                style={{ background: RED }}
              >
                <Trash2 size={15} /> Delete
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
