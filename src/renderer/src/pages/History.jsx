import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { money } from '../lib/settings'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { IconPrint, IconEdit, IconTrash } from '../components/icons'

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function History() {
  const { isAdmin } = useAuth()
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
    if (!confirm('Cancel this order? It will be removed from history and its stock restored.')) return
    try {
      await api.orders.cancelPaid(id)
      setDetail(null)
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  const saveEdits = async (id, items, discountType, discountValue) => {
    try {
      const updated = await api.orders.updatePaid(id, items, discountType, discountValue)
      setDetail(updated)
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  const total = orders.reduce((s, o) => s + o.total, 0)

  const reprint = async (id) => {
    setPrinting(id)
    try {
      await api.receipt.print(id)
    } catch (e) {
      alert('Print failed: ' + e.message)
    } finally {
      setPrinting(null)
    }
  }

  return (
    <div className="h-full flex flex-col p-7 overflow-hidden">
      <PageHeader title="History" subtitle={`${orders.length} order${orders.length === 1 ? '' : 's'} · ${money(total)}`}>
        <button
          onClick={() => setAll((v) => !v)}
          className={`px-4 py-2.5 rounded-2xl font-semibold border transition ${all ? 'bg-ember text-[#2a1c0c] border-ember' : 'bg-surface2 border-line text-muted hover:text-cream'}`}
        >
          All time
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
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-surface text-muted text-sm z-10">
            <tr>
              <th className="px-5 py-4 font-medium">Order</th>
              <th className="px-5 py-4 font-medium">Table</th>
              <th className="px-5 py-4 font-medium">Time</th>
              <th className="px-5 py-4 font-medium text-center">Items</th>
              <th className="px-5 py-4 font-medium text-right">Discount</th>
              <th className="px-5 py-4 font-medium text-right">Total</th>
              <th className="px-5 py-4 font-medium text-right">Change</th>
              <th className="px-5 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                onClick={() => openDetail(o.id)}
                className="border-t border-line/60 text-lg hover:bg-surface2/40 cursor-pointer"
              >
                <td className="px-5 py-3.5 font-semibold tnum">#{o.id}</td>
                <td className="px-5 py-3.5">{o.table_label || '—'}</td>
                <td className="px-5 py-3.5 text-muted tnum">{new Date(o.paid_at + 'Z').toLocaleString()}</td>
                <td className="px-5 py-3.5 text-center tnum">{o.item_count}</td>
                <td className="px-5 py-3.5 text-right tnum text-berry">{o.discount > 0 ? '- ' + money(o.discount) : '—'}</td>
                <td className="px-5 py-3.5 text-right font-display font-bold text-ember tnum">{money(o.total)}</td>
                <td className={`px-5 py-3.5 text-right tnum ${o.change_due > 0 ? 'text-mint' : 'text-muted'}`}>{money(o.change_due)}</td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-surface2 border border-line hover:bg-surface3 disabled:opacity-50"
                    disabled={printing === o.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      reprint(o.id)
                    }}
                  >
                    <IconPrint width={18} height={18} /> {printing === o.id ? '…' : 'Receipt'}
                  </button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-muted">No orders for this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <OrderDetail
          order={detail}
          isAdmin={isAdmin}
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

function OrderDetail({ order, isAdmin, onClose, onReprint, printing, onCancel, onSave }) {
  const [edit, setEdit] = useState(false)
  const [qty, setQty] = useState({})
  const [disc, setDisc] = useState(null) // null = keep existing; number = percent
  const when = new Date(order.paid_at + 'Z').toLocaleString()

  useEffect(() => {
    setQty(Object.fromEntries(order.items.map((i) => [i.id, i.qty])))
    setDisc(null)
    setEdit(false)
  }, [order])

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
      title={`Order #${order.id}${order.table_label ? ` · Table ${order.table_label}` : ''}`}
      subtitle={when}
      onClose={onClose}
      width={480}
    >
      <div className="max-h-[42vh] overflow-y-auto -mx-1 px-1 divide-y divide-line/60">
        {order.items.map((it) => (
          <div key={it.id} className="flex items-center justify-between py-2.5 gap-3">
            <span className="flex-1 min-w-0">
              {!edit && <span className="text-muted tnum mr-2">{it.qty}×</span>}
              <span className={q(it) === 0 ? 'line-through text-muted' : ''}>{it.name}</span>
              <span className="text-muted text-sm tnum ml-2">@ {money(it.unit_price)}</span>
            </span>
            {edit ? (
              <span className="flex items-center gap-1.5">
                <button className="w-8 h-8 rounded-lg bg-surface2 border border-line text-xl leading-none active:scale-90" onClick={() => setQ(it.id, q(it) - 1)}>−</button>
                <span className="w-6 text-center font-bold tnum">{q(it)}</span>
                <button className="w-8 h-8 rounded-lg bg-surface2 border border-line text-xl leading-none active:scale-90" onClick={() => setQ(it.id, q(it) + 1)}>+</button>
              </span>
            ) : (
              <span className="font-semibold tnum">{money(it.unit_price * it.qty)}</span>
            )}
          </div>
        ))}
        {order.items.length === 0 && <p className="text-muted py-3">No items recorded.</p>}
      </div>

      {edit && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-muted text-sm mr-1">Discount</span>
          <button onClick={() => setDisc(null)} className={pill(disc === null)}>Keep</button>
          {DISCOUNTS.map((d) => (
            <button key={d} onClick={() => setDisc(d)} className={pill(disc === d)}>{d === 0 ? 'None' : `${d}%`}</button>
          ))}
        </div>
      )}

      <div className="space-y-1.5 pt-1">
        {discount > 0 && (
          <>
            <Line label="Subtotal" value={money(subtotal)} muted />
            <Line label="Discount" value={`- ${money(discount)}`} className="text-berry" />
          </>
        )}
        <div className="flex justify-between items-baseline">
          <span className="text-lg">Total</span>
          <span className="font-display text-2xl font-bold text-ember tnum">{money(total)}</span>
        </div>
        {!edit &&
          (order.payments || []).map((p) => (
            <div key={p.id} className="flex justify-between items-center rounded-xl bg-surface2/70 border border-line px-4 py-2 mt-1">
              <span className="chip bg-surface3 text-cream">{p.method === 'card' ? 'Card' : 'Cash'}</span>
              <span className="font-display font-bold text-cream tnum">{money(p.amount)}</span>
            </div>
          ))}
        {!edit && order.change_due > 0 && (
          <div className="flex justify-between items-center rounded-2xl bg-mint/15 border border-mint/40 px-4 py-2.5 mt-2">
            <span className="text-mint font-semibold">Change given</span>
            <span className="font-display text-xl font-bold text-mint tnum">{money(order.change_due)}</span>
          </div>
        )}
      </div>

      {edit ? (
        <div className="flex gap-3 pt-2">
          <button className="btn-ghost flex-1" onClick={() => setEdit(false)}>Discard</button>
          <button className="btn-accent flex-1" onClick={save}>Save changes</button>
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          {isAdmin && (
            <div className="flex gap-3">
              <button className="btn-ghost flex-1" onClick={() => setEdit(true)}>
                <IconEdit width={18} height={18} /> Edit
              </button>
              <button className="btn-danger flex-1" onClick={onCancel}>
                <IconTrash width={18} height={18} /> Cancel order
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" disabled={printing} onClick={onReprint}>
              <IconPrint width={20} height={20} /> {printing ? 'Printing…' : 'Re-print'}
            </button>
            <button className="btn-accent flex-1" onClick={onClose}>Close</button>
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
