import { useState, useEffect } from 'react'
import '../styles/shared.css'

// ── Constants ──────────────────────────────────────────────────────────────
export const CRITICALITY_COLORS = {
  High:   { badge: 'badge badge-high' },
  Medium: { badge: 'badge badge-medium' },
  Low:    { badge: 'badge badge-low' },
}

export const TREND_CONFIG = {
  Declining: { icon: '↓', color: '#c0392b' },
  Improving: { icon: '↑', color: '#27ae60' },
  Stable:    { icon: '—', color: '#7f8c8d' },
}

const GRADE_CLASS = {
  A:     'badge badge-grade-a',
  B:     'badge badge-grade-b',
  C:     'badge badge-grade-c',
  'N/A': 'badge badge-grade-na',
}

const CRITICAL_FLAG_CLASS = {
  Critical:           'badge badge-cf-critical',
  'Not Critical':     'badge badge-cf-not-critical',
  'Not Applicable':   'badge badge-cf-not-applicable',
}

// ── Shared style helpers ───────────────────────────────────────────────────
export function paginationButtonStyle(disabled) {
  return {
    padding: '8px 16px',
    fontSize: '14px',
    fontFamily: "'Inter', sans-serif",
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    backgroundColor: disabled ? '#f3f4f6' : 'var(--bg-card)',
    color: disabled ? '#9ca3af' : 'var(--text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

// ── Badge components ───────────────────────────────────────────────────────
export function CriticalityBadge({ value }) {
  if (!value) return '—'
  const cfg = CRITICALITY_COLORS[value]
  if (!cfg) return value
  return <span className={cfg.badge}>{value}</span>
}

export function TrendCell({ value }) {
  if (!value) return '—'
  const cfg = TREND_CONFIG[value]
  if (!cfg) return value
  return (
    <span style={{ color: cfg.color, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <span>{cfg.icon}</span>
      <span>{value}</span>
    </span>
  )
}

export function DaysCell({ value }) {
  if (value == null) return '—'
  return (
    <span>
      {value > 180 && <span style={{ color: '#e67e22', marginRight: '5px' }}>●</span>}
      {value}
    </span>
  )
}

export function GradeBadge({ value }) {
  if (!value) return '—'
  const cls = GRADE_CLASS[value] ?? 'badge badge-grade-other'
  return <span className={cls}>{value}</span>
}

export function CriticalFlagBadge({ value }) {
  if (!value) return '—'
  const cls = CRITICAL_FLAG_CLASS[value] ?? 'badge badge-cf-other'
  return <span className={cls}>{value}</span>
}

export function ViolationDescCell({ value }) {
  const [tipPos, setTipPos] = useState(null)
  const truncated = value ? (value.length > 80 ? value.slice(0, 80) + '...' : value) : '—'
  const needsTip = value && value.length > 80

  const handleMouseMove = (e) => setTipPos({ x: e.clientX, y: e.clientY })

  return (
    <span
      onMouseEnter={(e) => needsTip && setTipPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTipPos(null)}
    >
      {truncated}
      {tipPos && (
        <span
          style={{
            position: 'fixed',
            top: tipPos.y - 8,
            left: tipPos.x + 12,
            transform: 'translateY(-100%)',
            zIndex: 9999,
            backgroundColor: '#2c3e50',
            color: '#ffffff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            maxWidth: '300px',
            width: 'max-content',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            lineHeight: '1.5',
            pointerEvents: 'none',
          }}
        >
          {value}
        </span>
      )}
    </span>
  )
}

// ── Info row ───────────────────────────────────────────────────────────────
export function InfoRow({ label, value }) {
  return (
    <div>
      <div className="info-row-label">{label}</div>
      <div className="info-row-value">{value ?? '—'}</div>
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────
export function StatCard({ label, value, pct }) {
  return (
    <div className="stat-card">
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
      {pct != null && (
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginBottom: '2px' }}>{pct}</div>
      )}
    </div>
  )
}

// ── Typewriter hook + cursor ───────────────────────────────────────────────
export function useTypewriter(text, speed = 5, enabled = true) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!enabled || !text) return
    let i = 0
    setDisplayed('')
    setDone(false)
    const id = setInterval(() => {
      i += 1
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        setDone(true)
        clearInterval(id)
      }
    }, speed)
    return () => clearInterval(id)
  }, [enabled, text, speed])

  return { displayed, done }
}

export function Cursor() {
  return <span className="tw-cursor">|</span>
}
