import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Download,
  Eye,
  IndianRupee,
  RefreshCw,
  Repeat2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import {
  buildCashFlowAnalysis,
  getComparisonRange,
  getPresetRange,
} from '../domain/cashFlowAnalysis';
import type {
  AnalysisTransaction,
  CashFlowComparisonMode,
  CashFlowDateRange,
  CashFlowPeriodKey,
  RankedCashGroup,
} from '../domain/cashFlowAnalysis';
import { useCashFlowAnalysis } from '../hooks/useCashFlowAnalysis';
import { formatCurrency, formatDate, toLocalDateString } from '../utils/formatters';
import { useWorkspace } from '../context/WorkspaceContext';
import { isCompanyCode } from '../domain/company';

const GREEN = '#15956d';
const GREEN_DARK = '#0c684d';
const GREEN_SOFT = '#eaf8f2';
const RED = '#dc5a5a';
const RED_SOFT = '#fff0ef';
const INK = '#172033';
const CHART_COLORS = ['#15956d', '#5d7df5', '#d4954a', '#8b6fcb', '#5b93a8'];

const PERIOD_OPTIONS: Array<{ value: CashFlowPeriodKey; label: string }> = [
  { value: 'last-7-days', label: 'Last 7 Days' },
  { value: 'last-15-days', label: 'Last 15 Days' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'this-quarter', label: 'This Quarter' },
  { value: 'last-quarter', label: 'Last Quarter' },
  { value: 'last-6-months', label: 'Last 6 Months' },
  { value: 'this-year', label: 'This Year' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
];

const COMPARISON_OPTIONS: Array<{ value: CashFlowComparisonMode; label: string }> = [
  { value: 'none', label: 'No comparison' },
  { value: 'previous', label: 'Previous period' },
  { value: 'last-year', label: 'Same period last year' },
];

function compactCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function signedCurrency(value: number): string {
  return `${value >= 0 ? '+' : '−'}${formatCurrency(Math.abs(value))}`;
}

function ChangeBadge({ value, expense = false }: { value: number | null; expense?: boolean }) {
  if (value === null) return <span className="text-xs font-medium text-gray-400">Not enough historical data</span>;
  const improved = expense ? value <= 0 : value >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold"
      style={{ background: improved ? GREEN_SOFT : RED_SOFT, color: improved ? GREEN_DARK : RED }}
    >
      {value >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h2 className="text-lg font-bold tracking-[-0.02em]" style={{ color: INK }}>{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Metric({ label, value, context, change, expense }: {
  label: string;
  value: string;
  context: string;
  change?: number | null;
  expense?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1 px-5 py-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-xl font-bold tracking-[-0.03em]" style={{ color: INK }}>{value}</p>
        {change !== undefined && <ChangeBadge value={change} expense={expense} />}
      </div>
      <p className="mt-1.5 text-xs text-gray-400">{context}</p>
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="px-4 md:px-7 py-7 space-y-6 animate-pulse" aria-label="Loading cash flow analysis">
      <div className="grid lg:grid-cols-[1.55fr_1fr] gap-5">
        <div className="h-64 rounded-[24px] bg-gray-100" />
        <div className="h-64 rounded-[24px] bg-gray-100" />
      </div>
      <div className="h-28 rounded-[20px] bg-gray-100" />
      <div className="grid lg:grid-cols-[1.7fr_1fr] gap-5">
        <div className="h-[420px] rounded-[24px] bg-gray-100" />
        <div className="h-[420px] rounded-[24px] bg-gray-100" />
      </div>
      <div className="h-80 rounded-[24px] bg-gray-100" />
    </div>
  );
}

function TransactionDrawer({ title, period, transactions, summary, onClose }: {
  title: string;
  period: string;
  transactions: AnalysisTransaction[];
  summary?: Array<{ label: string; value: string }>;
  onClose: () => void;
}) {
  const total = transactions.reduce((value, transaction) => value + transaction.amount, 0);
  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]" onClick={onClose} aria-label="Close transaction details" />
      <aside className="relative h-full w-full sm:max-w-lg bg-white shadow-2xl flex flex-col animate-[slideIn_.22s_ease-out]">
        <div className="px-5 sm:px-7 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Transaction detail</p>
            <h2 className="mt-1 text-xl font-bold" style={{ color: INK }}>{title}</h2>
            <p className="mt-1 text-sm text-gray-500">{period}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-300" aria-label="Close">
            <X size={19} />
          </button>
        </div>
        <div className="px-5 sm:px-7 py-4 bg-slate-50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">{transactions.length} transactions</span>
          <span className="text-lg font-bold" style={{ color: INK }}>{formatCurrency(total)}</span>
        </div>
        {summary && summary.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-5 sm:px-7 py-4 border-b border-gray-100">
            {summary.map((item) => <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wider text-gray-400">{item.label}</p><p className="mt-1 text-sm font-bold" style={{ color: INK }}>{item.value}</p></div>)}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
          {transactions.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">No matching transactions.</p>
          ) : transactions.map((transaction) => (
            <div key={transaction.id} className="rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
              <span className="mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: transaction.type === 'in' ? GREEN_SOFT : RED_SOFT }}>
                {transaction.type === 'in' ? <ArrowDownRight size={16} color={GREEN} /> : <ArrowUpRight size={16} color={RED} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800 truncate">{transaction.description}</p>
                <p className="mt-0.5 text-xs text-gray-400">{transaction.category} · {formatDate(transaction.date)}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">{transaction.payment_mode}</p>
              </div>
              <p className="text-sm font-bold whitespace-nowrap" style={{ color: transaction.type === 'in' ? GREEN : RED }}>
                {transaction.type === 'out' ? '−' : '+'}{formatCurrency(transaction.amount)}
              </p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

interface DrawerState {
  title: string;
  transactions: AnalysisTransaction[];
  summary?: Array<{ label: string; value: string }>;
}

export function CashFlowAnalysis() {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const company = isCompanyCode(workspace.id) ? workspace.id : 'infinity';
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState<CashFlowPeriodKey>('last-6-months');
  const [customRange, setCustomRange] = useState<CashFlowDateRange>(() => getPresetRange('last-6-months', today));
  const [comparisonMode, setComparisonMode] = useState<CashFlowComparisonMode>('none');
  const [patternMode, setPatternMode] = useState<'category' | 'month'>('category');
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  const range = useMemo(
    () => period === 'custom' ? customRange : getPresetRange(period, today),
    [customRange, period, today],
  );
  const comparisonRange = useMemo(() => getComparisonRange(range, comparisonMode), [comparisonMode, range]);
  const query = useCashFlowAnalysis(range, comparisonRange, company);
  const analysis = useMemo(() => buildCashFlowAnalysis({
    transactions: query.transactions,
    comparisonTransactions: query.comparisonTransactions,
    openingBalance: query.openingBalance,
    range,
  }), [query.transactions, query.comparisonTransactions, query.openingBalance, range]);

  const periodLabel = `${formatDate(range.start)} → ${formatDate(range.end)}`;
  const openingDateLabel = new Date(`${range.start}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const topCategories = analysis.expenseCategories.slice(0, 5);
  const spendingPattern = useMemo(() => analysis.timeline.map((point) => {
    const row: Record<string, string | number> = { label: point.label };
    topCategories.forEach((category) => {
      row[category.name] = category.transactions
        .filter((transaction) => point.key.length === 7 ? transaction.date.startsWith(point.key) : transaction.date === point.key)
        .reduce((total, transaction) => total + transaction.amount, 0);
    });
    return row;
  }), [analysis.timeline, topCategories]);

  function openGroup(group: RankedCashGroup) {
    setDrawer({
      title: `${group.name} transactions`,
      transactions: group.transactions,
      summary: [
        { label: 'Total', value: formatCurrency(group.amount) },
        { label: 'Share', value: `${group.percentage.toFixed(1)}%` },
        { label: 'Entries', value: String(group.count) },
      ],
    });
  }

  function openMonth(key: string, type?: 'in' | 'out') {
    const matching = analysis.transactions.filter((transaction) => (
      (key.length === 7 ? transaction.date.startsWith(key) : transaction.date === key) && (!type || transaction.type === type)
    ));
    const monthIn = matching.filter((transaction) => transaction.type === 'in').reduce((total, transaction) => total + transaction.amount, 0);
    const monthOut = matching.filter((transaction) => transaction.type === 'out').reduce((total, transaction) => total + transaction.amount, 0);
    setDrawer({
      title: `${type === 'out' ? 'Outflow' : type === 'in' ? 'Inflow' : 'Cash flow'} · ${key}`,
      transactions: matching,
      summary: [
        { label: 'Money In', value: formatCurrency(monthIn) },
        { label: 'Money Out', value: formatCurrency(monthOut) },
        { label: 'Net', value: signedCurrency(monthIn - monthOut) },
      ],
    });
  }

  function exportAnalysis() {
    const headers = ['Date', 'Type', 'Category', 'Description', 'Payment Mode', 'Amount', 'Reference', 'Sub Brand'];
    const rows = analysis.transactions.map((transaction) => [
      transaction.date,
      transaction.type,
      transaction.category,
      `"${transaction.description.replace(/"/g, '""')}"`,
      transaction.payment_mode,
      transaction.amount,
      transaction.reference ?? '',
      transaction.sub_brand ?? '',
    ]);
    const summary = [
      ['Cash Flow Analysis', periodLabel],
      ['Opening Balance', analysis.openingBalance],
      ['Money In', analysis.totalIn],
      ['Money Out', analysis.totalOut],
      ['Net Cash Flow', analysis.net],
      ['Closing Balance', analysis.closingBalance],
      [],
    ];
    const csv = [...summary, headers, ...rows].map((row) => row.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cash_flow_analysis_${range.start}_${range.end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const controls = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label className="relative">
        <span className="sr-only">Analysis period</span>
        <select
          value={period}
          onChange={(event) => setPeriod(event.target.value as CashFlowPeriodKey)}
          className="h-10 rounded-xl border border-gray-200 bg-white pl-9 pr-8 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        >
          {PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </label>
      <label>
        <span className="sr-only">Comparison period</span>
        <select
          value={comparisonMode}
          onChange={(event) => setComparisonMode(event.target.value as CashFlowComparisonMode)}
          className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        >
          {COMPARISON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <Button variant="outline" onClick={exportAnalysis} disabled={analysis.transactions.length === 0} className="h-10 rounded-xl">
        <Download size={15} /> Export
      </Button>
    </div>
  );

  return (
    <div className="min-h-full min-w-0 max-w-full overflow-x-hidden bg-slate-50/60">
      <TopBar
        title="Cash Flow Analysis"
        subtitle="See where your money is going, how it's changing, and what deserves your attention."
        actions={controls}
      />

      {period === 'custom' && (
        <div className="px-4 md:px-7 pt-5">
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Custom range</span>
            <input
              type="date"
              value={customRange.start}
              max={customRange.end}
              onChange={(event) => setCustomRange((current) => ({ ...current, start: event.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <ArrowRight size={15} className="text-gray-300" />
            <input
              type="date"
              value={customRange.end}
              min={customRange.start}
              max={toLocalDateString(today)}
              onChange={(event) => setCustomRange((current) => ({ ...current, end: event.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>
      )}

      {query.loading ? <AnalysisSkeleton /> : query.error ? (
        <div className="px-4 md:px-7 py-24 flex flex-col items-center text-center">
          <span className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center"><CircleAlert size={24} /></span>
          <h2 className="mt-5 text-xl font-bold" style={{ color: INK }}>Unable to load cash flow analysis.</h2>
          <p className="mt-2 text-sm text-gray-500">Your existing cash-flow data has not been changed.</p>
          <Button className="mt-5" onClick={() => void query.refetch()}><RefreshCw size={15} /> Try Again</Button>
        </div>
      ) : analysis.transactions.length === 0 ? (
        <div className="px-4 md:px-7 py-24 flex flex-col items-center text-center">
          <span className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: GREEN_SOFT, color: GREEN }}><BarChart3 size={28} /></span>
          <h2 className="mt-5 text-xl font-bold" style={{ color: INK }}>No cash flow data yet</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-md">Add transactions to start understanding your business cash flow for this period.</p>
          <Button className="mt-5" onClick={() => navigate('/cash-flow')}>Add Transaction</Button>
        </div>
      ) : (
        <main className="w-full min-w-0 max-w-[1600px] overflow-x-hidden px-4 py-7 md:px-7 mx-auto space-y-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-gray-400">Analysing {periodLabel}</p>
            <nav className="flex flex-wrap gap-1 rounded-xl bg-white border border-gray-100 p-1" aria-label="Analysis sections">
              {[['Overview', 'analysis-overview'], ['Spending', 'analysis-spending'], ['Inflows', 'analysis-inflows'], ['Trends', 'analysis-trends'], ['Insights', 'analysis-insights']].map(([label, target]) => <a key={target} href={`#${target}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-slate-50 hover:text-gray-800">{label}</a>)}
            </nav>
          </div>

          <section id="analysis-overview" className="grid lg:grid-cols-[1.55fr_1fr] gap-5 scroll-mt-4" aria-label="Cash flow overview">
            <div className="relative overflow-hidden rounded-[26px] bg-[#10231d] p-6 sm:p-8 text-white shadow-[0_24px_60px_rgba(15,35,29,0.16)]">
              <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-emerald-400/10 blur-2xl" />
              <div className="relative grid min-w-0 items-end gap-6 2xl:grid-cols-[minmax(0,1fr)_240px]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/60">Net Cash Flow</p>
                  <p className="mt-3 text-4xl sm:text-5xl font-bold tracking-[-0.05em]">{signedCurrency(analysis.net)}</p>
                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <span className="text-emerald-200"><b>{formatCurrency(analysis.totalIn)}</b> in</span>
                    <span className="text-rose-200"><b>{formatCurrency(analysis.totalOut)}</b> out</span>
                  </div>
                  <div className="mt-5">
                    {comparisonMode === 'none'
                      ? <span className="text-xs text-white/45">Enable comparison to see period-over-period movement.</span>
                      : <ChangeBadge value={analysis.netChange} />}
                  </div>
                </div>
                <div className="h-28" aria-label="Net cash flow trend chart">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 240, height: 112 }}>
                    <ComposedChart data={analysis.timeline} margin={{ top: 8, right: 2, bottom: 0, left: 2 }}>
                      <Area type="monotone" dataKey="net" stroke="#6ee7b7" strokeWidth={2.5} fill="#34d399" fillOpacity={0.12} dot={false} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} labelStyle={{ color: INK }} contentStyle={{ borderRadius: 12, border: 0, fontSize: 12 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] bg-white p-6 sm:p-7 border border-gray-100 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Cash Position</p>
                  <p className="mt-1 text-sm text-gray-500">Movement across the selected period</p>
                </div>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: analysis.net >= 0 ? GREEN_SOFT : RED_SOFT, color: analysis.net >= 0 ? GREEN : RED }}>
                  <IndianRupee size={19} />
                </span>
              </div>
              <div className="mt-7 space-y-5">
                <div><div className="flex items-end justify-between"><span className="text-sm text-gray-500">Opening Balance</span><b className="text-lg" style={{ color: INK }}>{formatCurrency(analysis.openingBalance)}</b></div><p className="mt-1.5 text-[11px] text-gray-400">{query.openingTransactionCount === 0 ? `No recorded transactions before ${openingDateLabel}` : `Based on ${query.openingTransactionCount} recorded transactions before ${openingDateLabel}`}</p></div>
                <div className="h-px bg-gray-100 relative"><span className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full" style={{ width: `${Math.min(100, Math.abs(analysis.net) / Math.max(Math.abs(analysis.openingBalance), 1) * 100)}%`, background: analysis.net >= 0 ? GREEN : RED }} /></div>
                <div className="flex items-end justify-between"><span className="text-sm text-gray-500">Closing Balance</span><b className="text-2xl tracking-[-0.03em]" style={{ color: INK }}>{formatCurrency(analysis.closingBalance)}</b></div>
                <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: analysis.net >= 0 ? GREEN_SOFT : RED_SOFT }}>
                  <span className="text-xs font-semibold" style={{ color: analysis.net >= 0 ? GREEN_DARK : RED }}>Position {analysis.net >= 0 ? 'improved' : 'declined'}</span>
                  <b className="text-sm" style={{ color: analysis.net >= 0 ? GREEN_DARK : RED }}>{signedCurrency(analysis.net)}</b>
                </div>
              </div>
            </div>
          </section>

          <section className="grid min-w-0 grid-cols-1 overflow-hidden rounded-[22px] border border-gray-100 bg-white sm:grid-cols-2 xl:grid-cols-5 [&>*]:border-b [&>*]:border-gray-100 sm:[&>*]:border-r xl:[&>*]:border-b-0" aria-label="Supporting cash flow metrics">
            <Metric label="Money In" value={formatCurrency(analysis.totalIn)} context={`${analysis.transactions.filter((transaction) => transaction.type === 'in').length} inflow transactions`} change={comparisonMode === 'none' ? undefined : analysis.inflowChange} />
            <Metric label="Money Out" value={formatCurrency(analysis.totalOut)} context={`${analysis.transactions.filter((transaction) => transaction.type === 'out').length} outflow transactions`} change={comparisonMode === 'none' ? undefined : analysis.outflowChange} expense />
            <Metric label="Avg. Monthly Inflow" value={formatCurrency(analysis.averageMonthlyInflow)} context="Across selected months" />
            <Metric label="Avg. Monthly Outflow" value={formatCurrency(analysis.averageMonthlyOutflow)} context="Across selected months" />
            <Metric label="Expense / Income" value={analysis.expenseIncomeRatio === null ? '—' : `${analysis.expenseIncomeRatio.toFixed(1)}%`} context={analysis.totalIn === 0 ? 'No inflow in this period' : 'Share of inflow consumed'} />
          </section>

          <section className="grid xl:grid-cols-[1.72fr_0.88fr] gap-5">
            <div className="min-w-0 rounded-[24px] bg-white border border-gray-100 p-5 sm:p-7 min-h-[420px]">
              <SectionHeading title="Cash Flow Over Time" subtitle="Track how money moved through the business." />
              <div className="h-[330px]" aria-label="Inflow, outflow and net cash flow over time">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 720, height: 330 }}>
                  <ComposedChart data={analysis.timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="netFlowFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={GREEN} stopOpacity={0.18} /><stop offset="1" stopColor={GREEN} stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#edf1f4" strokeDasharray="3 5" />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={compactCurrency} />
                    <Tooltip formatter={(value, name) => [formatCurrency(Number(value)), String(name)]} contentStyle={{ border: '1px solid #eef2f6', borderRadius: 14, boxShadow: '0 12px 30px rgba(15,23,42,.1)', fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                    <Bar dataKey="inflow" name="Money In" fill={GREEN} fillOpacity={0.75} radius={[5, 5, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="outflow" name="Money Out" fill={RED} fillOpacity={0.65} radius={[5, 5, 0, 0]} maxBarSize={22} />
                    <Area type="monotone" dataKey="net" name="Net Cash Flow" stroke={INK} strokeWidth={2.4} fill="url(#netFlowFill)" dot={{ r: 3, fill: '#fff', stroke: INK, strokeWidth: 2 }} />
                    {comparisonMode !== 'none' && <Line type="monotone" dataKey="comparisonNet" name="Previous net" stroke="#a8b1be" strokeDasharray="5 5" dot={false} strokeWidth={1.5} />}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="min-w-0 rounded-[24px] bg-[#f6f8f8] border border-gray-100 p-5 sm:p-7">
              <SectionHeading title="Cash Flow Health" subtitle="Transparent signals from this period." />
              <div className="flex items-center gap-3 pb-5 border-b border-gray-200/70">
                <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: analysis.healthLabel === 'Stable' ? GREEN_SOFT : '#fff7e8', color: analysis.healthLabel === 'Stable' ? GREEN : '#b7791f' }}>
                  {analysis.healthLabel === 'Stable' ? <CheckCircle2 size={21} /> : <CircleAlert size={21} />}
                </span>
                <div><p className="text-lg font-bold" style={{ color: INK }}>{analysis.healthLabel}</p><p className="text-xs text-gray-500">{analysis.healthExplanation}</p></div>
              </div>
              <div className="mt-3 divide-y divide-gray-200/70">
                {[
                  ['Positive cash flow', `${analysis.positivePeriods} / ${analysis.timeline.length} periods`],
                  ['Spending trend', comparisonMode === 'none' ? 'Enable comparison' : analysis.outflowChange === null ? 'Not enough history' : `${analysis.outflowChange >= 0 ? '↑' : '↓'} ${Math.abs(analysis.outflowChange).toFixed(1)}%`],
                  ['Recurring business cost', `${formatCurrency(analysis.estimatedRecurringMonthlyCost)} / month`],
                  ['Largest category', analysis.largestExpenseCategory ?? 'No expense data'],
                ].map(([label, value]) => (
                  <div key={label} className="py-4 flex items-center justify-between gap-4"><span className="text-sm text-gray-500">{label}</span><b className="text-sm text-right" style={{ color: INK }}>{value}</b></div>
                ))}
              </div>
            </div>
          </section>

          <section id="analysis-spending" className="rounded-[24px] bg-white border border-gray-100 p-5 sm:p-7 scroll-mt-4">
            <SectionHeading title="Where Your Money Went" subtitle="See which categories consumed the most cash." />
            {analysis.expenseCategories.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">No outflow transactions in this period.</p> : (
              <div className="space-y-5">
                {analysis.expenseCategories.slice(0, 8).map((category, index) => (
                  <button key={category.name} onClick={() => openGroup(category)} className="group w-full text-left focus:outline-none focus:ring-2 focus:ring-emerald-100 rounded-xl">
                    <div className="mb-2 flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0"><span className="text-sm font-semibold text-gray-800">{category.name}</span><span className="ml-2 text-xs text-gray-400">{category.count} transactions</span></div>
                      <div className="flex items-center justify-between gap-3 sm:shrink-0"><span className="text-xs text-gray-400">{category.percentage.toFixed(1)}%</span><b className="ml-auto text-sm" style={{ color: INK }}>{formatCurrency(category.amount)}</b><ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500" /></div>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${category.percentage}%`, background: CHART_COLORS[index % CHART_COLORS.length] }} /></div>
                    {comparisonMode !== 'none' && <p className="mt-1.5 text-[11px] text-gray-400">{category.change === null ? 'No comparable historical category' : `${category.change >= 0 ? 'Increased' : 'Decreased'} ${Math.abs(category.change).toFixed(1)}% vs comparison period`}</p>}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="grid xl:grid-cols-[1.55fr_1fr] gap-5">
            <div className="min-w-0 rounded-[24px] bg-white border border-gray-100 p-5 sm:p-7">
              <SectionHeading
                title="Spending Pattern"
                subtitle="Reveal how major expense categories move over time."
                action={<div className="rounded-xl bg-slate-100 p-1 flex"><button onClick={() => setPatternMode('category')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${patternMode === 'category' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>By Category</button><button onClick={() => setPatternMode('month')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${patternMode === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>By Month</button></div>}
              />
              <div className="h-[310px]" aria-label="Expense category spending pattern">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 640, height: 310 }}>
                  <BarChart data={spendingPattern} margin={{ top: 8, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#edf1f4" strokeDasharray="3 5" />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={52} tickFormatter={compactCurrency} />
                    <Tooltip formatter={(value, name) => [formatCurrency(Number(value)), String(name)]} contentStyle={{ border: 0, borderRadius: 14, boxShadow: '0 12px 30px rgba(15,23,42,.1)', fontSize: 12 }} />
                    {topCategories.map((category, index) => <Bar key={category.name} dataKey={category.name} stackId={patternMode === 'month' ? 'expenses' : undefined} fill={CHART_COLORS[index]} radius={patternMode === 'month' && index === topCategories.length - 1 ? [5, 5, 0, 0] : undefined} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="min-w-0 rounded-[24px] bg-white border border-gray-100 p-5 sm:p-7">
              <SectionHeading title={comparisonMode === 'none' ? 'Period Highlights' : "What's Changing?"} subtitle={comparisonMode === 'none' ? 'Useful signals from the selected period.' : 'Measured movement against the comparison period.'} />
              {comparisonMode === 'none' ? (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Largest expense', analysis.topSpending[0]?.description ?? 'No expense', analysis.topSpending[0] ? formatCurrency(analysis.topSpending[0].amount) : '—'],
                    ['Largest category', analysis.expenseCategories[0]?.name ?? 'No expense', analysis.expenseCategories[0] ? `${analysis.expenseCategories[0].percentage.toFixed(1)}%` : '—'],
                    ['Top 3 categories', `${analysis.expenseCategories.slice(0, 3).map((item) => item.name).join(', ') || 'No expense'}`, `${analysis.topThreeExpenseShare.toFixed(1)}%`],
                    ['Positive periods', `${analysis.positivePeriods} of ${analysis.timeline.length}`, analysis.healthLabel],
                  ].map(([label, detail, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p><p className="mt-2 text-sm font-semibold text-gray-700 line-clamp-2">{detail}</p><p className="mt-1 text-base font-bold" style={{ color: INK }}>{value}</p></div>)}
                </div>
              ) : analysis.categoryChanges.length === 0 ? (
                <p className="py-16 text-center text-sm text-gray-400">Not enough historical data.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {analysis.categoryChanges.map((category) => (
                    <button key={category.name} onClick={() => openGroup(category)} className="w-full py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50 rounded-lg px-2 -mx-2">
                      <div><p className="text-sm font-semibold text-gray-800">{category.name}</p><p className="mt-1 text-xs text-gray-400">{formatCurrency(category.amount)} this period</p></div>
                      <ChangeBadge value={category.change} expense />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="grid xl:grid-cols-2 gap-5">
            <div className="rounded-[24px] bg-white border border-gray-100 p-5 sm:p-7">
              <SectionHeading title="Top Spending" subtitle="Largest individual cash outflows." />
              {analysis.topSpending[0] && <button onClick={() => setDrawer({ title: 'Top 3 expense categories', transactions: analysis.expenseCategories.slice(0, 3).flatMap((category) => category.transactions), summary: [{ label: 'Top 3 total', value: formatCurrency(analysis.topThreeExpenseAmount) }, { label: 'Outflow share', value: `${analysis.topThreeExpenseShare.toFixed(1)}%` }, { label: 'Largest entry', value: formatCurrency(analysis.topSpending[0].amount) }] })} className="mb-3 w-full rounded-2xl bg-slate-50 p-4 flex items-center justify-between gap-4 text-left"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Expense concentration</p><p className="mt-1 text-sm font-semibold text-gray-700">Top 3 categories account for {analysis.topThreeExpenseShare.toFixed(1)}% of outflow</p></div><ChevronRight size={16} className="text-gray-400 shrink-0" /></button>}
              <div className="divide-y divide-gray-100">
                {analysis.topSpending.map((transaction, index) => (
                  <button key={transaction.id} onClick={() => setDrawer({ title: transaction.description, transactions: [transaction] })} className="w-full py-3.5 flex items-center gap-4 text-left group">
                    <span className="text-xs font-bold text-gray-300 w-5">{String(index + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-gray-800 truncate">{transaction.description}</p><p className="mt-1 text-xs text-gray-400">{transaction.category} · {formatDate(transaction.date)}</p></div>
                    <div className="text-right"><p className="text-sm font-bold" style={{ color: INK }}>{formatCurrency(transaction.amount)}</p><p className="mt-1 text-[11px] text-gray-400">{analysis.totalOut > 0 ? ((transaction.amount / analysis.totalOut) * 100).toFixed(1) : '0'}% of outflow</p></div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] bg-white border border-gray-100 p-5 sm:p-7">
              <SectionHeading title="Recurring Transactions" subtitle="Patterns require at least 3 similar amounts across 2 or more months." />
              {analysis.recurringCosts.length === 0 ? <div className="py-16 text-center"><Repeat2 size={28} className="mx-auto text-gray-300" /><p className="mt-3 text-sm text-gray-500">No strong recurring transaction pattern detected yet.</p></div> : (
                <>
                  <div className="divide-y divide-gray-100">
                    {analysis.recurringCosts.slice(0, 4).map((cost) => (
                      <button key={cost.key} onClick={() => setDrawer({ title: `${cost.name} recurring costs`, transactions: cost.transactions })} className="flex w-full flex-col items-stretch justify-between gap-2 py-3.5 text-left sm:flex-row sm:items-center sm:gap-4">
                        <div className="min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-semibold text-gray-800 truncate">{cost.name}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-gray-500">{cost.kind}</span></div><p className="mt-1 text-xs text-gray-400">{cost.frequencyLabel} · {cost.evidenceLabel}</p></div>
                        <div className="text-right shrink-0"><p className="text-sm font-bold" style={{ color: INK }}>{formatCurrency(cost.monthlyAverage)} / month</p><p className="mt-1 text-[11px] text-gray-400">{formatCurrency(cost.total)} total</p></div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 grid sm:grid-cols-2 gap-2"><div className="rounded-2xl bg-slate-50 px-4 py-3"><span className="text-xs font-semibold text-gray-500">Recurring business cost</span><b className="mt-1 block" style={{ color: INK }}>{formatCurrency(analysis.estimatedRecurringMonthlyCost)} / month</b></div><div className="rounded-2xl bg-slate-50 px-4 py-3"><span className="text-xs font-semibold text-gray-500">Recurring personal withdrawals</span><b className="mt-1 block" style={{ color: INK }}>{formatCurrency(analysis.estimatedRecurringMonthlyPersonal)} / month</b></div></div>
                </>
              )}
            </div>
          </section>

          <section id="analysis-inflows" className="grid xl:grid-cols-[1.35fr_0.65fr] gap-5 scroll-mt-4">
            <div className="rounded-[24px] bg-white border border-gray-100 p-5 sm:p-7">
              <SectionHeading title="Where Money Came From" subtitle="Recorded inflows grouped by their structured transaction category." />
              <div className="space-y-4">
                {analysis.inflowSources.slice(0, 7).map((source, index) => (
                  <button key={source.name} onClick={() => openGroup(source)} className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left sm:grid-cols-[minmax(110px,1fr)_2fr_auto] sm:gap-4">
                    <span className="order-1 truncate text-sm font-semibold text-gray-700 sm:order-none">{source.name}</span>
                    <span className="order-3 col-span-2 h-2 overflow-hidden rounded-full bg-gray-100 sm:order-none sm:col-span-1"><span className="block h-full rounded-full" style={{ width: `${source.percentage}%`, background: index === 0 ? GREEN : '#9eb8ae' }} /></span>
                    <span className="order-2 text-right text-sm font-bold sm:order-none sm:min-w-[110px]" style={{ color: INK }}>{formatCurrency(source.amount)} <small className="font-medium text-gray-400">· {source.percentage.toFixed(0)}%</small></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] bg-[#18231f] text-white p-5 sm:p-7">
              <SectionHeading title="Inflow Concentration" subtitle="Dependence on the largest recorded inflow classifications." />
              <div className="mt-8 space-y-7">
                {[['Top 1 classification', analysis.topOneInflowShare], ['Top 3 classifications', analysis.topThreeInflowShare], ['Other inflows', Math.max(0, 100 - analysis.topThreeInflowShare)]].map(([label, value]) => (
                  <div key={String(label)}><div className="flex items-end justify-between"><span className="text-sm text-white/60">{label}</span><b className="text-2xl">{Number(value).toFixed(0)}%</b></div><div className="mt-2 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-300" style={{ width: `${Math.min(100, Number(value))}%` }} /></div></div>
                ))}
              </div>
            </div>
          </section>

          <section id="analysis-trends" className="rounded-[24px] bg-white border border-gray-100 p-5 sm:p-7 scroll-mt-4">
            <SectionHeading title="Monthly Performance" subtitle="Select a period to inspect the underlying transactions." />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {analysis.timeline.map((point) => (
                <button key={point.key} onClick={() => openMonth(point.key)} className="rounded-2xl border border-gray-100 p-4 text-left hover:-translate-y-0.5 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-emerald-100">
                  <p className="text-xs font-semibold text-gray-400">{point.label}</p>
                  <p className="mt-3 text-lg font-bold" style={{ color: point.net >= 0 ? GREEN : RED }}>{point.net >= 0 ? '+' : '−'}{compactCurrency(Math.abs(point.net))}</p>
                  <p className="mt-1 text-[11px] text-gray-400">Net cash flow</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[26px] overflow-hidden bg-[#f2f7f5] border border-emerald-100/60 p-5 sm:p-8">
            <SectionHeading title="Money Flow" subtitle="Understand the path from incoming cash to major spending categories." />
            <div className="grid lg:grid-cols-[1fr_auto_1fr_auto_1.25fr] items-stretch gap-3">
              <button onClick={() => setDrawer({ title: 'Money in', transactions: analysis.transactions.filter((transaction) => transaction.type === 'in') })} className="rounded-2xl bg-white p-5 text-left shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-gray-400">1 · Money In</p><p className="mt-2 text-2xl font-bold" style={{ color: GREEN }}>{formatCurrency(analysis.totalIn)}</p><p className="mt-3 text-xs text-gray-400">{analysis.inflowSources.length} recorded classifications</p></button>
              <div className="hidden lg:flex items-center text-emerald-300"><ArrowRight /></div>
              <div className="rounded-2xl bg-[#13261f] text-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-white/50">2 · Net Movement</p><p className="mt-2 text-2xl font-bold">{signedCurrency(analysis.net)}</p><div className="mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-emerald-300" style={{ width: `${analysis.totalIn > 0 ? Math.min(100, Math.abs(analysis.net) / analysis.totalIn * 100) : 0}%` }} /></div></div>
              <div className="hidden lg:flex items-center text-emerald-300"><ArrowRight /></div>
              <div className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-gray-400">3 · Money Out</p><b style={{ color: RED }}>{formatCurrency(analysis.totalOut)}</b></div><div className="mt-4 space-y-3">{analysis.expenseCategories.slice(0, 4).map((category) => <button key={category.name} onClick={() => openGroup(category)} className="w-full text-left"><div className="flex items-center justify-between text-sm"><span className="text-gray-600">{category.name}</span><span className="font-semibold text-gray-800">{formatCurrency(category.amount)}</span></div><div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-rose-300" style={{ width: `${category.percentage}%` }} /></div></button>)}</div></div>
            </div>
          </section>

          <section id="analysis-insights" className="grid xl:grid-cols-[1.25fr_0.75fr] gap-5 scroll-mt-4">
            <div className="rounded-[24px] bg-white border border-gray-100 p-5 sm:p-7">
              <SectionHeading title="Things Worth Reviewing" subtitle="Evidence-based observations from recorded transactions." />
              {analysis.insights.length === 0 ? <p className="py-12 text-center text-sm text-gray-400">Not enough transaction evidence for review signals yet.</p> : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {analysis.insights.map((insight) => (
                    <button
                      key={insight.id}
                      onClick={() => setDrawer({
                        title: insight.title,
                        transactions: analysis.transactions.filter((transaction) => (
                          (!insight.filter?.type || transaction.type === insight.filter.type) &&
                          (!insight.filter?.category || transaction.category === insight.filter.category) &&
                          (!insight.filter?.month || (insight.filter.month.length === 7 ? transaction.date.startsWith(insight.filter.month) : transaction.date === insight.filter.month))
                        )),
                      })}
                      className="rounded-2xl border border-gray-100 p-4 text-left hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3"><span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: insight.tone === 'positive' ? GREEN_SOFT : insight.tone === 'attention' ? '#fff7e8' : '#f1f5f9', color: insight.tone === 'positive' ? GREEN : insight.tone === 'attention' ? '#b7791f' : '#64748b' }}>{insight.tone === 'positive' ? <TrendingUp size={17} /> : <Eye size={17} />}</span><span className="text-sm font-bold" style={{ color: INK }}>{insight.amountLabel}</span></div>
                      <p className="mt-4 text-sm font-semibold text-gray-800">{insight.title}</p><p className="mt-1 text-xs leading-5 text-gray-500">{insight.detail}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: GREEN }}>View details <ChevronRight size={13} /></span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[24px] bg-white border border-gray-100 p-5 sm:p-7">
              <SectionHeading title="Cost Review" subtitle="Signals that may deserve investigation." />
              <div className="space-y-3">
                {analysis.categoryChanges.filter((category) => (category.change ?? 0) > 15).slice(0, 2).map((category) => (
                  <button key={category.name} onClick={() => openGroup(category)} className="w-full rounded-2xl bg-amber-50/70 p-4 text-left"><p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Increasing cost</p><div className="mt-2 flex justify-between gap-3"><b className="text-sm text-gray-800">{category.name}</b><span className="text-sm font-bold text-amber-700">+{category.change?.toFixed(1)}%</span></div><p className="mt-1 text-xs text-gray-500">{category.count} transactions · {formatCurrency(category.amount)}</p></button>
                ))}
                {analysis.recurringBusinessCosts.slice(0, 2).map((cost) => (
                  <button key={cost.key} onClick={() => setDrawer({ title: cost.name, transactions: cost.transactions })} className="w-full rounded-2xl bg-slate-50 p-4 text-left"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recurring cost</p><div className="mt-2 flex justify-between gap-3"><b className="text-sm text-gray-800 truncate">{cost.name}</b><span className="text-sm font-bold text-gray-700">{formatCurrency(cost.monthlyAverage)}/mo</span></div></button>
                ))}
                {analysis.recurringPersonalMovements.slice(0, 1).map((cost) => (
                  <button key={cost.key} onClick={() => setDrawer({ title: 'Recurring personal withdrawals', transactions: cost.transactions })} className="w-full rounded-2xl bg-blue-50/60 p-4 text-left"><p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Personal movement · not a business cost</p><div className="mt-2 flex justify-between gap-3"><b className="text-sm text-gray-800 truncate">{cost.name}</b><span className="text-sm font-bold text-gray-700">{formatCurrency(cost.monthlyAverage)}/mo</span></div></button>
                ))}
                {analysis.recurringTransfers.slice(0, 1).map((cost) => (
                  <button key={cost.key} onClick={() => setDrawer({ title: 'Recurring transfers', transactions: cost.transactions })} className="w-full rounded-2xl bg-violet-50/60 p-4 text-left"><p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600">Transfer · excluded from business cost</p><div className="mt-2 flex justify-between gap-3"><b className="text-sm text-gray-800 truncate">{cost.name}</b><span className="text-sm font-bold text-gray-700">{formatCurrency(cost.monthlyAverage)}/mo</span></div></button>
                ))}
                {analysis.expenseCategories[0] && analysis.expenseCategories[0].percentage >= 40 && (
                  <button onClick={() => openGroup(analysis.expenseCategories[0])} className="w-full rounded-2xl bg-slate-50 p-4 text-left"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">High concentration</p><div className="mt-2 flex justify-between gap-3"><b className="text-sm text-gray-800">{analysis.expenseCategories[0].name}</b><span className="text-sm font-bold text-gray-700">{analysis.expenseCategories[0].percentage.toFixed(1)}%</span></div></button>
                )}
                {analysis.categoryChanges.length === 0 && analysis.recurringCosts.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No strong cost-review signals for this period.</p>}
              </div>
            </div>
          </section>

          <section className="rounded-[24px] bg-white border border-gray-100 p-5 sm:p-7">
            <SectionHeading title="Operating Rhythm" subtitle="Monthly pace and the strongest recorded periods." />
            <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8 items-center">
              <div className="space-y-5">
                {[['Average monthly inflow', analysis.averageMonthlyInflow, GREEN], ['Average monthly outflow', analysis.averageMonthlyOutflow, RED], ['Average monthly net', Math.abs(analysis.averageMonthlyNet), INK]].map(([label, rawValue, color]) => {
                  const value = Number(rawValue);
                  const max = Math.max(analysis.averageMonthlyInflow, analysis.averageMonthlyOutflow, Math.abs(analysis.averageMonthlyNet), 1);
                  return <div key={String(label)}><div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-gray-600">{label}</span><b className="text-sm" style={{ color: String(color) }}>{label === 'Average monthly net' ? signedCurrency(analysis.averageMonthlyNet) : formatCurrency(value)}</b></div><div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${value / max * 100}%`, background: String(color) }} /></div></div>;
                })}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {[
                  ['Highest inflow', [...analysis.timeline].sort((a, b) => b.inflow - a.inflow)[0]?.inflow ?? 0, [...analysis.timeline].sort((a, b) => b.inflow - a.inflow)[0]?.label ?? '—'],
                  ['Highest outflow', [...analysis.timeline].sort((a, b) => b.outflow - a.outflow)[0]?.outflow ?? 0, [...analysis.timeline].sort((a, b) => b.outflow - a.outflow)[0]?.label ?? '—'],
                  ['Strongest net', [...analysis.timeline].sort((a, b) => b.net - a.net)[0]?.net ?? 0, [...analysis.timeline].sort((a, b) => b.net - a.net)[0]?.label ?? '—'],
                ].map(([label, rawValue, point]) => <div key={String(label)} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-gray-400">{label} · {point}</p><p className="mt-2 text-base font-bold" style={{ color: INK }}>{label === 'Strongest net' ? signedCurrency(Number(rawValue)) : formatCurrency(Number(rawValue))}</p></div>)}
              </div>
            </div>
          </section>

          <p className="pb-2 text-center text-[11px] text-gray-400">All metrics are calculated from recorded cash transactions. No forecast or generated financial advice is included.</p>
        </main>
      )}

      {drawer && <TransactionDrawer title={drawer.title} period={periodLabel} transactions={drawer.transactions} summary={drawer.summary} onClose={() => setDrawer(null)} />}
    </div>
  );
}
