import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { money } from '../lib/settings'
import { useAuth } from '../lib/auth'
import { useDialog } from '../components/Dialog'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'

const PERIODS = [
  { key: 'daily', label: 'Daily', metric: 'today', metricLabel: 'Today' },
  { key: 'weekly', label: 'Weekly', metric: 'week', metricLabel: 'This week' },
  { key: 'monthly', label: 'Monthly', metric: 'month', metricLabel: 'This month' },
  { key: 'yearly', label: 'Yearly', metric: 'year', metricLabel: 'This year' }
]

export default function Analytics() {
  const { isAdmin } = useAuth()
  const { alert } = useDialog()
  const [overview, setOverview] = useState(null)
  const [period, setPeriod] = useState('daily')
  const [series, setSeries] = useState([])
  const [top, setTop] = useState([])
  const [servers, setServers] = useState([])
  const [exporting, setExporting] = useState(false)
  const [showExport, setShowExport] = useState(false)

  const runExport = async (params) => {
    setExporting(true)
    try {
      const res = await api.analytics.exportPdf(params)
      if (res?.ok) {
        setShowExport(false)
        alert({ title: 'Report saved', message: res.path })
      }
    } catch (e) {
      alert({ title: 'Export failed', message: e.message })
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    api.analytics.overview().then(setOverview)
  }, [])

  useEffect(() => {
    const p = PERIODS.find((x) => x.key === period)
    api.analytics.series(period).then(setSeries)
    api.analytics.topProducts(p.metric).then(setTop)
    if (isAdmin) api.analytics.byServer(p.metric).then(setServers)
  }, [period, isAdmin])

  const serverMax = Math.max(1, ...servers.map((s) => s.revenue))

  const max = Math.max(1, ...series.map((s) => s.total))
  const periodObj = PERIODS.find((p) => p.key === period)

  return (
    <div className="h-full flex flex-col p-7 overflow-y-auto">
      <PageHeader title="Analytics" subtitle={isAdmin ? 'Earnings overview' : 'Your earnings overview'}>
        <button className="btn-accent" onClick={() => setShowExport(true)}>Export PDF</button>
      </PageHeader>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {overview &&
          PERIODS.map((p) => {
            const active = period === p.key
            return (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`card p-5 text-left transition-all ${active ? 'border-ember/50 shadow-glow' : 'hover:bg-surface2'}`}
              >
                <div className="text-muted text-sm">{p.metricLabel}</div>
                <div className="font-display text-3xl font-bold text-ember mt-1 tnum">{money(overview[p.metric].total)}</div>
                <div className="text-sm text-muted mt-1 tnum">{overview[p.metric].count} orders</div>
              </button>
            )
          })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="card p-6 col-span-2">
          <h2 className="font-display text-xl font-bold mb-5">{periodObj.label} earnings</h2>
          <div className="flex items-end gap-2 h-64">
            {series.map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-2 group">
                <div className="text-[11px] text-muted font-semibold tnum opacity-0 group-hover:opacity-100 transition">
                  {s.total > 0 ? money(s.total) : ''}
                </div>
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{
                    height: `${(s.total / max) * 100}%`,
                    minHeight: s.total > 0 ? 4 : 0,
                    background: 'linear-gradient(180deg,#f7b96b,#ec9a45)'
                  }}
                />
                <div className="text-[11px] text-muted whitespace-nowrap">{s.label}</div>
              </div>
            ))}
            {series.length === 0 && <p className="text-muted">No data yet.</p>}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-xl font-bold mb-5">Top products</h2>
          {top.length === 0 && <p className="text-muted">No sales in this period.</p>}
          <div className="space-y-3.5">
            {top.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-surface2 border border-line flex items-center justify-center text-sm font-bold tnum">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="text-xs text-muted tnum">{t.qty} sold</div>
                </div>
                <div className="font-display font-bold text-ember tnum">{money(t.revenue)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* sales by server — admins only */}
      {isAdmin && (
      <div className="card p-6 mt-6">
        <h2 className="font-display text-xl font-bold mb-5">Sales by server · {periodObj.metricLabel}</h2>
        {servers.length === 0 ? (
          <p className="text-muted">No sales in this period.</p>
        ) : (
          <div className="space-y-4">
            {servers.map((s, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-sm text-muted tnum">
                    {s.orders} order{s.orders === 1 ? '' : 's'} ·{' '}
                    <span className="font-display font-bold text-ember">{money(s.revenue)}</span>
                  </span>
                </div>
                <div className="h-3 rounded-full bg-surface2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(s.revenue / serverMax) * 100}%`, background: 'linear-gradient(90deg,#ec9a45,#f7b96b)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {showExport && (
        <ExportDialog isAdmin={isAdmin} exporting={exporting} onClose={() => setShowExport(false)} onExport={runExport} />
      )}
    </div>
  )
}

const pill = (active) =>
  `px-3.5 py-2 rounded-xl text-sm font-semibold border transition ${
    active ? 'bg-ember text-[#2a1c0c] border-ember' : 'bg-surface2 border-line text-muted hover:text-cream'
  }`

const localISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Compute a {from,to} date range (local YYYY-MM-DD) for a named preset.
function presetRange(preset) {
  const now = new Date()
  const today = localISO(now)
  if (preset === 'Today') return { from: today, to: today }
  if (preset === 'This week') {
    const d = new Date(now)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // back to Monday
    return { from: localISO(d), to: today }
  }
  if (preset === 'This month') return { from: localISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
  if (preset === 'This year') return { from: localISO(new Date(now.getFullYear(), 0, 1)), to: today }
  return { from: null, to: null } // All time
}

const PRESETS = ['Today', 'This week', 'This month', 'This year', 'All time', 'Custom']

function ExportDialog({ isAdmin, exporting, onClose, onExport }) {
  const [preset, setPreset] = useState('This month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [userId, setUserId] = useState('') // '' = all staff
  const [users, setUsers] = useState([])
  const [sections, setSections] = useState({ summary: true, trend: true, topProducts: true, byServer: true, payments: true })

  useEffect(() => {
    if (isAdmin) api.auth.users().then(setUsers).catch(() => setUsers([]))
  }, [isAdmin])

  const toggle = (k) => setSections((s) => ({ ...s, [k]: !s[k] }))

  const submit = () => {
    let range
    let rangeLabel
    if (preset === 'Custom') {
      range = { from: from || null, to: to || null }
      rangeLabel = from || to ? `${from || '…'} → ${to || '…'}` : 'All time'
    } else {
      range = presetRange(preset)
      rangeLabel = preset
    }
    onExport({ from: range.from, to: range.to, rangeLabel, userId: isAdmin ? userId || null : null, sections })
  }

  const sectionList = [
    ['summary', 'Summary'],
    ['trend', 'Sales trend'],
    ['topProducts', 'Top products'],
    ...(isAdmin ? [['byServer', 'Sales by server']] : []),
    ['payments', 'Payments']
  ]

  return (
    <Modal title="Export report" subtitle="Choose what goes in the PDF" onClose={onClose} width={460}>
      <div className="space-y-4">
        <div>
          <span className="text-muted text-sm">Date range</span>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => setPreset(p)} className={pill(preset === p)}>{p}</button>
            ))}
          </div>
          {preset === 'Custom' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <label className="block">
                <span className="text-muted text-xs">From</span>
                <input type="date" className="input mt-1 tnum" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-muted text-xs">To</span>
                <input type="date" className="input mt-1 tnum" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </div>
          )}
        </div>

        {isAdmin && (
          <label className="block">
            <span className="text-muted text-sm">Staff</span>
            <select className="input mt-1.5" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">All staff</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.username}</option>
              ))}
            </select>
          </label>
        )}

        <div>
          <span className="text-muted text-sm">Sections to include</span>
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            {sectionList.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="w-5 h-5 accent-[#EC9A45]" checked={sections[k]} onChange={() => toggle(k)} />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-3">
        <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
        <button className="btn-accent flex-1" disabled={exporting} onClick={submit}>
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>
    </Modal>
  )
}
