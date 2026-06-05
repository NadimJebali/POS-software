import { useState } from 'react'
import Modal from './Modal'
import { useT } from '../lib/i18n'

// Create or edit a table (number/reference + seats). Shared by the Floor and the
// Tables admin screens. `onSave(form)` receives the edited table; the caller persists.
export default function TableModal({ table, onClose, onSave }) {
  const [form, setForm] = useState(table)
  const { t } = useT()
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <Modal title={table.id ? t('tables.editTable') : t('tables.newTable')} onClose={onClose} width={420}>
      <label className="block">
        <span className="text-muted text-sm">{t('tables.numberRef')}</span>
        <input
          className="input mt-1.5"
          value={form.label}
          placeholder={t('tables.numberPh')}
          autoFocus
          onChange={(e) => set('label', e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-muted text-sm">{t('tables.seatsLabel')}</span>
        <input
          type="number"
          min={1}
          className="input mt-1.5 tnum"
          value={form.seats}
          onChange={(e) => set('seats', Number(e.target.value))}
        />
      </label>
      <div className="flex gap-3 pt-1">
        <button className="btn-ghost flex-1" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-accent flex-1" disabled={!form.label.trim()} onClick={() => onSave(form)}>{t('common.save')}</button>
      </div>
    </Modal>
  )
}
