import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Download, X, TrendingUp, TrendingDown, Wallet, Banknote, CreditCard } from 'lucide-react';
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
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Card, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, formatDate, getMonthRange, getMonthLabel } from '../utils/formatters';

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

// ─── Helper: payment mode badge ───────────────────────────────────────────────

function paymentModeBadge(mode: CashTransaction['payment_mode']) {
  switch (mode) {
    case 'cash':     return <Badge variant="yellow">CASH</Badge>;
    case 'bank':     return <Badge variant="blue">BANK</Badge>;
    case 'upi':      return <Badge variant="gray">UPI</Badge>;
    case 'card':     return <Badge variant="gray">CARD</Badge>;
    case 'razorpay': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">Razorpay</span>;
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
    date: new Date().toISOString().split('T')[0],
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
  const { transactions, loading, createTransaction, updateTransaction, deleteTransaction } = useCashFlow({ start, end });

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
  const netBalance = totalIn - totalOut;
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
          <Button size="sm" onClick={() => { setForm(defaultForm()); setEditingTransaction(null); setFormError(''); setShowForm(true); }}>
            <Plus size={16} /> Add Transaction
          </Button>
        }
      />

      <div className="px-4 md:px-6 py-6 space-y-6">

        {/* Month Selector */}
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[140px] text-center">
            {getMonthLabel(year, month)}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Summary Cards */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp size={16} />
                <span className="text-xs font-medium text-gray-500">Money In</span>
              </div>
              <p className="text-lg font-bold text-green-700">{formatCurrency(totalIn)}</p>
            </Card>

            <Card className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-red-600">
                <TrendingDown size={16} />
                <span className="text-xs font-medium text-gray-500">Money Out</span>
              </div>
              <p className="text-lg font-bold text-red-700">{formatCurrency(totalOut)}</p>
            </Card>

            <Card className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Wallet size={16} className={netBalance >= 0 ? 'text-blue-600' : 'text-red-600'} />
                <span className="text-xs font-medium text-gray-500">Net Balance</span>
              </div>
              <p className={`text-lg font-bold ${netBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                {formatCurrency(Math.abs(netBalance))}
              </p>
              <Badge variant={netBalance >= 0 ? 'blue' : 'red'}>
                {netBalance >= 0 ? 'Surplus' : 'Deficit'}
              </Badge>
            </Card>

            <Card className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-yellow-600">
                <Banknote size={16} />
                <span className="text-xs font-medium text-gray-500">Cash</span>
              </div>
              <p className="text-lg font-bold text-gray-800">{formatCurrency(totalCash)}</p>
            </Card>

            <Card className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-blue-600">
                <CreditCard size={16} />
                <span className="text-xs font-medium text-gray-500">Digital</span>
              </div>
              <p className="text-lg font-bold text-gray-800">{formatCurrency(totalDigital)}</p>
            </Card>
          </div>
        )}

        {/* Daily Bar Chart */}
        {!loading && chartData.length > 0 && (
          <Card>
            <CardTitle className="mb-4">Daily Cash Flow</CardTitle>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  width={48}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="In" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Out" fill="#dc2626" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Transactions Table */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Transactions</CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredTransactions.length === 0}>
              <Download size={14} /> Export CSV
            </Button>
          </div>

          {/* Filter / Sort Bar */}
          <div className="px-6 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-2 flex-wrap items-start sm:items-center">
            {/* Type pills */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
              {(['all', 'in', 'out'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setFilterType(v)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filterType === v
                      ? v === 'in'
                        ? 'bg-green-600 text-white'
                        : v === 'out'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-700 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {v === 'all' ? 'All' : v === 'in' ? 'IN' : 'OUT'}
                </button>
              ))}
            </div>

            {/* Category */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Payment mode */}
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Modes</option>
              {PAYMENT_MODES.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sub-brand</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-400 text-sm">
                      {transactions.length === 0 ? 'No transactions this month.' : 'No transactions match the current filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(t.date)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={t.type === 'in' ? 'green' : 'red'}>
                          {t.type === 'in' ? 'IN' : 'OUT'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{t.category}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{t.description}</td>
                      <td className="px-4 py-3">{paymentModeBadge(t.payment_mode)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{t.reference ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{t.sub_brand ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${t.type === 'in' ? 'text-green-700' : 'text-red-700'}`}>
                        {t.type === 'out' && '−'}{formatCurrency(t.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
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
                  ))
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
            max={today.toISOString().split('T')[0]}
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
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-400'
                  }`}
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
