export type CashFlowComparisonMode = 'none' | 'previous' | 'last-year';

export type CashFlowPeriodKey =
  | 'last-7-days'
  | 'last-15-days'
  | 'this-month'
  | 'last-month'
  | 'this-quarter'
  | 'last-quarter'
  | 'last-6-months'
  | 'this-year'
  | 'last-year'
  | 'custom';

export interface CashFlowDateRange {
  start: string;
  end: string;
}

export interface AnalysisTransaction {
  id: string;
  date: string;
  type: 'in' | 'out';
  category: string;
  description: string;
  amount: number;
  payment_mode: string;
  reference: string | null;
  sub_brand: string | null;
  created_at: string;
}

export interface TimelinePoint {
  key: string;
  label: string;
  fullLabel: string;
  inflow: number;
  outflow: number;
  net: number;
  comparisonInflow?: number;
  comparisonOutflow?: number;
  comparisonNet?: number;
}

export interface RankedCashGroup {
  name: string;
  amount: number;
  percentage: number;
  count: number;
  change: number | null;
  previousAmount: number;
  transactions: AnalysisTransaction[];
}

export type RecurringKind = 'business' | 'personal' | 'transfer' | 'other';

export interface RecurringCost {
  key: string;
  name: string;
  category: string;
  monthlyAverage: number;
  total: number;
  occurrences: number;
  activeMonths: number;
  frequencyLabel: string;
  kind: RecurringKind;
  evidenceLabel: string;
  transactions: AnalysisTransaction[];
}

export interface CashFlowInsight {
  id: string;
  title: string;
  detail: string;
  amountLabel: string;
  tone: 'positive' | 'attention' | 'neutral';
  filter?: { type?: 'in' | 'out'; category?: string; month?: string };
}

export interface CashFlowAnalysis {
  transactions: AnalysisTransaction[];
  comparisonTransactions: AnalysisTransaction[];
  totalIn: number;
  totalOut: number;
  net: number;
  openingBalance: number;
  closingBalance: number;
  comparisonIn: number;
  comparisonOut: number;
  comparisonNet: number;
  inflowChange: number | null;
  outflowChange: number | null;
  netChange: number | null;
  expenseIncomeRatio: number | null;
  averageMonthlyInflow: number;
  averageMonthlyOutflow: number;
  averageMonthlyNet: number;
  timeline: TimelinePoint[];
  expenseCategories: RankedCashGroup[];
  inflowSources: RankedCashGroup[];
  recurringCosts: RecurringCost[];
  recurringBusinessCosts: RecurringCost[];
  recurringPersonalMovements: RecurringCost[];
  recurringTransfers: RecurringCost[];
  estimatedRecurringMonthlyCost: number;
  estimatedRecurringMonthlyPersonal: number;
  topSpending: AnalysisTransaction[];
  topThreeExpenseAmount: number;
  topThreeExpenseShare: number;
  positivePeriods: number;
  healthLabel: 'Stable' | 'Mixed' | 'Under pressure' | 'Insufficient data';
  healthExplanation: string;
  largestExpenseCategory: string | null;
  categoryChanges: RankedCashGroup[];
  topOneInflowShare: number;
  topThreeInflowShare: number;
  insights: CashFlowInsight[];
}

const DAY_MS = 86_400_000;

function localDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function sum(transactions: AnalysisTransaction[], type: 'in' | 'out'): number {
  return transactions.reduce((total, transaction) => (
    transaction.type === type ? total + Number(transaction.amount || 0) : total
  ), 0);
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: '2-digit',
  });
}

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function enumerateMonths(range: CashFlowDateRange): string[] {
  const start = localDate(range.start);
  const end = localDate(range.end);
  const result: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    result.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

function buildTimeline(
  transactions: AnalysisTransaction[],
  comparison: AnalysisTransaction[],
  range: CashFlowDateRange,
): TimelinePoint[] {
  const start = localDate(range.start);
  const end = localDate(range.end);
  const totalDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const useDays = totalDays <= 45;
  const currentBuckets = new Map<string, { inflow: number; outflow: number }>();
  const comparisonBuckets = new Map<string, { inflow: number; outflow: number }>();

  const add = (map: Map<string, { inflow: number; outflow: number }>, transaction: AnalysisTransaction, key: string) => {
    const bucket = map.get(key) ?? { inflow: 0, outflow: 0 };
    bucket[transaction.type === 'in' ? 'inflow' : 'outflow'] += Number(transaction.amount || 0);
    map.set(key, bucket);
  };

  transactions.forEach((transaction) => add(currentBuckets, transaction, useDays ? transaction.date : monthKey(transaction.date)));

  if (useDays) {
    const keys: string[] = [];
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) keys.push(dateString(cursor));
    const comparisonSorted = [...comparison].sort((a, b) => a.date.localeCompare(b.date));
    comparisonSorted.forEach((transaction, index) => {
      const alignedKey = keys[Math.min(index, keys.length - 1)];
      if (alignedKey) add(comparisonBuckets, transaction, alignedKey);
    });
    return keys.map((key) => {
      const current = currentBuckets.get(key) ?? { inflow: 0, outflow: 0 };
      const previous = comparisonBuckets.get(key);
      const date = localDate(key);
      return {
        key,
        label: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        fullLabel: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
        ...current,
        net: current.inflow - current.outflow,
        comparisonInflow: previous?.inflow,
        comparisonOutflow: previous?.outflow,
        comparisonNet: previous ? previous.inflow - previous.outflow : undefined,
      };
    });
  }

  const keys = enumerateMonths(range);
  const comparisonMonths = [...new Set(comparison.map((transaction) => monthKey(transaction.date)))].sort();
  comparison.forEach((transaction) => {
    const sourceKey = monthKey(transaction.date);
    const index = comparisonMonths.indexOf(sourceKey);
    const alignedKey = keys[Math.min(index, keys.length - 1)];
    if (alignedKey) add(comparisonBuckets, transaction, alignedKey);
  });

  return keys.map((key) => {
    const current = currentBuckets.get(key) ?? { inflow: 0, outflow: 0 };
    const previous = comparisonBuckets.get(key);
    return {
      key,
      label: monthLabel(key),
      fullLabel: monthLabel(key),
      ...current,
      net: current.inflow - current.outflow,
      comparisonInflow: previous?.inflow,
      comparisonOutflow: previous?.outflow,
      comparisonNet: previous ? previous.inflow - previous.outflow : undefined,
    };
  });
}

function groupTransactions(
  transactions: AnalysisTransaction[],
  comparison: AnalysisTransaction[],
  type: 'in' | 'out',
  nameFor: (transaction: AnalysisTransaction) => string,
): RankedCashGroup[] {
  const current = new Map<string, AnalysisTransaction[]>();
  const previous = new Map<string, number>();
  transactions.filter((transaction) => transaction.type === type).forEach((transaction) => {
    const name = nameFor(transaction) || 'Uncategorised';
    current.set(name, [...(current.get(name) ?? []), transaction]);
  });
  comparison.filter((transaction) => transaction.type === type).forEach((transaction) => {
    const name = nameFor(transaction) || 'Uncategorised';
    previous.set(name, (previous.get(name) ?? 0) + Number(transaction.amount || 0));
  });
  const total = sum(transactions, type);
  return [...current.entries()]
    .map(([name, items]) => {
      const amount = items.reduce((value, item) => value + Number(item.amount || 0), 0);
      const previousAmount = previous.get(name) ?? 0;
      return {
        name,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
        count: items.length,
        change: comparison.length ? percentChange(amount, previousAmount) : null,
        previousAmount,
        transactions: items.sort((a, b) => b.date.localeCompare(a.date)),
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function classifyInflow(transaction: AnalysisTransaction): string {
  const category = normalizedText(transaction.category ?? '');
  const description = normalizedText(transaction.description ?? '');
  const classify = (value: string): string | null => {
    if (/client payment|customer payment|invoice payment|advance received/.test(value)) return 'Client Payment';
    if (/owner contribution|capital introduced|promoter contribution/.test(value)) return 'Owner Contribution';
    if (/investment|equity|capital infusion/.test(value)) return 'Investment / Capital';
    if (/loan|financing|borrow/.test(value)) return 'Loan / Financing';
    if (/refund|reimbursement/.test(value)) return 'Refund';
    if (/personal transfer in|transfer from owner/.test(value)) return 'Owner Contribution';
    if (/transfer in|bank transfer in|inter account transfer/.test(value)) return 'Transfer In';
    if (/other income|interest income|miscellaneous income/.test(value)) return 'Other Income';
    return null;
  };
  const fromCategory = classify(category);
  if (fromCategory) return fromCategory;
  // Description is only a fallback when the structured category is absent or generic.
  if (!category || /^(other|uncategorised|uncategorized|miscellaneous)$/.test(category)) {
    return classify(description) ?? 'Unclassified';
  }
  return 'Unclassified';
}

function recurringKind(category: string): RecurringKind {
  const value = normalizedText(category);
  if (/personal|owner draw|drawings|withdrawal/.test(value)) return 'personal';
  if (/transfer/.test(value)) return 'transfer';
  if (/salary|payroll|vendor|office|rent|tax|travel|software|marketing|utilities|professional|freelancer|inventory|purchase|maintenance|insurance|bank charge/.test(value)) return 'business';
  return 'other';
}

function recurringCosts(transactions: AnalysisTransaction[]): RecurringCost[] {
  const groups = new Map<string, AnalysisTransaction[]>();
  transactions.filter((transaction) => transaction.type === 'out').forEach((transaction) => {
    const normalized = transaction.description
      .toLowerCase()
      .replace(/\b\d+\b/g, '')
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const key = `${transaction.category.toLowerCase()}::${normalized || transaction.category.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  });

  return [...groups.entries()].flatMap(([key, items]) => {
    const months = new Set(items.map((item) => monthKey(item.date)));
    if (items.length < 3 || months.size < 2) return [];
    const total = items.reduce((value, item) => value + Number(item.amount || 0), 0);
    const ascending = [...items].sort((a, b) => a.date.localeCompare(b.date));
    const sorted = [...ascending].reverse();
    const gaps = ascending.slice(1).map((item, index) => (
      (localDate(item.date).getTime() - localDate(ascending[index].date).getTime()) / DAY_MS
    ));
    const averageGap = gaps.reduce((value, gap) => value + gap, 0) / Math.max(gaps.length, 1);
    const maxGapDeviation = Math.max(...gaps.map((gap) => Math.abs(gap - averageGap)), 0);
    const averageAmount = total / items.length;
    const maxAmountDeviation = Math.max(...items.map((item) => Math.abs(item.amount - averageAmount) / Math.max(averageAmount, 1)), 0);
    const timingConsistent = (averageGap <= 12 && maxGapDeviation <= 6) || (averageGap >= 20 && averageGap <= 45 && maxGapDeviation <= 14);
    const amountConsistent = maxAmountDeviation <= 0.4;
    if (!timingConsistent || !amountConsistent) return [];
    const frequencyLabel = averageGap <= 12 ? 'Weekly pattern' : 'Monthly pattern';
    const kind = recurringKind(sorted[0].category);
    return [{
      key,
      name: sorted[0].description,
      category: sorted[0].category,
      monthlyAverage: total / months.size,
      total,
      occurrences: items.length,
      activeMonths: months.size,
      frequencyLabel,
      kind,
      evidenceLabel: `${items.length} similar amounts across ${months.size} months`,
      transactions: sorted,
    }];
  }).sort((a, b) => b.monthlyAverage - a.monthlyAverage);
}

export function getPresetRange(period: CashFlowPeriodKey, today = new Date()): CashFlowDateRange {
  const y = today.getFullYear();
  const m = today.getMonth();
  const quarterStartMonth = Math.floor(m / 3) * 3;
  switch (period) {
    case 'last-7-days': return { start: dateString(addDays(today, -6)), end: dateString(today) };
    case 'last-15-days': return { start: dateString(addDays(today, -14)), end: dateString(today) };
    case 'this-month': return { start: dateString(new Date(y, m, 1)), end: dateString(today) };
    case 'last-month': return { start: dateString(new Date(y, m - 1, 1)), end: dateString(new Date(y, m, 0)) };
    case 'this-quarter': return { start: dateString(new Date(y, quarterStartMonth, 1)), end: dateString(today) };
    case 'last-quarter': return { start: dateString(new Date(y, quarterStartMonth - 3, 1)), end: dateString(new Date(y, quarterStartMonth, 0)) };
    case 'last-6-months': return { start: dateString(new Date(y, m - 5, 1)), end: dateString(today) };
    case 'this-year': return { start: `${y}-01-01`, end: dateString(today) };
    case 'last-year': return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
    case 'custom': return { start: dateString(new Date(y, m - 5, 1)), end: dateString(today) };
  }
}

export function getComparisonRange(range: CashFlowDateRange, mode: CashFlowComparisonMode): CashFlowDateRange | null {
  if (mode === 'none') return null;
  const start = localDate(range.start);
  const end = localDate(range.end);
  if (mode === 'last-year') {
    return {
      start: dateString(new Date(start.getFullYear() - 1, start.getMonth(), start.getDate())),
      end: dateString(new Date(end.getFullYear() - 1, end.getMonth(), end.getDate())),
    };
  }
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  return { start: dateString(addDays(start, -days)), end: dateString(addDays(start, -1)) };
}

export function buildCashFlowAnalysis(args: {
  transactions: AnalysisTransaction[];
  comparisonTransactions?: AnalysisTransaction[];
  openingBalance: number;
  range: CashFlowDateRange;
}): CashFlowAnalysis {
  const transactions = args.transactions.map((transaction) => ({ ...transaction, amount: Number(transaction.amount || 0) }));
  const comparison = (args.comparisonTransactions ?? []).map((transaction) => ({ ...transaction, amount: Number(transaction.amount || 0) }));
  const totalIn = sum(transactions, 'in');
  const totalOut = sum(transactions, 'out');
  const net = totalIn - totalOut;
  const comparisonIn = sum(comparison, 'in');
  const comparisonOut = sum(comparison, 'out');
  const comparisonNet = comparisonIn - comparisonOut;
  const timeline = buildTimeline(transactions, comparison, args.range);
  const months = Math.max(1, enumerateMonths(args.range).length);
  const expenseCategories = groupTransactions(transactions, comparison, 'out', (transaction) => transaction.category);
  const inflowSources = groupTransactions(transactions, comparison, 'in', classifyInflow);
  const recurring = recurringCosts(transactions);
  const recurringBusiness = recurring.filter((item) => item.kind === 'business');
  const recurringPersonal = recurring.filter((item) => item.kind === 'personal');
  const recurringTransfers = recurring.filter((item) => item.kind === 'transfer');
  const positivePeriods = timeline.filter((point) => point.net > 0).length;
  let healthLabel: CashFlowAnalysis['healthLabel'] = 'Insufficient data';
  let healthExplanation = 'Add more transactions to establish a reliable cash movement pattern.';
  if (transactions.length > 0) {
    if (net >= 0 && positivePeriods >= Math.ceil(timeline.length * 0.6)) {
      healthLabel = 'Stable';
      healthExplanation = `Cash inflow exceeded outflow in ${positivePeriods} of ${timeline.length} measured periods.`;
    } else if (net >= 0 || positivePeriods >= Math.ceil(timeline.length * 0.4)) {
      healthLabel = 'Mixed';
      healthExplanation = `Cash movement was positive in ${positivePeriods} of ${timeline.length} measured periods.`;
    } else {
      healthLabel = 'Under pressure';
      healthExplanation = `Outflow exceeded inflow across most of the selected period.`;
    }
  }

  const insights: CashFlowInsight[] = [];
  const changedCategory = expenseCategories.find((category) => category.change !== null && Math.abs(category.change) >= 15);
  if (changedCategory) {
    const increased = (changedCategory.change ?? 0) > 0;
    insights.push({
      id: 'category-change',
      title: `${changedCategory.name} spending ${increased ? 'increased' : 'decreased'}`,
      detail: `${changedCategory.name} moved ${Math.abs(changedCategory.change ?? 0).toFixed(1)}% compared with the comparison period.`,
      amountLabel: `${formatCompactCurrency(changedCategory.previousAmount)} → ${formatCompactCurrency(changedCategory.amount)}`,
      tone: increased ? 'attention' : 'positive',
      filter: { type: 'out', category: changedCategory.name },
    });
  }
  if (recurringBusiness[0]) {
    insights.push({
      id: 'recurring',
      title: `Recurring ${recurringBusiness[0].category.toLowerCase()} costs`,
      detail: `${recurringBusiness[0].occurrences} similar transactions appeared across ${recurringBusiness[0].activeMonths} months.`,
      amountLabel: `${formatCompactCurrency(recurringBusiness[0].monthlyAverage)} / month`,
      tone: 'neutral',
      filter: { type: 'out', category: recurringBusiness[0].category },
    });
  }
  const highestOutflow = [...timeline].sort((a, b) => b.outflow - a.outflow)[0];
  if (highestOutflow?.outflow > 0) {
    insights.push({
      id: 'highest-outflow',
      title: 'Highest spending period',
      detail: `${highestOutflow.fullLabel} had the highest total outflow in the selected range.`,
      amountLabel: formatCompactCurrency(highestOutflow.outflow),
      tone: 'attention',
      filter: { type: 'out', month: highestOutflow.key },
    });
  }
  const strongest = [...timeline].sort((a, b) => b.net - a.net)[0];
  if (strongest && strongest.net !== 0) {
    insights.push({
      id: 'strongest-period',
      title: 'Strongest cash-flow period',
      detail: `${strongest.fullLabel} generated the highest net cash flow.`,
      amountLabel: `${strongest.net >= 0 ? '+' : '−'}${formatCompactCurrency(Math.abs(strongest.net))}`,
      tone: strongest.net >= 0 ? 'positive' : 'neutral',
      filter: { month: strongest.key },
    });
  }

  return {
    transactions,
    comparisonTransactions: comparison,
    totalIn,
    totalOut,
    net,
    openingBalance: args.openingBalance,
    closingBalance: args.openingBalance + net,
    comparisonIn,
    comparisonOut,
    comparisonNet,
    inflowChange: comparison.length ? percentChange(totalIn, comparisonIn) : null,
    outflowChange: comparison.length ? percentChange(totalOut, comparisonOut) : null,
    netChange: comparison.length ? percentChange(net, comparisonNet) : null,
    expenseIncomeRatio: totalIn > 0 ? (totalOut / totalIn) * 100 : null,
    averageMonthlyInflow: totalIn / months,
    averageMonthlyOutflow: totalOut / months,
    averageMonthlyNet: net / months,
    timeline,
    expenseCategories,
    inflowSources,
    recurringCosts: recurring,
    recurringBusinessCosts: recurringBusiness,
    recurringPersonalMovements: recurringPersonal,
    recurringTransfers,
    estimatedRecurringMonthlyCost: recurringBusiness.reduce((value, item) => value + item.monthlyAverage, 0),
    estimatedRecurringMonthlyPersonal: recurringPersonal.reduce((value, item) => value + item.monthlyAverage, 0),
    topSpending: transactions.filter((transaction) => transaction.type === 'out').sort((a, b) => b.amount - a.amount).slice(0, 5),
    topThreeExpenseAmount: expenseCategories.slice(0, 3).reduce((value, category) => value + category.amount, 0),
    topThreeExpenseShare: expenseCategories.slice(0, 3).reduce((value, category) => value + category.percentage, 0),
    positivePeriods,
    healthLabel,
    healthExplanation,
    largestExpenseCategory: expenseCategories[0]?.name ?? null,
    categoryChanges: expenseCategories.filter((category) => category.change !== null).sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0)).slice(0, 4),
    topOneInflowShare: inflowSources[0]?.percentage ?? 0,
    topThreeInflowShare: inflowSources.slice(0, 3).reduce((value, source) => value + source.percentage, 0),
    insights,
  };
}
