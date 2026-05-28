import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { money } from '../lib/settings'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { IconPlus, IconTrash } from '../components/icons'

export default function TablesManage() {
  const [tables, setTables] = useState([])
  const [editing, setEditing] = useState(null)
  const navigate = useNavigate()

  const load = () => api.tables.list().then(setTables)
  useEffect(() => {
    load()
  }, [])

  const save = async (form) => {
    if (form.id) await api.tables.update(form)
    else await api.tables.create(form)
    setEditing(null)
    load()
  }

  const remove = async (t) => {
    const msg =
      t.status === 'occupied'
        ? `Table ${t.label} has an open order. Delete the table and discard that order?`
        : `Delete table ${t.label}?`
    if (!confirm(msg)) return
    try {
      await api.tables.remove(t.id)
      load()
    } catch (e) {
      alert('Could not delete table: ' + e.message)
    }
  }

  return (
    <div className="h-full flex flex-col p-7">
      <PageHeader title="Tables" subtitle={`${tables.length} table${tables.length === 1 ? '' : 's'} · tap to manage`}>
        <button className="btn-accent" onClick={() => setEditing({ label: '', seats: 4 })}>
          <IconPlus width={20} height={20} /> Add table
        </button>
      </PageHeader>

      <div className="grid grid-cols-4 xl:grid-cols-6 gap-4 overflow-y-auto pr-1 content-start">
        {tables.map((t, i) => {
          const busy = t.status === 'occupied'
          return (
            <div
              key={t.id}
              style={{ animationDelay: `${Math.min(i * 25, 400)}ms` }}
              className="animate-rise card p-4 flex flex-col items-center gap-2 relative"
            >
              <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${busy ? 'bg-ember' : 'bg-mint'}`} />
              <div className="font-display text-4xl font-bold tnum">{t.label}</div>
              <div className="text-xs text-muted">{t.seats} seats</div>
              <div className={`chip text-xs ${busy ? 'bg-ember/15 text-ember' : 'bg-mint/15 text-mint'}`}>
                {busy ? (t.order ? money(t.order.total) : 'occupied') : 'available'}
              </div>
              <div className="flex gap-2 mt-1 w-full">
                <button className="flex-1 px-2 py-2 rounded-xl bg-surface2 border border-line text-sm hover:bg-surface3" onClick={() => setEditing(t)}>Edit</button>
                <button className="px-2.5 py-2 rounded-xl bg-berry/80 text-white hover:bg-berry" onClick={() => remove(t)}><IconTrash width={16} height={16} /></button>
              </div>
              <button className="text-xs text-muted hover:text-ember" onClick={() => navigate(`/order/${t.id}`)}>open order →</button>
            </div>
          )
        })}
        {tables.length === 0 && <p className="text-muted">No tables yet. Add your first one.</p>}
      </div>

      {editing && <TableModal table={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  )
}

function TableModal({ table, onClose, onSave }) {
  const [form, setForm] = useState(table)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <Modal title={table.id ? 'Edit table' : 'New table'} onClose={onClose} width={420}>
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
        <button className="btn-accent flex-1" disabled={!form.label.trim()} onClick={() => onSave(form)}>Save</button>
      </div>
    </Modal>
  )
}
