interface StatusPillProps {
  status: string;
  className?: string;
}

type Style = { dot: string; bg: string; text: string; label?: string };

const STYLES: Record<string, Style> = {
  paid: { dot: '#16a34a', bg: '#f0fdf4', text: '#15803d' },
  pending: { dot: '#d97706', bg: '#fffbeb', text: '#b45309' },
  partial: { dot: '#2563eb', bg: '#eff6ff', text: '#1d4ed8' },
  draft: { dot: '#6b7280', bg: '#f9fafb', text: '#4b5563' },
  sent: { dot: '#0ea5e9', bg: '#f0f9ff', text: '#0369a1' },
  cancelled: { dot: '#ef4444', bg: '#fef2f2', text: '#b91c1c' },
  overdue: { dot: '#ef4444', bg: '#fef2f2', text: '#b91c1c' },
};

const FALLBACK: Style = { dot: '#6b7280', bg: '#f9fafb', text: '#4b5563' };

/** Rounded status badge with a colored dot — used across invoice/quotation/receipt tables. */
export function StatusPill({ status, className = '' }: StatusPillProps) {
  const key = (status || '').toLowerCase();
  const s = STYLES[key] || FALLBACK;
  const label = s.label || (status ? status.charAt(0).toUpperCase() + status.slice(1) : '—');

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${className}`}
      style={{
        background: s.bg,
        color: s.text,
        fontSize: 11,
        padding: '3px 10px',
        letterSpacing: '0.01em',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 9999, background: s.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}
