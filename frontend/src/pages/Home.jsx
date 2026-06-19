import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line,
  BarChart, Bar, Cell, LabelList,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Header } from '../components/Navbar'
import { CriticalityBadge, TrendCell, DaysCell, StatCard } from '../components/Shared'
import '../styles/shared.css'
import '../styles/home.css'

// ── Constants ──────────────────────────────────────────────────────────────
const URGENT_COLUMNS = [
  { key: 'camis',               label: 'CAMIS' },
  { key: 'dba',                 label: 'Restaurant Name' },
  { key: 'boro',                label: 'Area' },
  { key: 'cuisine_description', label: 'Cuisine' },
  { key: 'risk_score',          label: 'Risk Score' },
  { key: 'criticality',         label: 'Criticality' },
  { key: 'trend',               label: 'Trend' },
  { key: 'days_since_inspection', label: 'Days Since Inspection' },
]

const TREND_RANGES = [
  { value: '1y',  label: '1 Year',   months: 12 },
  { value: '3y',  label: '3 Years',  months: 36 },
  { value: '5y',  label: '5 Years',  months: 60 },
  { value: 'all', label: 'All Time', months: Infinity },
]

const GAP_ORDER  = ['0-30 days', '31-90 days', '91-180 days', '181-365 days', '365+ days']
const GAP_COLORS = {
  '0-30 days':    '#27ae60',
  '31-90 days':   '#2ecc71',
  '91-180 days':  '#e67e22',
  '181-365 days': '#d35400',
  '365+ days':    '#c0392b',
}
const HEATMAP_BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']
const HEATMAP_CUISINES = [
  'Chinese', 'Pizza', 'American', 'Latin American', 'Caribbean',
  'Mexican', 'Bakery Products/Desserts', 'Italian', 'Japanese', 'Coffee/Tea',
]

// ── Sub-components ─────────────────────────────────────────────────────────
function DailyBriefingCard({ loading, briefing = [] }) {
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric'})
  return (
    <div className="card" style={{ marginBottom: '24px', backgroundColor: '#1a2744' }}>
      <div className="briefing-header">
        <div>
          <div className="briefing-title">Weekly Briefing</div>
          <div className="briefing-subtitle">
            AI-generated insights based on current inspection data
          </div>
        </div>
        <span className="badge-cached">{todayLabel} | Refreshes every monday</span>
      </div>

      <div>
        {loading || briefing.length === 0 ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="briefing-skeleton-row">
              <div
                className="briefing-skeleton-block"
                style={{ width: `${60 + (i % 4) * 10}%` }}
              />
            </div>
          ))
        ) : (
          briefing.map((insight, i) => (
            <div key={i} className="briefing-row">
              {insight}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function UrgentRow({ row, index, onClick }) {
  const [hovered, setHovered] = useState(false)
  const baseColor = index % 2 === 0 ? 'var(--bg-card)' : 'var(--table-alt-row)'
  return (
    <tr
      style={{ backgroundColor: hovered ? 'var(--table-hover)' : baseColor, cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {URGENT_COLUMNS.map((col) => (
        <td
          key={col.key}
          style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}
        >
          {col.key === 'criticality' ? (
            <CriticalityBadge value={row[col.key]} />
          ) : col.key === 'trend' ? (
            <TrendCell value={row[col.key]} />
          ) : col.key === 'days_since_inspection' ? (
            <DaysCell value={row[col.key]} />
          ) : (
            row[col.key] ?? '—'
          )}
        </td>
      ))}
    </tr>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [trendRange, setTrendRange] = useState('3y')

  useEffect(() => {
    const controller = new AbortController()
    const fetchHome = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/home`, {
          signal: controller.signal,
          headers: { 'Authorization': `Bearer ${localStorage.getItem('safeplate_token')}` },
        })
        if (!res.ok) throw new Error('Request failed')
        setData(await res.json())
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    fetchHome()
    return () => controller.abort()
  }, [])

  const fmtMonth = (d) => {
    if (!d) return d
    const [year, month] = String(d).split('-')
    return new Date(Number(year), Number(month) - 1, 1)
      .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  return (
    <div className="page-wrapper">
      <Header />

      <div style={{ padding: '24px' }}>
        <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--heading-color)', marginBottom: '24px' }}>
          Overview
        </div>

        {loading ? (
          <>
            <div className="kpi-strip" style={{ marginBottom: '24px' }}>
              <StatCard label="Total Restaurants" value="—" />
              <StatCard label="High Risk Restaurants" value="—" />
              <StatCard label="Overdue for Inspection" value="—" />
              <StatCard label="Avg Risk Score" value="—" />
            </div>
            <DailyBriefingCard loading={true} briefing={[]} />
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Loading...
            </div>
          </>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '80px 16px', color: '#c0392b', fontSize: '14px' }}>
            Failed to load data.
          </div>
        ) : data ? (
          <>
            {/* Stats strip */}
            <div className="kpi-strip" style={{ marginBottom: '24px' }}>
              {(() => {
                const total = data.stats?.total_restaurants ?? 0
                const pct = (n) => total > 0 ? `(${((n / total) * 100).toFixed(1)}% of total)` : null
                return (
                  <>
                    <StatCard label="Total Restaurants"     value={total.toLocaleString()} />
                    <StatCard label="High Risk Restaurants" value={data.stats?.high_risk_count?.toLocaleString() ?? '—'} pct={pct(data.stats?.high_risk_count ?? 0)} />
                    <StatCard label="Overdue for Inspection" value={data.stats?.overdue_count?.toLocaleString() ?? '—'} pct={pct(data.stats?.overdue_count ?? 0)} />
                    <StatCard label="Avg Risk Score"        value={data.stats?.avg_risk_score ?? '—'} />
                  </>
                )
              })()}
            </div>

            {/* Daily Briefing */}
            <DailyBriefingCard loading={false} briefing={data.daily_briefing ?? []} />

            {/* Urgent Attention table */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="card-title">Requires Immediate Inspection</div>
              <div className="card-subtitle">
                High risk restaurants overdue for inspection (180+ days)
              </div>
              <div style={{ overflowX: 'auto', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: 'var(--text-primary)' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1a2744' }}>
                      {URGENT_COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          style={{
                            padding: '10px 14px',
                            textAlign: 'left',
                            color: '#ffffff',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data.urgent_restaurants ?? []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={URGENT_COLUMNS.length}
                          style={{ textAlign: 'center', padding: '40px 14px', color: 'var(--text-secondary)' }}
                        >
                          No restaurants require immediate attention.
                        </td>
                      </tr>
                    ) : (
                      (data.urgent_restaurants ?? []).map((row, i) => (
                        <UrgentRow
                          key={row.camis ?? i}
                          row={row}
                          index={i}
                          onClick={() => navigate(`/restaurants/${row.camis}`)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Row 1: Heatmap — full width */}
            {(() => {
              const heatmap       = data.heatmap ?? []
              const boroughTotals = data.heatmap_totals?.borough_totals ?? {}
              const cuisineTotals = data.heatmap_totals?.cuisine_totals  ?? {}
              const grandTotal    = data.heatmap_totals?.grand_total      ?? {}

              const lookup = {}
              heatmap.forEach((d) => {
                if (!lookup[d.boro]) lookup[d.boro] = {}
                lookup[d.boro][d.cuisine_description] = {
                  count: Number(d.high_risk_count  ?? 0),
                  pct:   Number(d.high_risk_percentage ?? 0),
                }
              })

              // Safely extract a percentage, never returning NaN
              const safePct = (val) => {
                const n = Number(val)
                return isNaN(n) ? 0 : n
              }

              const allPcts = [
                ...heatmap.map((d) => safePct(d.high_risk_percentage)),
                ...Object.values(boroughTotals).map((t) => safePct(t.high_risk_percentage)),
                ...Object.values(cuisineTotals).map((t) => safePct(t.high_risk_percentage)),
                safePct(grandTotal.high_risk_percentage),
              ]
              const maxPercentage = Math.max(0, ...allPcts)

              const getHeatmapColor = (percentage, maxPct) => {
                if (maxPct <= 0) return 'rgb(46,204,113)'
                const t = Math.min(percentage / maxPct, 1)
                if (t <= 0.5) {
                  const r = Math.round(46  + (243 - 46)  * (t / 0.5))
                  const g = Math.round(204 + (156 - 204) * (t / 0.5))
                  const b = Math.round(113 + (18  - 113) * (t / 0.5))
                  return `rgb(${r},${g},${b})`
                } else {
                  const r = Math.round(243 + (192 - 243) * ((t - 0.5) / 0.5))
                  const g = Math.round(156 + (57  - 156) * ((t - 0.5) / 0.5))
                  const b = Math.round(18  + (43  - 18)  * ((t - 0.5) / 0.5))
                  return `rgb(${r},${g},${b})`
                }
              }

              const dataStyle = (pct) => ({
                width: '100px',
                minWidth: '100px',
                maxWidth: '100px',
                padding: '6px 8px',
                textAlign: 'center',
                verticalAlign: 'middle',
                backgroundColor: getHeatmapColor(pct, maxPercentage),
                color: '#1a1a1a',
                border: '1px solid var(--border-color)',
              })

              const CellBody = ({ count, pct }) => (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', lineHeight: 1.2 }}>{count}</div>
                  <div style={{ fontSize: '10px', opacity: 0.8, lineHeight: 1.2 }}>{safePct(pct).toFixed(1)}%</div>
                </div>
              )

              return (
                <div className="card" style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--heading-color)', marginBottom: '2px' }}>
                    High Risk Restaurants: Borough vs Cuisine
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', marginBottom: '14px' }}>
                    Showing top 10 cuisine types by restaurant count
                  </div>
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '11px', width: '100%', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#1a2744' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left', color: '#ffffff', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap', minWidth: '120px', width: '120px' }}>
                            Borough
                          </th>
                          {HEATMAP_CUISINES.map((c) => (
                            <th key={c} style={{ padding: '6px 8px', textAlign: 'center', color: '#ffffff', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap', minWidth: '100px', width: '100px' }}>
                              {c}
                            </th>
                          ))}
                          <th style={{ padding: '6px 8px', textAlign: 'center', color: '#ffffff', fontWeight: '600', fontSize: '11px', backgroundColor: '#0f1a33', whiteSpace: 'nowrap', minWidth: '100px', width: '100px' }}>
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {HEATMAP_BOROUGHS.map((boro) => {
                          const bTotal = boroughTotals[boro] ?? {}
                          const bPct   = safePct(bTotal.high_risk_percentage)
                          return (
                            <tr key={boro}>
                              <td style={{ padding: '6px 8px', fontWeight: '700', color: 'var(--text-primary)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                {boro}
                              </td>
                              {HEATMAP_CUISINES.map((cuisine) => {
                                const cell = lookup[boro]?.[cuisine]
                                if (!cell) {
                                  return (
                                    <td key={cuisine} style={{ ...dataStyle(0), color: '#9ca3af' }}>—</td>
                                  )
                                }
                                return (
                                  <td key={cuisine} style={dataStyle(cell.pct)}>
                                    <CellBody count={cell.count} pct={cell.pct} />
                                  </td>
                                )
                              })}
                              <td style={{ ...dataStyle(bPct), fontWeight: 700 }}>
                                <CellBody count={bTotal.high_risk_count ?? 0} pct={bPct} />
                              </td>
                            </tr>
                          )
                        })}
                        {/* Total row */}
                        <tr>
                          <td style={{ padding: '6px 8px', fontWeight: '700', color: 'var(--heading-color)', fontSize: '11px', backgroundColor: 'var(--table-alt-row)', border: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                            Total
                          </td>
                          {HEATMAP_CUISINES.map((cuisine) => {
                            const cTotal = cuisineTotals[cuisine] ?? {}
                            const cPct   = safePct(cTotal.high_risk_percentage)
                            return (
                              <td key={cuisine} style={dataStyle(cPct)}>
                                <CellBody count={cTotal.high_risk_count ?? 0} pct={cPct} />
                              </td>
                            )
                          })}
                          <td style={{ ...dataStyle(safePct(grandTotal.high_risk_percentage)), fontWeight: 700 }}>
                            <CellBody count={grandTotal.high_risk_count ?? 0} pct={safePct(grandTotal.high_risk_percentage)} />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {/* Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '32px', marginTop: '16px', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                    {/* Sample cell + explanation */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {/* Sample cell */}
                      <div style={{
                        backgroundColor: '#f39c12',
                        border: '1px solid rgba(0,0,0,0.25)',
                        borderRadius: '3px',
                        padding: '6px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1px',
                        flexShrink: 0,
                      }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#1a1a1a', lineHeight: 1.2 }}>42</div>
                        <div style={{ fontSize: '10px', color: '#1a1a1a', opacity: 0.85, lineHeight: 1.2 }}>18.5%</div>
                      </div>
                      {/* Line-by-line explanations */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>42</span>
                          <span style={{ marginLeft: '5px' }}>= No. of high risk restaurants in that borough &amp; cuisine</span>
                        </div>
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>18.5%</span>
                          <span style={{ marginLeft: '5px' }}>= % of all restaurants in that borough &amp; cuisine that are high risk</span>
                        </div>
                      </div>
                    </div>
                    {/* Color gradient */}
                    <div style={{ marginLeft: 'auto' }}>
                      <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>Cell color = High Risk %</div>
                      <div style={{ width: '180px', height: '12px', borderRadius: '6px', background: 'linear-gradient(to right, #2ecc71, #f39c12, #c0392b)' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Low (0%)</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>High ({maxPercentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Row 2: Score Trend + Inspection Backlog side by side */}
            <div className="charts-grid">

              {/* Score Trend */}
              {(() => {
                const selectedRange = TREND_RANGES.find((r) => r.value === trendRange)
                const cutoff = selectedRange.months === Infinity ? null : (() => {
                  const d = new Date()
                  d.setMonth(d.getMonth() - selectedRange.months)
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                })()
                const filteredTrend = (data.score_trend ?? []).filter((d) =>
                  cutoff == null || d.month >= cutoff
                )
                return (
                  <div className="card" style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--heading-color)' }}>
                        NYC Average Inspection Score Over Time
                      </div>
                      <select
                        value={trendRange}
                        onChange={(e) => setTrendRange(e.target.value)}
                        className="filter-select"
                        style={{ height: '30px', fontSize: '12px', padding: '0 8px' }}
                      >
                        {TREND_RANGES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '14px' }}>Lower is better</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={filteredTrend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                        <Tooltip formatter={(v) => [v, 'Avg Score']} labelFormatter={fmtMonth} contentStyle={{ fontSize: '12px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
                        <Line type="monotone" dataKey="avg_score" stroke="#e67e22" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )
              })()}

              {/* Inspection Backlog */}
              {(() => {
                const gapData = GAP_ORDER.map((bucket) => {
                  const found = (data.inspection_gap ?? []).find((d) => d.gap_bucket === bucket)
                  return { gap_bucket: bucket, restaurant_count: found ? Number(found.restaurant_count) : 0 }
                })
                return (
                  <div className="card" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--heading-color)', marginBottom: '2px' }}>
                      Inspection Backlog
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '14px' }}>
                      Restaurants by days since last inspection
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart layout="vertical" data={gapData} margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                        <YAxis type="category" dataKey="gap_bucket" width={100} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                        <Tooltip formatter={(v) => [v.toLocaleString(), 'Restaurants']} contentStyle={{ fontSize: '12px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
                        <Bar dataKey="restaurant_count" radius={[0, 3, 3, 0]}>
                          {gapData.map((entry) => (
                            <Cell key={entry.gap_bucket} fill={GAP_COLORS[entry.gap_bucket]} />
                          ))}
                          <LabelList
                            dataKey="restaurant_count"
                            position="right"
                            formatter={(v) => v.toLocaleString()}
                            style={{ fontSize: 11, fill: 'var(--text-primary)', fontWeight: 600 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              })()}

            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
