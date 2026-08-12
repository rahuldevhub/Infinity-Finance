export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  // Parse date-only strings (YYYY-MM-DD) as LOCAL, not UTC. `new Date('2026-06-30')`
  // is interpreted as UTC midnight, which renders as the previous day in timezones
  // behind UTC. Datetime strings (with a 'T') are left to the native parser.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const date = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format a Date as `YYYY-MM-DD` using LOCAL calendar parts.
 * Use this instead of `date.toISOString().split('T')[0]`, which converts to UTC
 * first and can shift the date a day backward/forward near midnight.
 */
export function toLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toInputDate(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

export function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: toLocalDateString(start),
    end: toLocalDateString(end),
  };
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: toLocalDateString(start),
    end: toLocalDateString(end),
  };
}

export function getMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
