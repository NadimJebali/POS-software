import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { money } from '../lib/settings'
import { useT } from '../lib/i18n'
import PageHeader from '../components/PageHeader'
import TableModal from '../components/TableModal'
import { useDialog } from '../components/Dialog'
import { IconPlus, IconTrash } from '../components/icons'

export default function TablesManage() {
  const [tables, setTables] = useState([])
  const [editing, setEditing] = useState(null)
  const navigate = useNavigate()
  const { confirm, alert } = useDialog()
  const { t } = useT()

  const load = () => api.tables.list().then(setTables)
  useEffect(() => {
    load()
  }, [])

  const save = async (form) => {
    try {
      if (form.id) await api.tables.update(form)
      else await api.tables.create(form)
    } catch (e) {
      alert({ title: t('tables.couldNotSave'), message: e.message })
      return
    }
    setEditing(null)
    load()
  }

  const remove = async (tbl) => {
    const message =
      tbl.status === 'occupied'
        ? t('tables.deleteMsgOpen', { label: tbl.label })
        : t('tables.deleteMsg', { label: tbl.label })
    if (!(await confirm({ title: t('tables.deleteTitle'), message, confirmText: t('common.delete'), danger: true }))) return
    try {
      await api.tables.remove(tbl.id)
      load()
    } catch (e) {
      alert({ title: t('tables.couldNotDelete'), message: e.message })
    }
  }

  return (
    <div className="h-full flex flex-col p-7">
      <PageHeader title={t('tables.title')} subtitle={t('tables.subtitle', { n: tables.length })}>
        <button className="btn-accent" onClick={() => setEditing({ label: '', seats: 4 })}>
          <IconPlus width={20} height={20} /> {t('tables.addTable')}
        </button>
      </PageHeader>

      <div className="grid grid-cols-4 xl:grid-cols-6 gap-4 overflow-y-auto pr-1 content-start">
        {tables.map((tbl, i) => {
          const busy = tbl.status === 'occupied'
          return (
            <div
              key={tbl.id}
              style={{ animationDelay: `${Math.min(i * 25, 400)}ms` }}
              className="animate-rise card p-4 flex flex-col items-center gap-2 relative"
            >
              <span className={`absolute top-3 end-3 w-2.5 h-2.5 rounded-full ${busy ? 'bg-ember' : 'bg-mint'}`} />
              <div className="font-display text-4xl font-bold tnum">{tbl.label}</div>
              <div className="text-xs text-muted">{t('tables.seats', { n: tbl.seats })}</div>
              <div className={`chip text-xs ${busy ? 'bg-ember/15 text-ember' : 'bg-mint/15 text-mint'}`}>
                {busy ? (tbl.order ? money(tbl.order.total) : t('tables.occupied')) : t('tables.available')}
              </div>
              <div className="flex gap-2 mt-1 w-full">
                <button className="flex-1 px-2 py-2 rounded-xl bg-surface2 border border-line text-sm hover:bg-surface3" onClick={() => setEditing(tbl)}>{t('tables.edit')}</button>
                <button className="px-2.5 py-2 rounded-xl bg-berry/80 text-white hover:bg-berry" onClick={() => remove(tbl)}><IconTrash width={16} height={16} /></button>
              </div>
              <button className="text-xs text-muted hover:text-ember" onClick={() => navigate(`/order/${tbl.id}`)}>{t('tables.openOrder')}</button>
            </div>
          )
        })}
        {tables.length === 0 && <p className="text-muted">{t('tables.noTables')}</p>}
      </div>

      {editing && <TableModal table={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  )
}
