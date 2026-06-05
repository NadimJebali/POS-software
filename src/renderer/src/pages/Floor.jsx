import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { money } from '../lib/settings'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'
import PageHeader from '../components/PageHeader'
import TableModal from '../components/TableModal'
import { useDialog } from '../components/Dialog'
import { IconPlus } from '../components/icons'

export default function Floor() {
  const [tables, setTables] = useState([])
  const [adding, setAdding] = useState(null)
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { alert } = useDialog()
  const { t } = useT()

  const load = () => api.tables.list().then(setTables)
  useEffect(() => {
    load()
  }, [])

  const occupied = tables.filter((t) => t.status === 'occupied').length
  const openSales = tables.reduce((s, t) => s + (t.order ? t.order.total : 0), 0)

  const saveTable = async (form) => {
    try {
      await api.tables.create(form)
    } catch (e) {
      alert({ title: t('floor.couldNotAdd'), message: e.message })
      return
    }
    setAdding(null)
    load()
  }

  return (
    <div className="h-full flex flex-col p-7">
      <PageHeader title={t('nav.floor')} subtitle={t('floor.subtitle', { occupied, total: tables.length, open: money(openSales) })}>
        {isAdmin && (
          <button className="btn-accent" onClick={() => setAdding({ label: '', seats: 4 })}>
            <IconPlus width={20} height={20} /> {t('floor.addTable')}
          </button>
        )}
      </PageHeader>

      {tables.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted gap-4">
          <p className="text-xl">{t('floor.noTables')}</p>
          {isAdmin ? (
            <button className="btn-accent" onClick={() => setAdding({ label: '', seats: 4 })}>
              {t('floor.addFirst')}
            </button>
          ) : (
            <p className="text-sm">{t('floor.askAdmin')}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-4 xl:grid-cols-6 gap-4 overflow-y-auto pr-1 content-start">
          {tables.map((tbl, i) => {
            const busy = tbl.status === 'occupied'
            return (
              <button
                key={tbl.id}
                onClick={() => navigate(`/order/${tbl.id}`)}
                style={{ animationDelay: `${Math.min(i * 25, 400)}ms` }}
                className={`animate-rise relative aspect-square rounded-3xl p-4 flex flex-col items-center justify-center
                  border transition-all active:scale-[0.97] overflow-hidden ${
                    busy
                      ? 'border-ember/40 bg-gradient-to-br from-surface2 to-surface text-cream shadow-glow'
                      : 'border-line bg-surface/70 hover:bg-surface2 text-cream'
                  }`}
              >
                <span
                  className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${busy ? 'bg-ember' : 'bg-mint'}`}
                />
                <div className="font-display text-5xl font-bold tnum">{tbl.label}</div>
                <div className="text-xs text-muted mt-1">{t('floor.seats', { n: tbl.seats })}</div>
                {busy && tbl.order ? (
                  <div className="mt-2 text-center">
                    <div className="text-ember font-display font-bold text-lg tnum">{money(tbl.order.total)}</div>
                    <div className="text-[11px] text-muted">{t('floor.items', { n: tbl.order.item_count })}</div>
                  </div>
                ) : (
                  <div className="mt-2 chip bg-mint/15 text-mint">{t('floor.available')}</div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {adding && <TableModal table={adding} onClose={() => setAdding(null)} onSave={saveTable} />}
    </div>
  )
}
