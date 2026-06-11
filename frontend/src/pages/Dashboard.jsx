import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { Header } from '../components/Navbar'
import { CriticalityBadge, TrendCell, DaysCell, StatCard } from '../components/Shared'
import '../styles/shared.css'
import '../styles/dashboard.css'

// ── Constants ──────────────────────────────────────────────────────────────
const BOROUGHS        = ['All', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']
const BOROUGHS_BUBBLE = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']
const CRITICALITIES   = ['All', 'High', 'Medium', 'Low']
const TRENDS          = ['All', 'Improving', 'Stable', 'Declining']
const PAGE_SIZE     = 50

const TREND_COLORS = {
  Improving: '#27ae60',
  Stable:    '#e67e22',
  Declining: '#c0392b',
}

const COLUMNS = [
  { key: 'camis',                      label: 'CAMIS' },
  { key: 'restaurant_name',            label: 'Restaurant Name' },
  { key: 'area',                       label: 'Area' },
  { key: 'cuisine_description',        label: 'Cuisine' },
  { key: 'total_inspections',          label: 'Total Violations' },
  { key: 'critical_violation_count',   label: 'Critical Violations' },
  { key: 'last_violation_code',        label: 'Last Violation Code' },
  { key: 'days_since_last_inspection', label: 'Days Since Inspection' },
  { key: 'trend',                      label: 'Trend' },
  { key: 'risk_score',                 label: 'Risk Score' },
  { key: 'risk_percentile',            label: 'Risk Percentile' },
  { key: 'criticality',                label: 'Criticality' },
]

const CAMIS_COL_WIDTH = 100

function stickyThStyle(colKey) {
  if (colKey === 'camis') {
    return { position: 'sticky', left: 0, zIndex: 2, minWidth: CAMIS_COL_WIDTH, backgroundColor: '#1a2744' }
  }
  if (colKey === 'restaurant_name') {
    return { position: 'sticky', left: CAMIS_COL_WIDTH, zIndex: 2, backgroundColor: '#1a2744', boxShadow: '2px 0 4px rgba(0,0,0,0.1)' }
  }
  return {}
}

function stickyTdStyle(colKey, bgColor) {
  if (colKey === 'camis') {
    return { position: 'sticky', left: 0, zIndex: 1, backgroundColor: bgColor }
  }
  if (colKey === 'restaurant_name') {
    return { position: 'sticky', left: CAMIS_COL_WIDTH, zIndex: 1, backgroundColor: bgColor, boxShadow: '2px 0 4px rgba(0,0,0,0.1)' }
  }
  return {}
}

function paginationButtonStyle(disabled) {
  return {
    padding: '8px 16px',
    fontSize: '14px',
    fontFamily: "'Inter', sans-serif",
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    backgroundColor: disabled ? '#f3f4f6' : '#ffffff',
    color: disabled ? '#9ca3af' : '#2c3e50',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────
function RestaurantRow({ row, index }) {
  const [hovered, setHovered] = useState(false)
  const navigate  = useNavigate()
  const location  = useLocation()
  const baseColor = index % 2 === 0 ? '#ffffff' : '#f9fafb'

  return (
    <tr
      style={{ backgroundColor: hovered ? '#eef2f7' : baseColor, cursor: 'pointer' }}
      onClick={() => navigate(`/restaurants/${row.camis}`, { state: { dashboardSearch: location.search } })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {COLUMNS.map((col) => (
        <td
          key={col.key}
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid #f3f4f6',
            whiteSpace: 'nowrap',
            ...(col.key === 'camis' ? { borderLeft: hovered ? '3px solid #1a2744' : '3px solid transparent' } : {}),
            ...stickyTdStyle(col.key, hovered ? '#eef2f7' : baseColor),
          }}
        >
          {col.key === 'criticality' ? (
            <CriticalityBadge value={row[col.key]} />
          ) : col.key === 'trend' ? (
            <TrendCell value={row[col.key]} />
          ) : col.key === 'days_since_last_inspection' ? (
            <DaysCell value={row[col.key]} />
          ) : (
            row[col.key] ?? '—'
          )}
        </td>
      ))}
    </tr>
  )
}

function BubbleTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      background: '#fff',
      border: '1.5px solid #1a2744',
      borderRadius: '8px',
      padding: '12px',
      fontSize: '13px',
      color: '#2c3e50',
      lineHeight: '1.7',
      maxWidth: '240px',
    }}>
      <div style={{ fontWeight: '700', marginBottom: '4px', color: '#1a2744' }}>{d.restaurant_name ?? d.dba ?? '—'}</div>
      <div><span style={{ color: '#6b7280' }}>Area:</span> {d.area ?? d.boro ?? '—'}</div>
      <div><span style={{ color: '#6b7280' }}>Cuisine:</span> {d.cuisine_description}</div>
      <div><span style={{ color: '#6b7280' }}>Risk Score:</span> {d.risk_score}</div>
      <div><span style={{ color: '#6b7280' }}>Days Since Inspection:</span> {d.days_since_last_inspection}</div>
      <div><span style={{ color: '#6b7280' }}>Criticality:</span> {d.criticality}</div>
      <div><span style={{ color: '#6b7280' }}>Trend:</span> {d.trend}</div>
      <div><span style={{ color: '#6b7280' }}>Critical Violations:</span> {d.critical_violation_count}</div>
    </div>
  )
}

const Y_CAP = 750
const X_CAP = 75

function getSliderConfig(count) {
  const capped = Math.min(count, 10000)
  const step = Math.ceil((capped - 1) / 19)   // 19 intervals = 20 stops
  const max = 1 + 19 * step                    // always reachable from min=1
  return { step, max }
}

function BubbleChart({ data, rawData, topN, onTopNChange }) {
  const navigate = useNavigate()
  const location = useLocation()

  const yExcluded = rawData.filter((r) => (r.days_since_last_inspection ?? 0) > Y_CAP)
  const xExcluded = rawData.filter((r) => r.risk_score > X_CAP)
  const plotData  = data.filter((r) => (r.days_since_last_inspection ?? 0) <= Y_CAP && r.risk_score <= X_CAP)

  const byLevel = { Improving: [], Stable: [], Declining: [] }
  plotData.forEach((r) => {
    const level = r.trend
    if (byLevel[level]) {
      byLevel[level].push({
        x: r.risk_score,
        y: r.days_since_last_inspection,
        z: r.critical_violation_count ?? 1,
        restaurant_name: r.restaurant_name ?? r.dba ?? '—',
        area: r.area ?? r.boro ?? '—',
        cuisine_description: r.cuisine_description,
        risk_score: r.risk_score,
        days_since_last_inspection: r.days_since_last_inspection,
        criticality: r.criticality,
        trend: r.trend,
        critical_violation_count: r.critical_violation_count,
        camis: r.camis,
      })
    }
  })

  const handleClick = (scatterData) => {
    if (scatterData?.camis) {
      navigate(`/restaurants/${scatterData.camis}`, { state: { dashboardSearch: location.search } })
    }
  }

  if (data.length === 0) {
    return (
      <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '15px' }}>
        No restaurants match the current filters.
      </div>
    )
  }

  return (
    <div>
      {/* Header row: title left, legend + notes right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#1a2744', marginBottom: '16px' }}>Restaurant Risk Overview</div>
          {rawData.length > 0 && (() => {
              const { step, max } = getSliderConfig(rawData.length)
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                  <span style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>Showing top</span>
                  <input
                    type="range"
                    min={1}
                    max={max}
                    step={step}
                    value={Math.min(topN, max)}
                    onChange={(e) => onTopNChange(Number(e.target.value))}
                    style={{ width: '140px', accentColor: '#1a2744', cursor: 'pointer' }}
                  />
                  <span style={{ whiteSpace: 'nowrap', minWidth: '40px' }}>{Math.min(topN, rawData.length).toLocaleString()}</span>
                </div>
              )
            })()}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginBottom: '4px' }}>
            {['Declining', 'Improving', 'Stable'].map((level) => (
              <span key={level} style={{ fontSize: '13px', color: '#2c3e50' }}>
                <span style={{ color: TREND_COLORS[level], marginRight: '4px' }}>●</span>{level}
              </span>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', lineHeight: '1.8' }}>
            <div>Bubble size = critical violations count</div>
            {yExcluded.length > 0 && (
              <div>Not inspected for 750+ days — {yExcluded.length} restaurant{yExcluded.length !== 1 ? 's' : ''} excluded </div>
            )}
            <div>risk score above 75 — {xExcluded.length} restaurant{xExcluded.length !== 1 ? 's' : ''} excluded</div>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={500}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 80 }}>
          <XAxis
            type="number"
            dataKey="x"
            name="Risk Score"
            domain={[0, X_CAP]}
            label={{ value: 'Risk Score', position: 'insideBottom', offset: -40, fontSize: 13, fill: '#6b7280' }}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Days Since Inspection"
            label={{ value: 'Days Since Inspection', angle: -90, position: 'insideLeft', dx: -10, fontSize: 13, fill: '#6b7280' }}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <ZAxis type="number" dataKey="z" range={[40, 400]} name="Critical Violations" />
          <Tooltip content={<BubbleTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <ReferenceLine
            y={180}
            stroke="#e67e22"
            strokeDasharray="5 5"
            label={{ value: 'Overdue threshold', position: 'insideBottomLeft', dy: -8, fontSize: 11, fill: '#9ca3af' }}
          />
          <ReferenceLine
            x={50}
            stroke="#c0392b"
            strokeDasharray="5 5"
            label={{ value: 'High risk zone', position: 'insideTopLeft', dx: 4, fontSize: 11, fill: '#9ca3af' }}
          />
          {['Improving', 'Stable', 'Declining'].map((level) => (
            <Scatter
              key={level}
              name={level}
              data={byLevel[level]}
              fill={TREND_COLORS[level]}
              fillOpacity={0.75}
              onClick={(point) => handleClick(point)}
              cursor="pointer"
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function RestaurantList() {
  const [searchParams, setSearchParams] = useSearchParams()

  const search      = searchParams.get('search')      ?? ''
  const boro        = searchParams.get('boro')         ?? 'All'
  const criticality = searchParams.get('criticality')  ?? 'All'
  const trend       = searchParams.get('trend')        ?? 'All'
  const cuisine     = searchParams.get('cuisine')      ?? ''
  const sortBy      = searchParams.get('sort_by')      ?? null
  const sortOrder   = searchParams.get('sort_order')   ?? 'asc'
  const page        = Number(searchParams.get('page')  ?? 1)
  const view        = searchParams.get('view')         ?? 'list'
  const topN        = Number(searchParams.get('top_n')   ?? 1000)

  const [debouncedSearch, setDebouncedSearch]   = useState(search)
  const [debouncedCuisine, setDebouncedCuisine] = useState(cuisine)
  const [restaurants, setRestaurants] = useState([])
  const [total, setTotal]   = useState(0)
  const [kpis, setKpis]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [bubbleData, setBubbleData]       = useState([])
  const [bubbleLoading, setBubbleLoading] = useState(false)
  const [bubbleError, setBubbleError]     = useState(null)
  const debounceTimer        = useRef(null)
  const cuisineDebounceTimer = useRef(null)
  const isMounted            = useRef(false)

  const setParams = (updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([k, v]) => {
        if (v == null || v === '' || v === 'All') next.delete(k)
        else next.set(k, String(v))
      })
      return next
    }, { replace: true })
  }

  useEffect(() => {
    if (!isMounted.current) return
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search)
      setParams({ page: null })
    }, 300)
    return () => clearTimeout(debounceTimer.current)
  }, [search])

  useEffect(() => {
    if (!isMounted.current) return
    clearTimeout(cuisineDebounceTimer.current)
    cuisineDebounceTimer.current = setTimeout(() => {
      setDebouncedCuisine(cuisine)
      setParams({ page: null })
    }, 300)
    return () => clearTimeout(cuisineDebounceTimer.current)
  }, [cuisine])

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const fetchRestaurants = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          search: debouncedSearch,
          boro: boro === 'All' ? '' : boro,
          criticality: criticality === 'All' ? '' : criticality,
          trend: trend === 'All' ? '' : trend,
          cuisine: debouncedCuisine,
          page,
          page_size: PAGE_SIZE,
          ...(sortBy ? { sort_by: sortBy, sort_order: sortOrder } : {}),
        })
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/restaurants?${params}`,
          {
            signal: controller.signal,
            headers: { 'Authorization': `Bearer ${localStorage.getItem('safeplate_token')}` },
          }
        )
        if (!response.ok) throw new Error('Request failed')
        const json = await response.json()
        setRestaurants(json.data)
        setTotal(json.total)
        setKpis(json.kpis)
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    fetchRestaurants()
    return () => controller.abort()
  }, [debouncedSearch, boro, criticality, trend, debouncedCuisine, sortBy, sortOrder, page])

  const isBubble = view === 'bubble'

  useEffect(() => {
    if (!isBubble) return
    const controller = new AbortController()
    const fetchBubble = async () => {
      setBubbleLoading(true)
      setBubbleError(null)
      try {
        const params = new URLSearchParams({
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(boro && boro !== 'All' ? { boro } : {}),
          ...(criticality && criticality !== 'All' ? { criticality } : {}),
          ...(trend && trend !== 'All' ? { trend } : {}),
          ...(debouncedCuisine ? { cuisine: debouncedCuisine } : {}),
        })
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/restaurants/bubble?${params}`,
          {
            signal: controller.signal,
            headers: { 'Authorization': `Bearer ${localStorage.getItem('safeplate_token')}` },
          }
        )
        if (!response.ok) throw new Error('Request failed')
        const json = await response.json()
        setBubbleData(json)
      } catch (err) {
        if (err.name !== 'AbortError') setBubbleError(err.message)
      } finally {
        if (!controller.signal.aborted) setBubbleLoading(false)
      }
    }
    fetchBubble()
    return () => controller.abort()
  }, [isBubble, debouncedSearch, boro, criticality, trend, debouncedCuisine])

  const handleBoroChange        = (val) => setParams({ boro: val, page: null })
  const handleCriticalityChange = (val) => setParams({ criticality: val, page: null })
  const handleTrendChange       = (val) => setParams({ trend: val, page: null })

  const handleColumnSort = (colKey) => {
    if (sortBy === colKey) {
      setParams({ sort_order: sortOrder === 'asc' ? 'desc' : 'asc', page: null })
    } else {
      setParams({ sort_by: colKey, sort_order: 'asc', page: null })
    }
  }

  const toggleView = () => {
    if (isBubble) {
      setParams({ view: 'list' })
    } else {
      const updates = { view: 'bubble' }
      if (!boro || boro === 'All') updates.boro = 'Bronx'
      if (!cuisine) updates.cuisine = 'American'
      setParams(updates)
    }
  }

  const filteredForBubble = bubbleData
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, topN)

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const firstItem  = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastItem   = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="page-wrapper">
      <Header />

      {/* Filter Bar */}
      <div className="filter-bar" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <input
          type="text"
          placeholder="Search restaurant name or CAMIS"
          value={search}
          onChange={(e) => setParams({ search: e.target.value, page: null })}
          className="filter-input"
          style={{ width: '300px' }}
        />
        <input
          type="text"
          placeholder="Filter by cuisine"
          value={cuisine}
          onChange={(e) => setParams({ cuisine: e.target.value, page: null })}
          className="filter-input"
          style={{ width: '180px' }}
        />
        <select value={isBubble ? (boro === 'All' ? 'Bronx' : boro) : boro} onChange={(e) => handleBoroChange(e.target.value)} className="filter-select">
          {isBubble
            ? BOROUGHS_BUBBLE.map((b) => <option key={b} value={b}>{b}</option>)
            : BOROUGHS.map((b) => <option key={b} value={b}>{b === 'All' ? 'Area: All' : b}</option>)
          }
        </select>
        <select value={criticality} onChange={(e) => handleCriticalityChange(e.target.value)} className="filter-select">
          {CRITICALITIES.map((c) => (
            <option key={c} value={c}>{c === 'All' ? 'Criticality: All' : c}</option>
          ))}
        </select>
        <select value={trend}       onChange={(e) => handleTrendChange(e.target.value)}       className="filter-select">
          {TRENDS.map((t) => (
            <option key={t} value={t}>{t === 'All' ? 'Trend: All' : t}</option>
          ))}
        </select>

        {/* Segmented toggle — pushed to right */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', border: '1.5px solid #1a2744', borderRadius: '20px', overflow: 'hidden' }}>
            <button
              onClick={() => { if (isBubble) toggleView() }}
              style={{
                padding: '7px 18px',
                fontSize: '13px',
                fontFamily: "'Inter', sans-serif",
                border: 'none',
                borderRight: '1px solid #1a2744',
                backgroundColor: !isBubble ? '#1a2744' : '#ffffff',
                color: !isBubble ? '#ffffff' : '#1a2744',
                cursor: 'pointer',
                fontWeight: '600',
                whiteSpace: 'nowrap',
              }}
            >
              List View
            </button>
            <button
              onClick={() => { if (!isBubble) toggleView() }}
              style={{
                padding: '7px 18px',
                fontSize: '13px',
                fontFamily: "'Inter', sans-serif",
                border: 'none',
                backgroundColor: isBubble ? '#1a2744' : '#ffffff',
                color: isBubble ? '#ffffff' : '#1a2744',
                cursor: 'pointer',
                fontWeight: '600',
                whiteSpace: 'nowrap',
              }}
            >
              Bubble View
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: isBubble ? '24px' : '16px' }}>
          {(() => {
            const pct = (n) => !loading && kpis && total > 0 ? `(${((n / total) * 100).toFixed(1)}% of total)` : null
            return (
              <>
                <StatCard label="Total Restaurants"      value={loading ? '—' : total.toLocaleString()} />
                <StatCard label="High Risk Restaurants"  value={loading || !kpis ? '—' : kpis.high_risk_count.toLocaleString()} pct={pct(kpis?.high_risk_count ?? 0)} />
                <StatCard label="Overdue for Inspection" value={loading || !kpis ? '—' : kpis.overdue_count.toLocaleString()} pct={pct(kpis?.overdue_count ?? 0)} />
                <StatCard label="Declining Trend"        value={loading || !kpis ? '—' : kpis.declining_count.toLocaleString()} pct={pct(kpis?.declining_count ?? 0)} />
                <StatCard label="Avg Risk Score"         value={loading || !kpis ? '—' : kpis.avg_risk_score} />
              </>
            )
          })()}
        </div>
      </div>

      {/* Bubble chart view */}
      {isBubble && (
        <div style={{ padding: '0 24px 24px', marginTop: '32px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            {bubbleLoading ? (
              <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '15px' }}>
                Loading…
              </div>
            ) : bubbleError ? (
              <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c0392b', fontSize: '15px' }}>
                Failed to load data. Please try again.
              </div>
            ) : (
              <BubbleChart
                data={filteredForBubble}
                rawData={bubbleData}
                topN={topN}
                onTopNChange={(val) => setParams({ top_n: val })}
              />
            )}
          </div>
        </div>
      )}

      {/* List view */}
      {!isBubble && (
        <div style={{ padding: '0 24px 24px', marginTop: '32px' }}>
          {/* Meta row */}
          <div className="table-meta-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!loading && !error && total > 0 && (
                <span>{`Showing ${firstItem}–${lastItem} of ${total.toLocaleString()} restaurants`}</span>
              )}
              <span>|</span>
              <span>Click row to view full restaurant details</span>
            </div>
            <div>
              <span className="overdue-dot">●</span>
              Overdue for inspection (180+ days)
            </div>
          </div>

          <div className="table-scroll-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleColumnSort(col.key)}
                      style={stickyThStyle(col.key)}
                    >
                      {col.label}
                      <span style={{ marginLeft: '6px', color: sortBy === col.key ? '#ffffff' : 'rgba(255,255,255,0.35)' }}>
                        {sortBy === col.key ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '64px 16px', color: '#6b7280' }}>
                      Loading restaurants...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '64px 16px', color: '#c0392b' }}>
                      Failed to load data. Please try again.
                    </td>
                  </tr>
                ) : restaurants.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '64px 16px', color: '#6b7280' }}>
                      No restaurants found.
                    </td>
                  </tr>
                ) : (
                  restaurants.map((row, i) => (
                    <RestaurantRow key={row.camis} row={row} index={i} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!error && total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
              <button
                onClick={() => setParams({ page: page - 1 })}
                disabled={page === 1 || loading}
                style={paginationButtonStyle(page === 1 || loading)}
              >
                ← Previous
              </button>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setParams({ page: page + 1 })}
                disabled={page >= totalPages || loading}
                style={paginationButtonStyle(page >= totalPages || loading)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
