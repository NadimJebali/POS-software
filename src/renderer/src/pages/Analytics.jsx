import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { money } from '../lib/settings'
import PageHeader from '../components/PageHeader'

const PERIODS = [
  { key: 'daily', label: 'Daily', metric: 'today', metricLabel: 'Today' },
  { key: 'weekly', label: 'Weekly', metric: 'week', metricLabel: 'This week' },
  { key: 'monthly', label: 'Monthly', metric: 'month', metricLabel: 'This month' },
  { key: 'yearly', label: 'Yearly', metric: 'year', metricLabel: 'This year' }
]

export default function Analytics() {
  const [overview, setOverview] = useState(null)
  const [period, setPeriod] = useState('daily')
  const [series, setSeries] = useState([])
  const [top, setTop] = useState([])

  useEffect(() => {
    api.analytics.overview().then(setOverview)
  }, [])

  useEffect(() => {
    const p = PERIODS.find((x) => x.key === period)
    api.analytics.series(period).then(setSeries)
    api.analytics.topProducts(p.metric).then(setTop)
  }, [period])

  const max = Math.max(1, ...series.map((s) => s.total))
  const periodObj = PERIODS.find((p) => p.key === period)

  return (
    <div className="h-full flex flex-col p-7 overflow-y-auto">
      <PageHeader title="Analytics" subtitle="Earnings overview" />

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
    </div>
  )
}
