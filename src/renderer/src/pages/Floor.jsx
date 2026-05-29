import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { money } from '../lib/settings'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { useDialog } from '../components/Dialog'
import { IconPlus } from '../components/icons'

export default function Floor() {
  const [tables, setTables] = useState([])
  const [adding, setAdding] = useState(null)
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { alert } = useDialog()

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
      alert({ title: 'Could not add table', message: e.message })
      return
    }
    setAdding(null)
    load()
  }

  return (
    <div className="h-full flex flex-col p-7">
      <PageHeader title="Floor" subtitle={`${occupied} occupied · ${tables.length} tables · ${money(openSales)} open`}>
        {isAdmin && (
          <button className="btn-accent" onClick={() => setAdding({ label: '', seats: 4 })}>
            <IconPlus width={20} height={20} /> Add table
          </button>
        )}
      </PageHeader>

      {tables.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted gap-4">
          <p className="text-xl">No tables yet.</p>
          {isAdmin ? (
            <button className="btn-accent" onClick={() => setAdding({ label: '', seats: 4 })}>
              Add your first table
            </button>
          ) : (
            <p className="text-sm">Ask an administrator to set up the tables.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-4 xl:grid-cols-6 gap-4 overflow-y-auto pr-1 content-start">
          {tables.map((t, i) => {
            const busy = t.status === 'occupied'
            return (
              <button
                key={t.id}
                onClick={() => navigate(`/order/${t.id}`)}
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
                <div className="font-display text-5xl font-bold tnum">{t.label}</div>
                <div className="text-xs text-muted mt-1">{t.seats} seats</div>
                {busy && t.order ? (
                  <div className="mt-2 text-center">
                    <div className="text-ember font-display font-bold text-lg tnum">{money(t.order.total)}</div>
                    <div className="text-[11px] text-muted">{t.order.item_count} items</div>
                  </div>
                ) : (
                  <div className="mt-2 chip bg-mint/15 text-mint">Available</div>
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

function TableModal({ table, onClose, onSave }) {
  const [form, setForm] = useState(table)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <Modal title="New table" subtitle="Give it a number or a reference" onClose={onClose}>
      <label className="block">
        <span className="text-muted text-sm">Number / reference</span>
        <input className="input mt-1.5" value={form.label} placeholder="e.g. 12 or Terrace-A" autoFocus onChange={(e) => set('label', e.target.value)} />
      </label>
      <label className="block">
        <span className="text-muted text-sm">Seats</span>
        <input type="number" min={1} className="input mt-1.5 tnum" value={form.seats} onChange={(e) => set('seats', Number(e.target.value))} />
      </label>
      <div className="flex gap-3 pt-1">
        <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
        <button className="btn-accent flex-1" disabled={!form.label.trim()} onClick={() => onSave(form)}>Add table</button>
      </div>
    </Modal>
  )
}
