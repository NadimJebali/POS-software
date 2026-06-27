import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { money } from '../lib/settings'
import { isSplit } from '../../../shared/split'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { useDialog } from '../components/Dialog'
import { IconPrint, IconEdit, IconTrash } from '../components/icons'

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function History() {
  const { isAdmin } = useAuth()
  const { confirm, alert } = useDialog()
  const { t } = useT()
  const [date, setDate] = useState(todayStr())
  const [all, setAll] = useState(false)
  const [orders, setOrders] = useState([])
  const [printing, setPrinting] = useState(null)
  const [detail, setDetail] = useState(null)

  const load = () => api.orders.history(all ? null : date).then(setOrders)
  useEffect(() => {
    load()
  }, [date, all])

  const openDetail = (id) => api.orders.get(id).then(setDetail)

  const cancelOrder = async (id) => {
    const ok = await confirm({
      title: t('history.deleteTitle'),
      message: t('history.deleteMsg'),
      confirmText: t('history.deleteConfirm'),
      cancelText: t('common.keep'),
      danger: true
    })
    if (!ok) return
    try {
      await api.orders.cancelPaid(id)
      setDetail(null)
      load()
    } catch (e) {
      alert({ title: t('common.error'), message: e.message })
    }
  }

  const saveEdits = async (id, items, discountType, discountValue) => {
    try {
      const updated = await api.orders.updatePaid(id, items, discountType, discountValue)
      setDetail(updated)
      load()
    } catch (e) {
      alert({ title: t('common.error'), message: e.message })
    }
  }

  // Deleted orders stay listed but don't count towards the period total.
  const total = orders.reduce((s, o) => s + (o.status === 'cancelled' ? 0 : o.total), 0)

  const reprint = async (id) => {
    setPrinting(id)
    try {
      await api.receipt.print(id)
    } catch (e) {
      alert({ title: t('history.printFailed'), message: e.message })
    } finally {
      setPrinting(null)
    }
  }

  return (
    <div className="h-full flex flex-col p-7 overflow-hidden">
      <PageHeader title={t('history.title')} subtitle={t('history.subtitle', { n: orders.length, total: money(total) })}>
        <button
          onClick={() => setAll((v) => !v)}
          className={`px-4 py-2.5 rounded-2xl font-semibold border transition ${all ? 'bg-ember text-[#2a1c0c] border-ember' : 'bg-surface2 border-line text-muted hover:text-cream'}`}
        >
          {t('history.allTime')}
        </button>
        <input
          type="date"
          value={date}
          disabled={all}
          onChange={(e) => setDate(e.target.value)}
          className="input w-auto tnum disabled:opacity-40"
        />
      </PageHeader>

      <div className="card flex-1 overflow-y-auto">
        <table className="w-full text-start">
          <thead className="sticky top-0 bg-surface text-muted text-sm z-10">
            <tr>
              <th className="px-5 py-4 font-medium">{t('history.cols.order')}</th>
              <th className="px-5 py-4 font-medium">{t('history.cols.table')}</th>
              <th className="px-5 py-4 font-medium">{t('history.cols.server')}</th>
              <th className="px-5 py-4 font-medium">{t('history.cols.time')}</th>
              <th className="px-5 py-4 font-medium text-center">{t('history.cols.items')}</th>
              <th className="px-5 py-4 font-medium text-end">{t('history.cols.discount')}</th>
              <th className="px-5 py-4 font-medium text-end">{t('history.cols.total')}</th>
              <th className="px-5 py-4 font-medium text-end">{t('history.cols.change')}</th>
              <th className="px-5 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const deleted = o.status === 'cancelled'
              return (
              <tr
                key={o.id}
                onClick={() => openDetail(o.id)}
                className={`border-t border-line/60 text-lg hover:bg-surface2/40 cursor-pointer ${deleted ? 'opacity-60' : ''}`}
              >
                <td className="px-5 py-3.5 font-semibold tnum">
                  #{o.id}
                  {deleted && (
                    <span className="ms-2 chip bg-berry/20 text-berry text-xs align-middle">{t('history.deletedBy', { name: o.deleted_by || '—' })}</span>
                  )}
                </td>
                <td className="px-5 py-3.5">{o.table_label || '—'}</td>
                <td className="px-5 py-3.5">{o.user_name || '—'}</td>
                <td className="px-5 py-3.5 text-muted tnum">{new Date(o.paid_at + 'Z').toLocaleString()}</td>
                <td className="px-5 py-3.5 text-center tnum">{o.item_count}</td>
                <td className="px-5 py-3.5 text-end tnum text-berry">{o.discount > 0 ? '- ' + money(o.discount) : '—'}</td>
                <td className={`px-5 py-3.5 text-end font-display font-bold tnum ${deleted ? 'text-muted line-through' : 'text-ember'}`}>{money(o.total)}</td>
                <td className={`px-5 py-3.5 text-end tnum ${o.change_due > 0 ? 'text-mint' : 'text-muted'}`}>{money(o.change_due)}</td>
                <td className="px-5 py-3.5 text-end">
                  <button
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-surface2 border border-line hover:bg-surface3 disabled:opacity-50"
                    disabled={printing === o.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      reprint(o.id)
                    }}
                  >
                    <IconPrint width={18} height={18} /> {printing === o.id ? '…' : t('history.receipt')}
                  </button>
                </td>
              </tr>
              )
            })}
            {orders.length === 0 && (
              <tr><td colSpan={9} className="px-5 py-12 text-center text-muted">{t('history.noOrders')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <OrderDetail
          order={detail}
          isAdmin={isAdmin}
          canDelete={detail.status !== 'cancelled'}
          onClose={() => setDetail(null)}
          onReprint={() => reprint(detail.id)}
          printing={printing === detail.id}
          onCancel={() => cancelOrder(detail.id)}
          onSave={(items, dt, dv) => saveEdits(detail.id, items, dt, dv)}
        />
      )}
    </div>
  )
}

const DISCOUNTS = [0, 5, 10, 15]

function OrderDetail({ order, isAdmin, canDelete, onClose, onReprint, printing, onCancel, onSave }) {
  const { t } = useT()
  const initialQty = () => Object.fromEntries(order.items.map((i) => [i.id, i.qty]))
  const [edit, setEdit] = useState(false)
  const [qty, setQty] = useState(initialQty)
  const [disc, setDisc] = useState(null) // null = keep existing; number = percent
  const when = new Date(order.paid_at + 'Z').toLocaleString()
  const deleted = order.status === 'cancelled'
  const split = isSplit(order.payments)

  // Reset the edit state whenever a different order object arrives (opening another
  // order, or the refreshed copy after a save) — done during render, not in an effect.
  const [prevOrder, setPrevOrder] = useState(order)
  if (order !== prevOrder) {
    setPrevOrder(order)
    setQty(initialQty())
    setDisc(null)
    setEdit(false)
  }

  const q = (it) => (edit ? qty[it.id] ?? it.qty : it.qty)
  const subtotal = order.items.reduce((s, it) => s + it.unit_price * q(it), 0)
  const discount = !edit
    ? order.discount
    : disc === null
      ? Math.min(order.discount, subtotal)
      : Math.round((subtotal * disc) / 100)
  const total = subtotal - Math.min(discount, subtotal)

  const setQ = (id, v) => setQty((m) => ({ ...m, [id]: Math.max(0, v) }))

  const save = () => {
    const items = order.items.map((it) => ({ id: it.id, qty: qty[it.id] ?? it.qty }))
    onSave(items, disc === null ? undefined : 'percent', disc === null ? undefined : disc)
  }

  return (
    <Modal
      title={order.table_label ? t('history.orderTitleTable', { id: order.id, label: order.table_label }) : t('history.orderTitle', { id: order.id })}
      subtitle={when}
      onClose={onClose}
      width={480}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="chip bg-surface3 text-muted">{t('history.servedBy')}</span>
        <span className="font-semibold text-cream">{order.user_name || t('history.unknown')}</span>
      </div>

      {deleted && (
        <div className="mb-3 rounded-xl bg-berry/15 border border-berry/40 px-4 py-2.5 text-sm">
          <span className="font-semibold text-berry">{t('history.deleted')}</span>
          <span className="text-cream"> {t('history.by')} {order.deleted_by || t('history.unknown')}</span>
          {order.deleted_at && <span className="text-muted"> · {new Date(order.deleted_at + 'Z').toLocaleString()}</span>}
        </div>
      )}

      <div className="max-h-[42vh] overflow-y-auto -mx-1 px-1 divide-y divide-line/60">
        {order.items.map((it) => (
          <div key={it.id} className="flex items-center justify-between py-2.5 gap-3">
            <span className="flex-1 min-w-0">
              {!edit && <span className="text-muted tnum me-2">{it.qty}×</span>}
              <span className={q(it) === 0 ? 'line-through text-muted' : ''}>{it.name}</span>
              <span className="text-muted text-sm tnum ms-2">@ {money(it.unit_price)}</span>
              {it.modifiers && <span className="block text-xs text-ember">{it.modifiers}</span>}
            </span>
            {edit ? (
              <span className="flex items-center gap-2">
                <button className="w-11 h-11 rounded-xl bg-surface2 border border-line text-2xl leading-none active:scale-90" onClick={() => setQ(it.id, q(it) - 1)}>−</button>
                <span className="w-7 text-center font-bold tnum">{q(it)}</span>
                <button className="w-11 h-11 rounded-xl bg-surface2 border border-line text-2xl leading-none active:scale-90" onClick={() => setQ(it.id, q(it) + 1)}>+</button>
              </span>
            ) : (
              <span className="font-semibold tnum">{money(it.unit_price * it.qty)}</span>
            )}
          </div>
        ))}
        {order.items.length === 0 && <p className="text-muted py-3">{t('history.noItems')}</p>}
      </div>

      {edit && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-muted text-sm me-1">{t('history.discount')}</span>
          <button onClick={() => setDisc(null)} className={pill(disc === null)}>{t('history.keepDisc')}</button>
          {DISCOUNTS.map((d) => (
            <button key={d} onClick={() => setDisc(d)} className={pill(disc === d)}>{d === 0 ? t('common.none') : `${d}%`}</button>
          ))}
        </div>
      )}

      <div className="space-y-1.5 pt-1">
        {discount > 0 && (
          <>
            <Line label={t('history.subtotal')} value={money(subtotal)} muted />
            <Line label={t('history.discount')} value={`- ${money(discount)}`} className="text-berry" />
          </>
        )}
        <div className="flex justify-between items-baseline">
          <span className="text-lg">{t('history.total')}</span>
          <span className="font-display text-2xl font-bold text-ember tnum">{money(total)}</span>
        </div>
        {!edit &&
          (order.payments || []).map((p, i) => (
            <div key={p.id} className="flex justify-between items-center rounded-xl bg-surface2/70 border border-line px-4 py-2 mt-1">
              <span className="chip bg-surface3 text-cream">
                {split ? `${t('split.person', { n: i + 1 })} · ` : ''}
                {p.method === 'card' ? t('checkout.card') : t('checkout.cash')}
              </span>
              {split ? (
                <span className="tnum text-cream">
                  {money(p.amount - (p.change || 0))}
                  {p.change > 0 && <span className="text-mint"> · {t('split.change')} {money(p.change)}</span>}
                </span>
              ) : (
                <span className="font-display font-bold text-cream tnum">{money(p.amount)}</span>
              )}
            </div>
          ))}
        {!edit && !split && order.change_due > 0 && (
          <div className="flex justify-between items-center rounded-2xl bg-mint/15 border border-mint/40 px-4 py-2.5 mt-2">
            <span className="text-mint font-semibold">{t('history.changeGiven')}</span>
            <span className="font-display text-xl font-bold text-mint tnum">{money(order.change_due)}</span>
          </div>
        )}
        {!edit && split && order.change_due > 0 && (
          <div className="flex justify-between items-center rounded-2xl bg-mint/15 border border-mint/40 px-4 py-2.5 mt-2">
            <span className="text-mint font-semibold">{t('split.totalChange')}</span>
            <span className="font-display text-xl font-bold text-mint tnum">{money(order.change_due)}</span>
          </div>
        )}
      </div>

      {edit ? (
        <div className="flex gap-3 pt-2">
          <button className="btn-ghost flex-1" onClick={() => setEdit(false)}>{t('common.discard')}</button>
          <button className="btn-accent flex-1" onClick={save}>{t('history.saveChanges')}</button>
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          {(isAdmin || canDelete) && !deleted && (
            <div className="flex gap-3">
              {isAdmin && (
                <button className="btn-ghost flex-1" onClick={() => setEdit(true)}>
                  <IconEdit width={18} height={18} /> {t('common.edit')}
                </button>
              )}
              {canDelete && (
                <button className="btn-danger flex-1" onClick={onCancel}>
                  <IconTrash width={18} height={18} /> {t('history.deleteConfirm')}
                </button>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" disabled={printing} onClick={onReprint}>
              <IconPrint width={20} height={20} /> {printing ? t('history.printing') : t('history.reprint')}
            </button>
            <button className="btn-accent flex-1" onClick={onClose}>{t('common.close')}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

const pill = (active) =>
  `px-3.5 py-2 rounded-xl text-sm font-semibold border transition ${active ? 'bg-ember text-[#2a1c0c] border-ember' : 'bg-surface2 border-line text-muted hover:text-cream'}`

function Line({ label, value, muted, className = '' }) {
  return (
    <div className="flex justify-between text-base">
      <span className={muted ? 'text-muted' : ''}>{label}</span>
      <span className={`tnum font-semibold ${className}`}>{value}</span>
    </div>
  )
}
