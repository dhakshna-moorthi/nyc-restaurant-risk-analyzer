import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Header } from '../components/Navbar'
import {
  CriticalityBadge, TrendCell, DaysCell, GradeBadge,
  CriticalFlagBadge, ViolationDescCell, InfoRow,
  useTypewriter, Cursor,
} from '../components/Shared'
import '../styles/shared.css'
import '../styles/restaurant-detail.css'

// ── Constants ──────────────────────────────────────────────────────────────
const INSP_COLUMNS = [
  { key: 'inspection_date',       label: 'Inspection Date' },
  { key: 'inspection_type',       label: 'Inspection Type' },
  { key: 'violation_code',        label: 'Violation Code' },
  { key: 'violation_description', label: 'Violation Description' },
  { key: 'critical_flag',         label: 'Critical Flag' },
  { key: 'score',                 label: 'Score' },
  { key: 'grade',                 label: 'Grade' },
]

// ── Sub-components ─────────────────────────────────────────────────────────
function InspectionRow({ row, index }) {
  const [hovered, setHovered] = useState(false)
  const baseColor = index % 2 === 0 ? 'var(--bg-card)' : 'var(--table-alt-row)'
  return (
    <tr
      style={{ backgroundColor: hovered ? 'var(--table-hover)' : baseColor }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {INSP_COLUMNS.map((col) => (
        <td
          key={col.key}
          style={{
            padding: '9px 14px',
            borderBottom: '1px solid var(--border-color)',
            whiteSpace: col.key === 'violation_description' ? 'normal' : 'nowrap',
            maxWidth: col.key === 'violation_description' ? '280px' : undefined,
          }}
        >
          {col.key === 'critical_flag' ? (
            <CriticalFlagBadge value={row[col.key]} />
          ) : col.key === 'grade' ? (
            <GradeBadge value={row[col.key] ?? 'N/A'} />
          ) : col.key === 'violation_description' ? (
            <ViolationDescCell value={row[col.key]} />
          ) : (
            row[col.key] ?? '—'
          )}
        </td>
      ))}
    </tr>
  )
}

function InspectionHistory({ inspections, inspPage, setInspPage, inspLoading }) {
  if (!inspections) return null

  const { data, total, page_size, unique_inspections } = inspections
  const totalPages     = Math.ceil(total / page_size)
  const firstItem      = total === 0 ? 0 : (inspPage - 1) * page_size + 1
  const lastItem       = Math.min(inspPage * page_size, total)

  const paginationButtonStyle = (disabled) => ({
    padding: '8px 16px',
    fontSize: '14px',
    fontFamily: "'Inter', sans-serif",
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: disabled ? 'var(--table-alt-row)' : 'var(--bg-card)',
    color: disabled ? 'var(--text-secondary)' : 'var(--text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  })

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <div className="card-title">Inspection History</div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        {total} violation records across {unique_inspections} inspections
      </div>

      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
          No inspection records found.
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', borderRadius: '6px' }}>
            <table className="insp-table">
              <thead>
                <tr>
                  {INSP_COLUMNS.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inspLoading ? (
                  <tr>
                    <td colSpan={INSP_COLUMNS.length} style={{ textAlign: 'center', padding: '40px 14px', color: 'var(--text-secondary)' }}>
                      Loading...
                    </td>
                  </tr>
                ) : (
                  data.map((row, i) => (
                    <InspectionRow key={row.inspection_id ?? i} row={row} index={i} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {total > 0 && `Showing ${firstItem}–${lastItem} of ${total} violation records`}
            </span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setInspPage((p) => p - 1)}
                  disabled={inspPage === 1 || inspLoading}
                  style={paginationButtonStyle(inspPage === 1 || inspLoading)}
                >
                  ← Previous
                </button>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Page {inspPage} of {totalPages}
                </span>
                <button
                  onClick={() => setInspPage((p) => p + 1)}
                  disabled={inspPage >= totalPages || inspLoading}
                  style={paginationButtonStyle(inspPage >= totalPages || inspLoading)}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function InsightContent({ insights }) {
  const recs = insights.recommendations

  const { displayed: narrText, done: narrDone } = useTypewriter(insights.narrative, 10, true)
  const { displayed: r0Text,   done: r0Done   } = useTypewriter(recs[0], 10, narrDone)
  const { displayed: r1Text,   done: r1Done   } = useTypewriter(recs[1], 10, r0Done)
  const { displayed: r2Text,   done: r2Done   } = useTypewriter(recs[2], 10, r1Done)
  const { displayed: patText,  done: patDone  } = useTypewriter(insights.pattern_insight, 10, r2Done)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Risk Assessment */}
      <div>
        <div className="insight-label">Risk Assessment</div>
        <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
          {narrText}{!narrDone && <Cursor />}
        </div>
      </div>

      {/* Recommendations */}
      {narrDone && (
        <div>
          <div className="insight-label">Recommendations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="insight-rec">
              <span className="insight-rec-badge">1</span>
              <span style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.5' }}>{r0Text}{!r0Done && <Cursor />}</span>
            </div>
            {r0Done && (
              <div className="insight-rec">
                <span className="insight-rec-badge">2</span>
                <span style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.5' }}>{r1Text}{!r1Done && <Cursor />}</span>
              </div>
            )}
            {r1Done && (
              <div className="insight-rec">
                <span className="insight-rec-badge">3</span>
                <span style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.5' }}>{r2Text}{!r2Done && <Cursor />}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pattern Insight */}
      {r2Done && (
        <div>
          <div className="insight-label">Pattern Insight</div>
          <div className="insight-pattern">
            <span style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
              {patText}{!patDone && <Cursor />}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function RiskMetrics({ metrics, boro, cuisine, uniqueInspections }) {
  if (!metrics) return null

  const {
    repeat_violations = [],
    critical_ratio    = [],
    score_trend       = [],
    violation_trend   = [],
    similar_restaurants,
    neighborhood_percentile,
    cuisine_percentile,
  } = metrics

  const fmtDate = (d) => {
    if (!d) return d
    const dt = new Date(d)
    return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  const comparisonStats = [
    { label: 'Similar Restaurants Analyzed', value: similar_restaurants?.restaurant_count ?? '—' },
    { label: 'Their Avg Risk Score',    value: similar_restaurants?.avg_risk_score    != null ? Number(similar_restaurants.avg_risk_score).toFixed(1)    : '—' },
    { label: 'Their Median Risk Score', value: similar_restaurants?.median_risk_score != null ? Number(similar_restaurants.median_risk_score).toFixed(1) : '—' },
    {
      label: 'Neighborhood Risk Percentile',
      value: neighborhood_percentile != null ? `${Number(neighborhood_percentile).toFixed(1)}%` : '—',
      subtitle: neighborhood_percentile != null ? `Higher risk than ${Number(neighborhood_percentile).toFixed(1)}% of ${boro} restaurants` : null,
    },
    {
      label: 'Cuisine Risk Percentile',
      value: cuisine_percentile != null ? `${Number(cuisine_percentile).toFixed(1)}%` : '—',
      subtitle: cuisine_percentile != null ? `Higher risk than ${Number(cuisine_percentile).toFixed(1)}% of ${cuisine} restaurants` : null,
    },
  ]

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--heading-color)', marginBottom: '20px' }}>
        Risk Analysis
      </div>

      {/* Comparison to similar restaurants */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--heading-color)', marginBottom: '12px' }}>
          Comparison to Similar Restaurants
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          {comparisonStats.map(({ label, value, subtitle }) => (
            <div key={label} className="comparison-tile">
              <div className="comparison-tile-value">{value}</div>
              <div className="comparison-tile-label">{label}</div>
              {subtitle && <div className="comparison-tile-sub">{subtitle}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* 2×2 grid */}
      <div className="risk-analysis-grid">

        {/* Repeat Violations */}
        <div className="sub-card">
          <div className="sub-card-title">
            Violations cited more than once — across {uniqueInspections ?? '—'} total inspections
          </div>
          {repeat_violations.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#9ca3af' }}>No repeat violations found</div>
          ) : (
            <div style={{ maxHeight: '200px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f9fafb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: 'var(--text-primary)' }}>
                <thead>
                  <tr>
                    {['Violation Code', 'Times Cited'].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: '0 8px 8px 0',
                          color: 'var(--text-secondary)',
                          fontWeight: '600',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {repeat_violations.map((rv, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '7px 8px 7px 0', fontWeight: '600' }}>{rv.violation_code}</td>
                      <td style={{ padding: '7px 8px 7px 0' }}>{rv.occurrence_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Violation Breakdown */}
        <div className="sub-card" style={{ padding: '16px' }}>
          <div className="sub-card-title" style={{ marginBottom: '25px' }}>Violation Breakdown</div>
          {critical_ratio.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#9ca3af' }}>No data available</div>
          ) : (() => {
            const SEGMENT_COLORS = {
              Critical:         '#c0392b',
              'Not Critical':   '#e67e22',
              'Not Applicable': '#95a5a6',
            }
            const ORDER = ['Critical', 'Not Critical', 'Not Applicable']
            const sorted = ORDER
              .map(key => critical_ratio.find(r => r.critical_flag === key))
              .filter(Boolean)
            const total = sorted.reduce((s, r) => s + Number(r.count), 0)
            const segments = sorted.map(r => ({
              label: r.critical_flag,
              pct:   total > 0 ? (Number(r.count) / total) * 100 : 0,
              color: SEGMENT_COLORS[r.critical_flag] || '#95a5a6',
            }))
            return (
              <div>
                <div style={{ display: 'flex', height: '20px', borderRadius: '10px', overflow: 'hidden', width: '100%' }}>
                  {segments.map((seg, i) => (
                    <div
                      key={i}
                      style={{
                        width: `${seg.pct}%`,
                        backgroundColor: seg.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {seg.pct >= 5 && (
                        <span style={{ fontSize: '11px', color: '#fff', fontWeight: '600', whiteSpace: 'nowrap' }}>
                          {seg.pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '25px' }}>
                  {segments.map((seg, i) => (
                    <span key={i} style={{ fontSize: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: seg.color, fontSize: '15px', lineHeight: 1 }}>&#9632;</span>
                      {seg.label} <span style={{ color: 'var(--heading-color)', fontWeight: '600' }}>{seg.pct.toFixed(1)}%</span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Score Trend */}
        <div className="sub-card">
          <div className="sub-card-title">
            Inspection Score Over Time
            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400', marginLeft: '8px' }}>Lower is better</span>
          </div>
          {score_trend.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#9ca3af' }}>No score data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={score_trend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <XAxis dataKey="inspection_date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <Tooltip formatter={(v) => [v, 'Score']} labelFormatter={fmtDate} contentStyle={{ fontSize: '12px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
                <Line type="monotone" dataKey="score" stroke="var(--heading-color)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Violation Trend */}
        <div className="sub-card">
          <div className="sub-card-title">Violations Per Inspection</div>
          {violation_trend.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#9ca3af' }}>No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={violation_trend} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                <XAxis dataKey="inspection_date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, 'Violations']} labelFormatter={fmtDate} contentStyle={{ fontSize: '12px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
                <Bar dataKey="violation_count" fill="#e67e22" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
function RestaurantDetail({ camis }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [data, setData]                   = useState(null)
  const [loading, setLoading]             = useState(true)
  const [inspLoading, setInspLoading]     = useState(false)
  const [error, setError]                 = useState(null)
  const [inspPage, setInspPage]           = useState(1)
  const [panelOpen, setPanelOpen]         = useState(false)
  const [insights, setInsights]           = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    const fetchDetail = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/restaurants/${camis}?page=1`,
          {
            signal: controller.signal,
            headers: { 'Authorization': `Bearer ${localStorage.getItem('safeplate_token')}` },
          }
        )
        if (res.status === 404) { setError('not_found'); return }
        if (!res.ok) throw new Error('Request failed')
        setData(await res.json())
      } catch (err) {
        if (err.name !== 'AbortError') setError('failed')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    fetchDetail()
    return () => controller.abort()
  }, [camis])

  useEffect(() => {
    if (inspPage === 1) return
    const controller = new AbortController()
    setInspLoading(true)
    const fetchPage = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/restaurants/${camis}?page=${inspPage}`,
          {
            signal: controller.signal,
            headers: { 'Authorization': `Bearer ${localStorage.getItem('safeplate_token')}` },
          }
        )
        if (!res.ok) throw new Error('Request failed')
        const json = await res.json()
        setData((prev) => ({ ...prev, inspections: json.inspections }))
      } catch (_err) {
        // silently leave stale data on pagination error
      } finally {
        if (!controller.signal.aborted) setInspLoading(false)
      }
    }
    fetchPage()
    return () => controller.abort()
  }, [inspPage]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchInsights = () => {
    setInsightsLoading(true)
    setInsightsError(false)
    fetch(`${import.meta.env.VITE_API_URL}/restaurants/${camis}/insights`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('safeplate_token')}` },
    })
      .then((res) => { if (!res.ok) throw new Error('Failed'); return res.json() })
      .then((d) => { setInsights(d); setInsightsLoading(false) })
      .catch(() => { setInsightsError(true); setInsightsLoading(false) })
  }

  useEffect(() => {
    if (!panelOpen || insights) return
    fetchInsights()
  }, [panelOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const restaurant = data?.restaurant

  return (
    <div className="page-wrapper">
      <Header />

      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch' }}>

        {/* Page content */}
        <div style={{ flex: 1, minWidth: 0, transition: 'all 300ms ease' }}>

          {/* Breadcrumb */}
          <div className="breadcrumb">
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span onClick={() => navigate('/dashboard' + (location.state?.dashboardSearch ?? ''))} className="breadcrumb-link">Dashboard</span>
              <span>{'>'}</span>
              <span>{loading ? '…' : (restaurant?.dba ?? camis)}</span>
            </div>
            {!error && (
              <button onClick={() => setPanelOpen(true)} className="btn-navy">
                ✨ Generate AI Insights
              </button>
            )}
          </div>

          <div style={{ padding: '0 24px 24px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px 16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                Loading restaurant details...
              </div>
            ) : error === 'not_found' ? (
              <div style={{ textAlign: 'center', padding: '80px 16px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--heading-color)', marginBottom: '8px' }}>
                  Restaurant Not Found
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                  No restaurant with CAMIS <strong>{camis}</strong> exists in the database.
                </div>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn-navy"
                >
                  ← Back to Dashboard
                </button>
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '80px 16px', color: '#c0392b', fontSize: '14px' }}>
                Failed to load data.
              </div>
            ) : (
              <>
                <div className="card">
                  <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--heading-color)', marginBottom: '20px' }}>
                    Restaurant Information
                  </div>
                  <div className="info-grid">
                    <InfoRow label="CAMIS"            value={restaurant.camis} />
                    <InfoRow label="Restaurant Name"  value={restaurant.dba} />
                    <InfoRow label="Area"             value={restaurant.boro} />
                    <InfoRow label="Cuisine"          value={restaurant.cuisine_description} />
                    <InfoRow label="Current Grade"    value={<GradeBadge value={restaurant.grade} />} />
                    <InfoRow label="Days Since Inspection" value={<DaysCell value={restaurant.days_since_inspection} />} />
                    <InfoRow label="Risk Score"       value={restaurant.risk_score ?? '—'} />
                    <InfoRow
                      label="Risk Percentile"
                      value={restaurant.risk_percentile != null ? `${restaurant.risk_percentile}%` : '—'}
                    />
                    <InfoRow label="Criticality"      value={<CriticalityBadge value={restaurant.criticality} />} />
                    <InfoRow label="Trend"            value={<TrendCell value={restaurant.trend} />} />
                  </div>
                </div>
                <InspectionHistory
                  inspections={data.inspections}
                  inspPage={inspPage}
                  setInspPage={setInspPage}
                  inspLoading={inspLoading}
                />
                <RiskMetrics
                  metrics={data.risk_metrics}
                  boro={restaurant.boro}
                  cuisine={restaurant.cuisine_description}
                  uniqueInspections={data.inspections?.unique_inspections}
                />
              </>
            )}
          </div>

        </div>{/* end page content */}

        {/* AI Insights side panel */}
        <div
          className="ai-panel-outer"
          data-open={panelOpen ? 'true' : 'false'}
          style={{ width: panelOpen ? '420px' : '0' }}
        >
          <div className="ai-panel-inner">

            <div className="ai-panel-header">
              <div>
                <div style={{ color: '#ffffff', fontWeight: '700', fontSize: '16px' }}>AI Insights</div>
                <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '2px' }}>Powered by ChatGPT</div>
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '18px', cursor: 'pointer', padding: '0', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div className="ai-panel-body">
              {insightsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '60px', gap: '16px' }}>
                  <div
                    className="ai-spin"
                    style={{
                      width: '36px',
                      height: '36px',
                      border: '3px solid var(--border-color)',
                      borderTop: '3px solid var(--heading-color)',
                      borderRadius: '50%',
                    }}
                  />
                  <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', textAlign: 'center' }}>
                    Analyzing inspection patterns...
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '12px', textAlign: 'center' }}>
                    Comparing against 27,000+ restaurants using RAG...
                  </div>
                </div>
              ) : insightsError ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '60px', gap: '16px' }}>
                  <div style={{ color: '#c0392b', fontSize: '14px' }}>Failed to generate insights.</div>
                  <button onClick={fetchInsights} className="btn-navy">
                    Try Again
                  </button>
                </div>
              ) : insights ? (
                <InsightContent insights={insights} />
              ) : null}
            </div>

          </div>
        </div>{/* end panel */}

      </div>{/* end flex row */}
    </div>
  )
}

export function RestaurantDetailRoute() {
  const { camis } = useParams()
  return <RestaurantDetail key={camis} camis={camis} />
}
