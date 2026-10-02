import { Link } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, Check, ChevronLeft, ChevronRight,
  CircleDollarSign, FileText, Pencil, Plus, ReceiptText, RefreshCw, WalletCards,
} from 'lucide-react';
import {
  Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type {
  DashboardActivityItem, DashboardAttentionItem, DashboardFinancialData, DashboardMetric,
} from '../../domain/dashboardFinancials';
import { formatCurrency, formatDate } from '../../utils/formatters';

const GREEN = '#15803d';
const RED = '#b91c1c';
const AMBER = '#b45309';

function shortCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1,
  }).format(value);
}

function metricText(metric: DashboardMetric): string {
  return metric.value == null ? '—' : formatCurrency(metric.value);
}

function heroCurrency(metric: DashboardMetric): string {
  if (metric.value == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: Number.isInteger(metric.value) ? 0 : 2,
  }).format(metric.value);
}

function stateCopy(metric: DashboardMetric): string | null {
  if (metric.state === 'empty') return 'No recorded activity';
  if (metric.state === 'unavailable') return metric.reason || 'Not available';
  if (metric.state === 'error') return "Couldn't load this value";
  if (metric.state === 'partial') return metric.reason || 'Some supporting data is unavailable';
  if (metric.state === 'stale') return 'Showing previously loaded data';
  return null;
}

function MetricValue({ metric, className = '', signed = false }: { metric: DashboardMetric; className?: string; signed?: boolean }) {
  const color = metric.value == null ? 'text-gray-400' : signed && metric.value < 0 ? 'text-red-700' : 'text-gray-950';
  return (
    <div>
      <p className={`${color} ${className}`}>{metricText(metric)}</p>
      {stateCopy(metric) && <p className="mt-1 max-w-md text-sm leading-5 text-gray-500">{stateCopy(metric)}</p>}
    </div>
  );
}

function formatRefresh(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Refresh time unavailable';
  return `Updated ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHeader({
  entity, periodLabel, context, currentMonth, onPrevious, onNext, onCreate,
}: {
  entity: string;
  periodLabel: string;
  context: DashboardFinancialData['dashboardContext'] | null;
  currentMonth: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onCreate: () => void;
}) {
  return (
    <header className="mb-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-gray-950">Dashboard</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
            <span className="font-semibold text-gray-800">{entity}</span>
            <span aria-hidden="true" className="text-gray-300">/</span>
            <span>{periodLabel}</span>
            <span aria-hidden="true" className="text-gray-300">/</span>
            <span>Money in, performance and what needs attention</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
            <RefreshCw size={12} aria-hidden="true" />
            <span>{context ? formatRefresh(context.lastUpdated) : 'Refreshing data'}</span>
            {context?.state === 'partial' && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">Some data unavailable</span>}
            {context?.state === 'stale' && <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">Stale</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <div className="flex min-h-11 flex-1 items-center justify-between rounded-xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,.03)] sm:flex-none">
            <button onClick={onPrevious} aria-label="Previous month" className="group grid min-h-11 min-w-11 place-items-center rounded-l-xl text-gray-500 outline-none transition-colors duration-150 hover:bg-slate-50 hover:text-gray-950 focus-visible:ring-2 focus-visible:ring-slate-700"><ChevronLeft size={17} className="transition-transform duration-150 group-hover:-translate-x-0.5" /></button>
            <span className="min-w-[118px] text-center text-sm font-semibold text-gray-800">{periodLabel}</span>
            <button onClick={onNext} aria-label="Next month" disabled={currentMonth} className="group grid min-h-11 min-w-11 place-items-center rounded-r-xl text-gray-500 outline-none transition-colors duration-150 hover:bg-slate-50 hover:text-gray-950 focus-visible:ring-2 focus-visible:ring-slate-700 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight size={17} className="transition-transform duration-150 group-hover:translate-x-0.5" /></button>
          </div>
          <button onClick={onCreate} className="hidden min-h-11 whitespace-nowrap items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-[0_5px_14px_rgba(15,23,42,.14)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-[0_9px_20px_rgba(15,23,42,.2)] focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 lg:flex">
            <Plus size={16} /> Create invoice
          </button>
        </div>
      </div>
    </header>
  );
}

export function FinancialSnapshot({ data }: { data: DashboardFinancialData }) {
  const snapshot = data.financialSnapshot;
  const comparison = snapshot.cashCollectedComparison;
  const collectionMax = Math.max(...data.performanceTrend.map((point) => point.collections), 1);
  const hasCollectionTrend = data.performanceTrend.some((point) => point.collections > 0);
  return (
    <section aria-labelledby="financial-snapshot-title" className="relative isolate overflow-hidden rounded-[26px] bg-[#070b16] text-white shadow-[0_20px_55px_rgba(15,23,42,0.2)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-90" style={{ backgroundImage: 'radial-gradient(circle at 78% 42%, rgba(52,211,153,.13), transparent 27%), radial-gradient(circle at 15% 0%, rgba(34,211,238,.06), transparent 28%), linear-gradient(125deg, #070b16 15%, #0b1220 62%, #111b2d 100%)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.22) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="grid md:grid-cols-[minmax(0,1.45fr)_minmax(240px,.75fr)]">
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <p className="text-sm font-medium text-slate-300">{timeGreeting()}, {data.dashboardContext.entity === 'infinity' ? 'Infinity Enterprises' : data.dashboardContext.entity === 'ritera' ? 'Ritera Publishing' : 'Ratixinfo Tech'}</p>
          <div className="mt-7">
            <h2 id="financial-snapshot-title" className="text-sm font-medium text-slate-400">Collected this month</h2>
            <p className="mt-2 break-words text-4xl font-bold tabular-nums tracking-[-0.055em] text-white sm:text-5xl">{heroCurrency(snapshot.cashCollected)}</p>
            {comparison.value != null && <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${comparison.value >= 0 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300'}`}><span className="text-base leading-none">{comparison.value >= 0 ? '↑' : '↓'}</span>{Math.abs(comparison.value).toFixed(1)}% vs previous period</p>}
          </div>
          <div className="mt-8 grid grid-cols-3 gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.065] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-sm sm:gap-3 sm:p-3">
            {[
              ['Cash balance', snapshot.currentCash, 'text-cyan-300', 'Current ledger'],
              ['Cash out', snapshot.cashOut, 'text-red-300', 'This month'],
              ['Receivables', data.receivables.totalOutstanding, 'text-amber-300', data.receivables.totalOutstanding.value === 0 ? 'All clear' : 'Outstanding'],
            ].map(([label, value, color, note]) => <div key={label as string} className="min-w-0 rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-white/[0.055] sm:px-3"><p className="truncate text-[11px] text-slate-400 sm:text-sm">{label as string}</p><p className={`mt-1 text-sm font-semibold tabular-nums sm:text-lg ${(value as DashboardMetric).value == null ? 'text-slate-500' : color as string}`}>{metricText(value as DashboardMetric)}</p><p className="mt-1 hidden text-[11px] text-slate-500 sm:block">{note as string}</p></div>)}
          </div>
        </div>
        <div className="flex min-h-[210px] flex-col justify-between border-t border-white/[0.08] bg-white/[0.025] px-5 py-6 sm:px-7 md:min-h-0 md:border-l md:border-t-0">
          <div><p className="text-sm font-semibold text-white">Collection trend</p><p className="mt-1 text-xs text-slate-400">Last six months</p></div>
          {hasCollectionTrend ? <div className="my-5 flex h-32 items-end gap-2 pr-12 pt-8 md:pr-0" role="img" aria-label={data.performanceTrend.map((point) => `${point.month}: ${formatCurrency(point.collections)}`).join(', ')}>{data.performanceTrend.map((point, index) => { const latest = index === data.performanceTrend.length - 1; const period = new Date(`${point.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); const tooltipPosition = index === 0 ? 'left-0' : latest ? 'right-0' : 'left-1/2 -translate-x-1/2'; return <div key={point.month} tabIndex={0} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2 outline-none"><span className={`pointer-events-none absolute top-0 z-20 -translate-y-1 rounded-lg border border-white/10 bg-slate-800/95 px-2.5 py-2 text-center opacity-0 shadow-xl backdrop-blur transition-all duration-200 group-hover:-translate-y-2 group-hover:opacity-100 group-focus:-translate-y-2 group-focus:opacity-100 ${tooltipPosition}`}><span className="block whitespace-nowrap text-[10px] text-slate-400">{period}</span><span className="mt-0.5 block whitespace-nowrap text-xs font-semibold text-white">{formatCurrency(point.collections)}</span></span><span className={`w-full origin-bottom rounded-t-md transition-all duration-200 group-hover:-translate-y-1 group-focus:-translate-y-1 ${latest ? 'bg-gradient-to-t from-emerald-500 to-cyan-300 shadow-[0_0_18px_rgba(52,211,153,.24)]' : 'bg-gradient-to-t from-emerald-600/65 to-emerald-300/80 group-hover:from-emerald-500 group-hover:to-cyan-300'}`} style={{ height: `${Math.max(5, (point.collections / collectionMax) * 88)}px` }} /><span className={`text-[11px] transition-colors duration-200 ${latest ? 'font-semibold text-emerald-300' : 'text-slate-400 group-hover:text-white group-focus:text-white'}`}>{new Date(`${point.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</span></div>; })}</div> : <p className="my-7 text-sm text-slate-400">No collections recorded in this period.</p>}
          <Link to="/receipts" className="group inline-flex items-center gap-1 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:text-emerald-300">View payments <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" /></Link>
        </div>
      </div>
    </section>
  );
}

export function BusinessSnapshot({ data }: { data: DashboardFinancialData }) {
  const items: Array<{ label: string; metric: DashboardMetric; href: string; tone: string; note?: string }> = [
    { label: 'Revenue', metric: data.financialSnapshot.revenue, href: '/invoices', tone: 'bg-blue-500' },
    { label: 'Expenses', metric: data.financialSnapshot.operatingExpenses, href: '/expenses', tone: 'bg-red-500' },
    { label: 'Operating result', metric: data.financialSnapshot.operatingResult, href: '/cash-flow-analysis', tone: data.financialSnapshot.operatingResult.value != null && data.financialSnapshot.operatingResult.value < 0 ? 'bg-red-500' : 'bg-emerald-500' },
    { label: 'Receivables', metric: data.receivables.totalOutstanding, href: '/invoices', tone: 'bg-amber-500', note: data.receivables.overdueCount ? `${data.receivables.overdueCount} overdue` : 'Nothing overdue' },
  ];
  return <section aria-label="Business snapshot" className="rounded-2xl border border-slate-200/70 bg-white px-3 py-3 shadow-[0_8px_26px_rgba(15,23,42,.045)]"><div className="grid grid-cols-2 gap-1 sm:grid-cols-4">{items.map((item) => <Link key={item.label} to={item.href} title={item.metric.definition} className="group relative min-w-0 rounded-xl px-3 py-2 outline-none transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-700"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${item.tone}`} /><p className="text-sm text-gray-500">{item.label}</p><ArrowRight size={13} className="ml-auto -translate-x-1 text-slate-400 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" /></div><p className="mt-1 truncate text-xl font-bold tabular-nums tracking-tight text-gray-950 transition-colors group-hover:text-slate-700">{metricText(item.metric)}</p><p className="mt-1 text-xs text-gray-500">{item.note || (item.metric.state === 'empty' ? 'No activity this month' : 'Open details')}</p></Link>)}</div></section>;
}

function attentionRoute(item: DashboardAttentionItem): string {
  if (item.type === 'receivables' || item.type === 'data-quality') return '/invoices';
  if (item.type === 'gst') return '/gst-summary';
  return '/cash-flow';
}

export function AttentionSection({ items }: { items: DashboardAttentionItem[] }) {
  if (items.length === 0) {
    return <section aria-label="Attention required" className="flex items-center gap-3 rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50 to-teal-50/70 px-5 py-4 text-sm text-emerald-950 shadow-[0_8px_24px_rgba(16,185,129,.07)]"><span className="relative grid h-8 w-8 place-items-center rounded-full bg-emerald-100"><span className="ledger-status-pulse absolute inset-0 rounded-full bg-emerald-300/40" /><Check size={16} className="relative text-emerald-700" /></span><div><p className="font-semibold">Everything looks up to date</p><p className="mt-0.5 text-xs text-emerald-700">No financial items need review right now.</p></div></section>;
  }
  return (
    <section aria-labelledby="attention-title" className="overflow-hidden rounded-2xl bg-amber-50/70 ring-1 ring-inset ring-amber-100">
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <div><h2 id="attention-title" className="text-base font-semibold text-gray-950">Needs your attention</h2><p className="mt-1 text-xs text-gray-600">Items that may affect cash or compliance</p></div>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">{items.length}</span>
      </div>
      <div className="px-3 pb-3">
        {items.map((item, index) => {
          const tone = item.severity === 'critical' ? RED : item.severity === 'warning' ? AMBER : '#1d4ed8';
          return (
            <div key={`${item.type}-${index}`} className="rounded-xl px-2 py-3 hover:bg-white/60">
              <div className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tone }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-5 text-gray-950">{item.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                    {item.impact != null && <span className="font-semibold text-gray-900">{formatCurrency(item.impact)}</span>}
                    <span>{item.dueDate ? `Due ${formatDate(item.dueDate)}` : item.severity === 'info' ? 'Review this period' : 'Review recommended'}</span>
                  </div>
                </div>
                <Link to={attentionRoute(item)} aria-label={`${item.action}: ${item.title}`} className="grid min-h-9 min-w-9 place-items-center rounded-full bg-white/70 text-slate-700 outline-none hover:bg-white hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-700"><ArrowRight size={15} /></Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function receivableStatus(item: DashboardFinancialData['receivables']['priorityItems'][number]): string {
  if (item.timing === 'paid') return 'Paid';
  if (item.timing === 'overdue') return item.daysFromDue === 0 ? 'Due today' : `${item.daysFromDue} days overdue`;
  if (item.timing === 'due-soon') return item.daysFromDue === 0 ? 'Due today' : `Due in ${item.daysFromDue} days`;
  if (item.timing === 'unclassified') return 'Due date missing';
  return item.dueDate ? `Due ${formatDate(item.dueDate)}` : 'Due later';
}

export function WorkingCapital({ data }: { data: DashboardFinancialData }) {
  const receivables = data.receivables;
  const gst = data.obligations.netGstPayable;
  const total = receivables.totalOutstanding.value;
  const overdue = receivables.overdueAmount.value;
  const dueSoon = receivables.dueSoonAmount.value;
  const canShowAging = total != null && overdue != null && dueSoon != null && total > 0;
  const later = canShowAging ? Math.max(total - overdue - dueSoon, 0) : 0;
  const aging = canShowAging ? [
    { label: 'Overdue', value: overdue, color: 'bg-red-500' },
    { label: 'Due in 30 days', value: dueSoon, color: 'bg-amber-400' },
    { label: 'Later', value: later, color: 'bg-slate-300' },
  ] : [];
  return (
    <section aria-labelledby="working-capital-title" className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_10px_32px_rgba(15,23,42,.05)] sm:p-6">
      <div className="mb-5 flex items-end justify-between">
        <div><h2 id="working-capital-title" className="text-lg font-bold text-gray-950">Working capital</h2><p className="mt-1 text-sm text-gray-500">What customers owe and what is due next</p></div>
        <Link to="/invoices" className="hidden items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-950 sm:flex">View all receivables <ArrowRight size={14} /></Link>
      </div>
      <div>
        <div>
          <p className="text-sm text-gray-600">Outstanding receivables</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-gray-950">{metricText(receivables.totalOutstanding)}</p>
          {receivables.totalOutstanding.state === 'empty' && <p className="mt-1 text-sm text-emerald-700">No outstanding balance</p>}
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            <div><p className="text-sm text-gray-500">Overdue</p><p className="mt-1 text-lg font-semibold text-red-700">{metricText(receivables.overdueAmount)}</p></div>
            <div><p className="text-sm text-gray-500">Due within 30 days</p><p className="mt-1 text-lg font-semibold text-amber-700">{metricText(receivables.dueSoonAmount)}</p></div>
          </div>
          {canShowAging && (
            <div className="mt-5" role="img" aria-label={aging.map((item) => `${item.label} ${formatCurrency(item.value)}`).join(', ')}>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100">
                {aging.filter((item) => item.value > 0).map((item) => <span key={item.label} className={item.color} style={{ width: `${Math.max(2, (item.value / total) * 100)}%` }} />)}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {aging.map((item) => <span key={item.label} className="inline-flex items-center gap-1.5 text-xs text-gray-500"><span className={`h-2 w-2 rounded-full ${item.color}`} />{item.label}</span>)}
              </div>
            </div>
          )}
          {receivables.priorityItems.length > 0 ? (
            <div className="mt-5 space-y-1">
              {receivables.priorityItems.map((item) => (
                <Link key={item.id} to={`/invoices/${item.id}/edit`} className="group relative grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl px-2 py-2.5 pr-8 outline-none transition-all duration-200 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-700 sm:grid-cols-[minmax(0,1fr)_auto_110px] sm:items-center">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900">{item.customer}</p><p className="text-xs text-gray-500">{item.invoiceNumber}</p></div>
                  <p className="text-sm font-semibold tabular-nums text-gray-950 transition-colors group-hover:text-emerald-700">{formatCurrency(item.timing === 'paid' ? item.invoiceTotal : item.outstanding)}</p>
                  <p className={`col-span-2 text-xs font-medium sm:col-span-1 sm:text-right ${item.timing === 'paid' ? 'text-emerald-700' : item.timing === 'overdue' ? 'text-red-700' : item.timing === 'due-soon' ? 'text-amber-700' : 'text-gray-500'}`}>{receivableStatus(item)}</p>
                  <ArrowRight size={14} className="absolute right-2 top-1/2 -translate-x-1 -translate-y-1/2 text-slate-400 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          ) : <p className="mt-5 text-sm text-gray-500">No actionable receivables for this entity.</p>}
          <Link to="/invoices" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-950 sm:hidden">View all receivables <ArrowRight size={14} /></Link>
        </div>
        <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-sm font-semibold text-gray-900">Estimated GST payable</p><MetricValue metric={gst} className="mt-1 text-xl font-bold" /><p className="mt-1 text-xs leading-5 text-gray-500">{gst.value === 0 ? 'No estimated liability for this period.' : data.obligations.gstDueDate ? `Due ${formatDate(data.obligations.gstDueDate)}` : 'Filing due date is not available.'}</p></div>
            <Link to="/gst-summary" aria-label="Review GST" className="grid min-h-9 min-w-9 place-items-center rounded-full bg-white text-slate-700 shadow-sm outline-none hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-700"><ArrowRight size={15} /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

interface PerformanceTooltipItem {
  name?: string;
  value?: number;
  color?: string;
  payload?: { periodLabel?: string };
}

function PerformanceTooltip({ active, payload }: { active?: boolean; payload?: PerformanceTooltipItem[] }) {
  if (!active || !payload?.length) return null;
  return <div className="min-w-48 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-white shadow-[0_16px_40px_rgba(15,23,42,.3)] backdrop-blur"><p className="mb-2 text-xs font-semibold text-slate-300">{payload[0]?.payload?.periodLabel}</p><div className="space-y-1.5">{payload.map((item) => <div key={item.name} className="flex items-center justify-between gap-5 text-xs"><span className="flex items-center gap-2 text-slate-300"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-semibold tabular-nums text-white">{formatCurrency(Number(item.value ?? 0))}</span></div>)}</div></div>;
}

export function PerformanceSection({ data, goal, goalPercent, onEditGoal }: { data: DashboardFinancialData; goal: number; goalPercent: number; onEditGoal: () => void }) {
  const snapshot = data.financialSnapshot;
  const trend = data.performanceTrend.map((point) => ({ ...point, label: new Date(`${point.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' }), periodLabel: new Date(`${point.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }));
  const chartReliable = !['error', 'unavailable'].includes(snapshot.revenue.state) && !['error', 'unavailable'].includes(snapshot.operatingExpenses.state);
  const hasTrend = trend.some((point) => point.revenue !== 0 || point.operatingExpenses !== 0 || point.operatingResult !== 0);
  const chartSummary = trend.map((point) => `${point.label}: revenue ${formatCurrency(point.revenue)}, expenses ${formatCurrency(point.operatingExpenses)}, result ${formatCurrency(point.operatingResult)}`).join('; ');
  return (
    <section aria-labelledby="performance-title" className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_10px_32px_rgba(15,23,42,.05)] sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="performance-title" className="text-lg font-bold text-gray-950">Performance</h2><p className="mt-1 text-sm text-gray-500">Six-month accrual view · INR</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">6M</span></div>
      <div>
        <figure className="min-w-0">
            <figcaption className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-gray-600"><span className="mr-1 text-sm font-semibold text-gray-800">Revenue, expenses and result</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-500" />Revenue</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-300" />Expenses</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600" />Result</span></figcaption>
            {!chartReliable ? <div className="flex h-48 items-center justify-center rounded-xl bg-gray-50 px-5 text-center text-sm text-gray-500">Performance trend unavailable because supporting data could not be loaded.</div> : !hasTrend ? <div className="flex h-48 items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-500">No performance activity recorded for this period.</div> : (
              <>
                <p className="sr-only">{chartSummary}</p>
                <div role="img" aria-label={`Revenue, operating expenses and operating result for the last six months. ${chartSummary}`}>
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs><linearGradient id="revenueBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#64748b" /><stop offset="100%" stopColor="#334155" /></linearGradient><linearGradient id="expenseBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fca5a5" /><stop offset="100%" stopColor="#f87171" /></linearGradient></defs>
                      <CartesianGrid stroke="#eef2f7" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#4b5563', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#4b5563', fontSize: 12 }} axisLine={false} tickLine={false} width={54} tickFormatter={shortCurrency} />
                      <Tooltip content={<PerformanceTooltip />} cursor={{ fill: 'rgba(15,23,42,.035)', radius: 8 }} />
                      <Bar dataKey="revenue" name="Revenue" fill="url(#revenueBar)" maxBarSize={34} radius={[5, 5, 2, 2]} animationDuration={500}>{trend.map((point) => <Cell key={`revenue-${point.month}`} fill="url(#revenueBar)" fillOpacity={point.month === trend.at(-1)?.month ? 1 : .88} />)}</Bar>
                      <Bar dataKey="operatingExpenses" name="Expenses" fill="url(#expenseBar)" maxBarSize={34} radius={[5, 5, 2, 2]} animationDuration={500}>{trend.map((point) => <Cell key={`expense-${point.month}`} fill="url(#expenseBar)" fillOpacity={point.month === trend.at(-1)?.month ? 1 : .8} />)}</Bar>
                      <Line type="monotone" dataKey="operatingResult" name="Operating result" stroke={GREEN} strokeWidth={2.75} dot={{ r: 3, fill: '#ffffff', stroke: GREEN, strokeWidth: 2 }} activeDot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }} animationDuration={600} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
        </figure>
        <div className="mt-5 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50/60 p-4">
          <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-950">Collection target</p><p className="mt-1 text-sm text-emerald-800"><span className="font-bold tabular-nums">{metricText(snapshot.cashCollected)}</span> / {formatCurrency(goal)} · {goalPercent}%</p><p className="mt-1 text-xs font-medium text-emerald-700">{snapshot.cashCollected.value != null && snapshot.cashCollected.value >= goal ? 'Target achieved' : 'In progress'}</p></div><button onClick={onEditGoal} aria-label="Edit collection target" className="grid min-h-9 min-w-9 place-items-center rounded-full bg-white text-emerald-800 shadow-sm outline-none transition-all duration-200 hover:-translate-y-0.5 hover:text-emerald-950 focus-visible:ring-2 focus-visible:ring-emerald-700"><Pencil size={14} /></button></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100 shadow-inner" role="progressbar" aria-label="Monthly collection target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={goalPercent}><div className="relative h-full rounded-full bg-gradient-to-r from-emerald-600 to-cyan-500 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${goalPercent}%` }}><span className="absolute right-0 top-0 h-full w-4 bg-white/30 blur-sm" /></div></div>
        </div>
      </div>
    </section>
  );
}

function activityIcon(item: DashboardActivityItem) {
  if (item.type === 'payment-received') return <CircleDollarSign size={16} />;
  if (item.type === 'invoice-issued') return <FileText size={16} />;
  if (item.type === 'expense-recorded') return <ReceiptText size={16} />;
  return <WalletCards size={16} />;
}

function activityTime(date: string): string {
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const days = daysBetweenSafe(date, current);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days <= 30) return `${days} days ago`;
  return formatDate(date);
}

function daysBetweenSafe(from: string, to: string): number {
  const parse = (value: string) => { const [y, m, d] = value.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

export function RecentActivity({ items }: { items: DashboardActivityItem[] }) {
  return (
    <section aria-labelledby="activity-title" className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_10px_32px_rgba(15,23,42,.05)] sm:p-6">
      <div className="mb-3 flex items-end justify-between"><div><h2 id="activity-title" className="text-lg font-bold text-gray-950">Recent activity</h2><p className="mt-1 text-sm text-gray-500">Latest financial movements</p></div><Link to="/cash-flow" className="hidden items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-950 sm:flex">View all <ArrowRight size={14} /></Link></div>
      <div>
        {items.length === 0 ? <p className="py-5 text-sm text-gray-500">No recent financial activity for this entity.</p> : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <Link key={item.id} to={item.href} className="group grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-4 py-3 outline-none transition-all duration-200 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-700 sm:grid-cols-[32px_minmax(0,1fr)_140px_auto] sm:px-5">
                <span className={`grid h-8 w-8 place-items-center rounded-full transition-transform duration-200 group-hover:scale-105 ${item.direction === 'in' ? 'bg-emerald-50 text-emerald-700' : item.direction === 'out' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`} aria-hidden="true">{activityIcon(item)}</span>
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900">{item.title}</p><p className="truncate text-xs text-gray-500">{item.counterparty}</p></div>
                <p className="hidden text-sm text-gray-500 sm:block">{activityTime(item.date)}</p>
                <p className={`text-sm font-bold tabular-nums transition-transform duration-200 group-hover:-translate-x-0.5 ${item.direction === 'in' ? 'text-green-700' : item.direction === 'out' ? 'text-red-700' : 'text-gray-950'}`}>{item.direction === 'in' ? <span className="sr-only">Incoming </span> : item.direction === 'out' ? <span className="sr-only">Outgoing </span> : null}{item.direction === 'in' ? '+' : item.direction === 'out' ? '−' : ''}{formatCurrency(item.amount)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function DashboardLoading() {
  return <div className="space-y-5" aria-live="polite" aria-label="Loading dashboard"><div className="h-72 animate-pulse rounded-3xl bg-gray-100" /><div className="grid gap-5 xl:grid-cols-2"><div className="h-80 animate-pulse rounded-2xl bg-gray-100" /><div className="h-80 animate-pulse rounded-2xl bg-gray-100" /></div></div>;
}

export function DashboardFatalError({ onRetry }: { onRetry: () => void }) {
  return <div role="alert" className="border border-red-200 bg-red-50 px-5 py-6"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 text-red-700" size={18} /><div><p className="font-semibold text-red-950">The financial dashboard could not be loaded</p><p className="mt-1 text-sm text-red-800">No financial values are being shown until the data can be read reliably.</p><button onClick={onRetry} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-red-300 bg-white px-3 text-sm font-semibold text-red-800 focus-visible:ring-2 focus-visible:ring-red-700"><RefreshCw size={14} /> Retry</button></div></div></div>;
}
