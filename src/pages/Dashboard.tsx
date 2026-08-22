import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Plus,
  TrendingUp, BarChart2, FileText, ArrowDownCircle, ShieldCheck, Clock,
  Receipt, ClipboardList, BadgeCheck, Target, Activity, Pencil,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

// Semantic finance colors — green = money in, red = money out
const INCOME = '#16a34a';
const EXPENSE = '#dc2626';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useDashboard } from '../hooks/useDashboard';
import { useWorkspace } from '../context/WorkspaceContext';
import { MetricCard, CompactMetric } from '../components/dashboard/DashboardCards';
import { StatusPill } from '../components/ui/StatusPill';
import { formatCurrency, formatDate, getMonthLabel } from '../utils/formatters';

// ─── Payment mode bars with animation ────────────────────────────────────────
const PAYMENT_MODES = [
  { label: 'Razorpay', pct: 68, color: 'bg-blue-600' },
  { label: 'Bank Transfer', pct: 24, color: 'bg-emerald-500' },
  { label: 'Cash', pct: 8, color: 'bg-amber-500' },
];

function PaymentBars() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="mt-4">
      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Payment Modes</p>
      {PAYMENT_MODES.map(({ label, pct, color }) => (
        <div key={label} className="mb-3 last:mb-0">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-gray-600">{label}</span>
            <span className="text-xs text-gray-400">{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${color} transition-all duration-700`}
              style={{ width: ready ? `${pct}%` : '0%' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Quick action pills ───────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Invoice', to: '/invoices/new', icon: FileText },
  { label: 'Quotation', to: '/quotations/new', icon: ClipboardList },
  { label: 'Receipt', to: '/receipts/new', icon: BadgeCheck },
  { label: 'Expense', to: '/expenses', icon: Receipt },
];

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export function Dashboard() {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const accent = workspace.accent;
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [goal, setGoal] = useState<number>(() => Number(localStorage.getItem('revenueGoal')) || 25000);

  const { stats, monthlyData, trends, recentInvoices, loading } = useDashboard(year, month);

  function editGoal() {
    const v = window.prompt('Set monthly revenue goal (₹)', String(goal));
    if (v == null) return;
    const n = parseFloat(v);
    if (!isNaN(n) && n > 0) {
      setGoal(n);
      localStorage.setItem('revenueGoal', String(n));
    }
  }

  // ── Derived: goal progress + business health (guarded for null stats) ──
  // Cash-basis: goal + health both track actual money collected (Payment Receipts),
  // not merely invoiced amounts — GST/receivables signals stay invoice-based below.
  const goalPct = stats ? Math.min(100, Math.round((stats.totalCollected / goal) * 100)) : 0;
  const profit = stats ? stats.totalCollected - stats.totalExpenses : 0;
  const pendingRatio = stats && stats.totalSales > 0 ? stats.pendingInvoicesValue / stats.totalSales : 0;
  const health = stats
    ? Math.min(100, Math.round(
        (stats.totalCollected > 0 ? 30 : 0) +
        (profit > 0 ? 30 : 0) +
        (stats.itcAvailable > 0 ? 15 : 0) +
        (pendingRatio < 0.4 ? 25 : pendingRatio < 0.7 ? 12 : 0)
      ))
    : 0;
  const healthLabel = health >= 80 ? 'Healthy' : health >= 55 ? 'Stable' : 'Needs attention';
  const healthColor = health >= 80 ? INCOME : health >= 55 ? '#f59e0b' : EXPENSE;
  const healthIndicators = stats
    ? [
        { label: 'Collections', ok: stats.totalCollected > 0, note: stats.totalCollected > 0 ? 'Positive' : 'None this month' },
        { label: 'Profit', ok: profit > 0, note: `${profit >= 0 ? '+' : '−'}${formatCurrency(Math.abs(profit))}` },
        { label: 'GST filing', ok: true, note: 'Ready to file' },
        { label: 'Receivables', ok: pendingRatio < 0.4, note: formatCurrency(stats.pendingInvoicesValue) },
      ]
    : [];

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())) return;
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const monthLabel = getMonthLabel(year, month);

  const collectedChartData = trends.collectedDaily;

  return (
    <div className="px-4 md:px-8 py-5 md:py-8 max-w-[1500px] mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight" style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
            Dashboard
          </h1>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{workspace.name} · {workspace.sub}</p>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm">
            <button onClick={prevMonth} className="text-gray-400 hover:text-gray-700 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-gray-800 min-w-[90px] text-center">{monthLabel}</span>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className="text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => navigate('/invoices/new')}
            className="hidden sm:flex items-center gap-1.5 text-white rounded-xl px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90 shadow-sm"
            style={{ background: accent }}
          >
            <Plus size={15} />
            <span className="hidden sm:inline">New Invoice</span>
          </button>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        {QUICK_ACTIONS.map(({ label, to, icon: Icon }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className="hover-lift flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors"
            style={{ background: 'rgba(var(--accent-rgb), 0.10)', color: accent }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-5 mb-6">
          <div className="h-[340px] bg-white rounded-2xl animate-pulse card-surface" />
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[88px] bg-white rounded-2xl animate-pulse card-surface" />
            ))}
          </div>
        </div>
      ) : stats ? (
        <>
          {/* ── Hero: Revenue chart + compact rail ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-5 mb-6">
            <div className="card-surface p-6">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Total Collected</p>
                  <div className="flex items-end gap-3 mt-1">
                    <span className="text-3xl font-extrabold text-gray-900" style={{ fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.03em' }}>
                      {formatCurrency(stats.totalCollected)}
                    </span>
                    {trends.collectedDelta != null && (
                      <span
                        className="mb-1 inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: trends.collectedDelta >= 0 ? '#f0fdf4' : '#fef2f2',
                          color: trends.collectedDelta >= 0 ? '#16a34a' : '#dc2626',
                        }}
                      >
                        {trends.collectedDelta >= 0 ? '▲' : '▼'} {Math.abs(trends.collectedDelta).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] bg-gray-50 border border-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                  {monthLabel}
                </span>
              </div>

              {collectedChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={collectedChartData} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={INCOME} stopOpacity={0.24} />
                        <stop offset="95%" stopColor={INCOME} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
                      width={44}
                    />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                      formatter={(val) => ['₹' + Number(val).toLocaleString('en-IN'), 'Collected']}
                    />
                    <Area type="monotone" dataKey="collected" stroke={INCOME} strokeWidth={2.5} fill="url(#revGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[240px]">
                  <p className="text-sm text-gray-400">No collections recorded this month</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <CompactMetric
                Icon={BarChart2} iconBg="#f0f9ff" iconColor="#0ea5e9"
                label="Total Sales" value={formatCurrency(stats.totalSales)} delta={trends.salesDelta}
              />
              <CompactMetric
                Icon={FileText} iconBg="#fffbeb" iconColor="#f59e0b"
                label="GST Collected" value={formatCurrency(stats.totalGSTCollected)} delta={trends.gstDelta}
              />
              <CompactMetric
                Icon={ArrowDownCircle} iconBg="#fef2f2" iconColor="#ef4444"
                label="Total Expenses" value={formatCurrency(stats.totalExpenses)} delta={trends.expensesDelta} positiveIsGood={false}
              />
              <CompactMetric
                Icon={ShieldCheck} iconBg="#f0fdf4" iconColor="#10b981"
                label="ITC Available" value={formatCurrency(stats.itcAvailable)}
              />
            </div>
          </div>

          {/* ── Secondary metrics ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
            <MetricCard
              stripe="#f59e0b"
              iconBg="#fffbeb" iconColor="#f59e0b" Icon={Clock}
              label="Pending Invoices" value={formatCurrency(stats.pendingInvoicesValue)}
              sub={`${stats.pendingInvoicesCount} invoices · ${stats.pendingProformasCount} proforma`}
            />
            <MetricCard
              stripe="#2563eb"
              iconBg="#eff6ff" iconColor="#2563eb" Icon={TrendingUp}
              label="GST Collected" value={formatCurrency(stats.totalGSTCollected)}
              sub="Output tax this month" delta={trends.gstDelta}
            />
            <MetricCard
              stripe={stats.netGSTPayable >= 0 ? EXPENSE : INCOME}
              iconBg={stats.netGSTPayable >= 0 ? '#fef2f2' : '#f0fdf4'}
              iconColor={stats.netGSTPayable >= 0 ? EXPENSE : INCOME} Icon={ShieldCheck}
              label={stats.netGSTPayable >= 0 ? 'Net GST Payable' : 'Net GST Credit'}
              value={formatCurrency(Math.abs(stats.netGSTPayable))}
              sub="After ITC adjustment"
            />
          </div>

          {/* ── Monthly Goal + Business Health ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            {/* Monthly Revenue Goal */}
            <div className="card-surface p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                    <Target size={16} color={INCOME} />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900">Monthly Revenue Goal</h2>
                </div>
                <button onClick={editGoal} className="text-gray-300 hover:text-gray-600 transition-colors" title="Edit goal">
                  <Pencil size={14} />
                </button>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-3xl font-extrabold text-gray-900" style={{ fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.03em' }}>{formatCurrency(stats.totalCollected)}</span>
                <span className="text-sm text-gray-400 mb-1">/ {formatCurrency(goal)}</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${goalPct}%`, background: INCOME }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-semibold" style={{ color: INCOME }}>{goalPct}% reached</span>
                <span className="text-xs text-gray-400">
                  {stats.totalCollected >= goal ? 'Goal achieved 🎉' : `${formatCurrency(goal - stats.totalCollected)} to go`}
                </span>
              </div>
            </div>

            {/* Business Health */}
            <div className="card-surface p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(var(--accent-rgb),0.06)' }}>
                    <Activity size={16} color="#0f172a" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900">Business Health</h2>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${healthColor}1a`, color: healthColor }}>{healthLabel}</span>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className="text-4xl font-extrabold" style={{ fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.03em', color: healthColor }}>{health}</span>
                  <span className="text-sm text-gray-400 font-semibold">/100</span>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2">
                  {healthIndicators.map((ind) => (
                    <div key={ind.label} className="flex items-center gap-1.5 min-w-0">
                      {ind.ok
                        ? <ArrowUpRight size={14} color={INCOME} className="shrink-0" />
                        : <ArrowDownRight size={14} color={EXPENSE} className="shrink-0" />}
                      <span className="text-xs text-gray-500 truncate">{ind.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Sales vs Expenses + GST Breakdown ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5 w-full">
            <div className="card-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900">Sales vs Expenses</h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: INCOME }} />Sales</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#f87171' }} />Expenses</span>
                  </div>
                  <span className="text-[10px] bg-gray-50 border border-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Last 6 months</span>
                </div>
              </div>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={monthlyData} barGap={4} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} width={44} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                      formatter={(val) => ['₹' + Number(val).toLocaleString('en-IN'), '']}
                    />
                    <Bar dataKey="sales" name="Sales" fill={INCOME} radius={[6, 6, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center min-h-[180px]">
                  <p className="text-sm text-gray-400">No chart data for this period</p>
                </div>
              )}
            </div>

            <div className="card-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900">GST Breakdown</h2>
                <span className="text-[10px] bg-gray-50 border border-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{monthLabel}</span>
              </div>

              <div className="divide-y divide-gray-50">
                <div className="flex items-center justify-between py-3">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />GST Collected
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(stats.totalGSTCollected)}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />ITC Available
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(stats.itcAvailable)}</span>
                </div>
              </div>

              <div
                className="rounded-xl p-3.5 mt-3 flex items-center justify-between"
                style={{ background: stats.netGSTPayable >= 0 ? '#fef2f2' : '#dcfce7' }}
              >
                <span className="text-xs text-gray-500 font-medium">{stats.netGSTPayable >= 0 ? 'Net GST Payable' : 'Net GST Credit'}</span>
                <span className="text-base font-bold" style={{ fontFamily: '"Nunito", ui-rounded, sans-serif', fontWeight: 800, color: stats.netGSTPayable >= 0 ? EXPENSE : INCOME }}>
                  {formatCurrency(Math.abs(stats.netGSTPayable))}
                </span>
              </div>

              <PaymentBars />
            </div>
          </div>
        </>
      ) : null}

      {/* ── Recent Invoices ── */}
      <div className="card-surface p-5 mt-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">Recent Invoices</h2>
          <Link to="/invoices" className="text-xs font-medium transition-colors hover:opacity-80" style={{ color: accent }}>
            View All
          </Link>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="py-10 text-center">
            <FileText size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">No invoices yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentInvoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-gray-50 -mx-5 px-5 transition-colors"
                onClick={() => navigate(`/invoices/${inv.id}/edit`)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{inv.client?.name}</p>
                  <p className="text-xs text-gray-400">
                    {inv.invoice_number}
                    <span className="hidden sm:inline"> · {formatDate(inv.invoice_date)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(inv.total_amount)}</span>
                  <StatusPill status={inv.payment_status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
