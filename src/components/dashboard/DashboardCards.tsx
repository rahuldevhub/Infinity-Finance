import type React from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface CardProps {
  stripe: string
  iconBg: string
  iconColor: string
  Icon: React.ElementType
  label: string
  value: string
  sub: string
  /** Percentage change vs previous month. Omit to hide the trend chip. */
  delta?: number | null
  /** When true, a rising value is good (green up); when false, rising is bad (red up). */
  positiveIsGood?: boolean
  /** Small series for the inline sparkline. */
  spark?: number[]
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null
  const w = 72
  const h = 28
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = w / (data.length - 1)
  const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`)
  const line = pts.join(' ')
  const area = `0,${h} ${line} ${w},${h}`
  const gid = `spark-${color.replace('#', '')}`

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MetricCard({ stripe, iconBg, iconColor, Icon, label, value, sub, delta, positiveIsGood = true, spark }: CardProps) {
  const hasDelta = delta !== null && delta !== undefined && isFinite(delta)
  const rising = hasDelta && (delta as number) >= 0
  const good = hasDelta && (rising === positiveIsGood)
  const trendColor = good ? '#16a34a' : '#dc2626'
  const trendBg = good ? '#f0fdf4' : '#fef2f2'

  return (
    <div className="hover-lift" style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', position: 'relative', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 12px 28px rgba(16,24,40,0.06)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: stripe }} />

      <div style={{ padding: '18px 18px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={19} color={iconColor} strokeWidth={1.9} />
          </div>
          {hasDelta && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
              background: trendBg, color: trendColor,
            }}>
              {rising ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(delta as number).toFixed(0)}%
            </span>
          )}
        </div>

        <p style={{ fontSize: 11, color: '#98a2b3', marginBottom: 4, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', margin: 0 }}>{label}</p>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          <p style={{ fontSize: 23, fontWeight: 800, color: '#101828', letterSpacing: '-0.03em', lineHeight: 1.1, fontFamily: '"Nunito", ui-rounded, sans-serif', margin: 0 }}>
            {value}
          </p>
          {spark && spark.length > 1 && (
            <div style={{ flexShrink: 0, marginBottom: 2 }}>
              <Sparkline data={spark} color={iconColor} />
            </div>
          )}
        </div>

        <p style={{ fontSize: 11.5, color: '#98a2b3', marginTop: 8, marginBottom: 0 }}>
          {hasDelta && <span style={{ color: trendColor, fontWeight: 600 }}>{rising ? '↑' : '↓'} {Math.abs(delta as number).toFixed(0)}% </span>}
          {sub}
        </p>
      </div>
    </div>
  )
}

interface CompactMetricProps {
  Icon: React.ElementType
  iconBg: string
  iconColor: string
  label: string
  value: string
  delta?: number | null
  positiveIsGood?: boolean
  /** Override the value color (e.g. green for income, red for expense). */
  valueColor?: string
}

/** Slim metric row for the hero right-rail. */
export function CompactMetric({ Icon, iconBg, iconColor, label, value, delta, positiveIsGood = true, valueColor = '#101828' }: CompactMetricProps) {
  const hasDelta = delta !== null && delta !== undefined && isFinite(delta)
  const rising = hasDelta && (delta as number) >= 0
  const good = hasDelta && (rising === positiveIsGood)
  const trendColor = good ? '#16a34a' : '#dc2626'

  return (
    <div className="hover-lift flex items-center gap-3" style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 20px rgba(16,24,40,0.05)' }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={iconColor} strokeWidth={1.9} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 10.5, color: '#98a2b3', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 18, fontWeight: 800, color: valueColor, letterSpacing: '-0.02em', fontFamily: '"Nunito", ui-rounded, sans-serif', margin: '2px 0 0' }}>{value}</p>
      </div>
      {hasDelta && (
        <span style={{ fontSize: 11, fontWeight: 700, color: trendColor, flexShrink: 0 }}>
          {rising ? '↑' : '↓'} {Math.abs(delta as number).toFixed(0)}%
        </span>
      )}
    </div>
  )
}
