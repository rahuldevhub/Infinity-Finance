import { useState, useEffect } from 'react';
import type { DashboardStats } from '../../types';
import { formatCurrency, getMonthLabel } from '../../utils/formatters';

const syne: React.CSSProperties = { fontFamily: "'Syne', sans-serif" };

const PAYMENT_MODES = [
  { label: 'Razorpay', pct: 68, fill: '#1a56db' },
  { label: 'Bank Transfer', pct: 24, fill: '#10b981' },
  { label: 'Cash', pct: 8, fill: '#f59e0b' },
];

interface GSTBreakdownProps {
  stats: DashboardStats;
  year: number;
  month: number;
}

export function GSTBreakdown({ stats, year, month }: GSTBreakdownProps) {
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBarsReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 tracking-tight" style={syne}>
          GST Breakdown
        </h3>
        <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
          {getMonthLabel(year, month)}
        </span>
      </div>

      {/* Stat rows */}
      <div className="divide-y divide-gray-50">
        <div className="flex justify-between items-center py-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            <span className="text-xs text-gray-500">GST Collected</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">{formatCurrency(stats.totalGSTCollected)}</span>
        </div>
        <div className="flex justify-between items-center py-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span className="text-xs text-gray-500">ITC Available</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">{formatCurrency(stats.itcAvailable)}</span>
        </div>
      </div>

      {/* Net GST Payable */}
      <div className="bg-blue-50 rounded-xl p-3.5 mt-3 flex justify-between items-center">
        <span className="text-xs text-gray-500">Net GST Payable</span>
        <span className="text-base font-bold text-blue-600" style={syne}>
          {formatCurrency(Math.abs(stats.netGSTPayable))}
        </span>
      </div>

      {/* Payment Modes */}
      <div className="mt-4">
        <p className="text-[9px] font-medium text-gray-400 uppercase tracking-widest mb-3">
          Payment Modes
        </p>
        <div className="space-y-2.5">
          {PAYMENT_MODES.map((pm) => (
            <div key={pm.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-600">{pm.label}</span>
                <span className="text-[11px] text-gray-400">{pm.pct}%</span>
              </div>
              <div className="bg-gray-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    background: pm.fill,
                    width: barsReady ? `${pm.pct}%` : '0%',
                    transition: 'width 0.8s ease-out',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
