import { useState } from 'react'
import Modal from './Modal'

// Create or edit a table (number/reference + seats). Shared by the Floor and the
// Tables admin screens. `onSave(form)` receives the edited table; the caller persists.
export default function TableModal({ table, onClose, onSave }) {
  const [form, setForm] = useState(table)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <Modal title={table.id ? 'Edit table' : 'New table'} onClose={onClose} width={420}>
      <label className="block">
        <span className="text-muted text-sm">Number / reference</span>
        <input
          className="input mt-1.5"
          value={form.label}
          placeholder="e.g. 12 or Terrace-A"
          autoFocus
          onChange={(e) => set('label', e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-muted text-sm">Seats</span>
        <input
          type="number"
          min={1}
          className="input mt-1.5 tnum"
          value={form.seats}
          onChange={(e) => set('seats', Number(e.target.value))}
        />
      </label>
      <div className="flex gap-3 pt-1">
        <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
        <button className="btn-accent flex-1" disabled={!form.label.trim()} onClick={() => onSave(form)}>Save</button>
      </div>
    </Modal>
  )
}
