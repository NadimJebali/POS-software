import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { money, unitsToMillis, currencyDecimals } from '../lib/settings'
import NumberPad from '../components/NumberPad'
import Modal from '../components/Modal'
import { useDialog } from '../components/Dialog'
import { IconBack, IconPrint, IconTrash } from '../components/icons'

const QUICK_UNITS = [1, 5, 10, 20, 50]
const DISCOUNTS = [0, 5, 10, 15]

export default function Checkout() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { alert } = useDialog()

  const [order, setOrder] = useState(null)
  const [method, setMethod] = useState('cash')
  const [amountStr, setAmountStr] = useState('')
  const [discountModal, setDiscountModal] = useState(false)
  const [paid, setPaid] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.orders.get(Number(orderId)).then(setOrder)
  }, [orderId])

  if (!order) return <div className="p-8 text-muted">Loading…</div>

  const dec = currencyDecimals()
  const amount = unitsToMillis(amountStr)
  // Factor the amount currently being typed into a live "tendered" projection
  // so the cashier sees the change to return before completing the sale.
  const projectedPaid = order.paid + amount
  const remaining = Math.max(0, order.total - projectedPaid)
  const change = Math.max(0, projectedPaid - order.total)
  const setExact = () => setAmountStr((Math.max(0, order.total - order.paid) / 1000).toFixed(dec))
  const addQuick = (units) => setAmountStr(((amount + units * 1000) / 1000).toFixed(dec))

  const setDiscount = async (type, value) => {
    setOrder(await api.orders.setDiscount(order.id, type, value))
    setDiscountModal(false)
  }

  const addPayment = async () => {
    if (amount <= 0) return
    setOrder(await api.orders.addPayment(order.id, method, amount))
    setAmountStr('')
  }
  const removePayment = async (id) => setOrder(await api.orders.removePayment(id))

  const complete = async () => {
    setBusy(true)
    try {
      // Fast path: if the cashier typed an amount but didn't tap "Add", record it now.
      let current = order
      if (amount > 0) {
        current = await api.orders.addPayment(order.id, method, amount)
        setOrder(current)
        setAmountStr('')
      }
      if (current.paid < current.total) {
        setBusy(false)
        return
      }
      const result = await api.orders.complete(order.id)
      setPaid(result)
    } catch (e) {
      alert({ title: 'Cannot complete sale', message: e.message })
    } finally {
      setBusy(false)
    }
  }

  const print = async () => {
    try {
      await api.receipt.print(paid.id)
    } catch (e) {
      alert({ title: 'Print failed', message: e.message })
    }
  }

  // ---------- Paid confirmation ----------
  if (paid) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-20 h-20 rounded-full bg-mint/15 flex items-center justify-center animate-pop">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#54D6A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 className="font-display text-4xl font-bold animate-rise">Payment complete</h1>
        <div className="card p-8 w-[440px] space-y-3 text-lg animate-rise">
          <Row label="Total" value={money(paid.total)} />
          {paid.payments.map((p) => (
            <Row key={p.id} label={p.method === 'card' ? 'Paid by card' : 'Paid in cash'} value={money(p.amount)} muted />
          ))}
          <div className="h-px bg-line my-1" />
          <Row label="Change due" value={money(paid.change_due)} big accent />
        </div>
        <div className="flex gap-3">
          <button className="btn-ghost" onClick={print}>
            <IconPrint width={20} height={20} /> Print receipt
          </button>
          <button className="btn-accent" onClick={() => navigate('/')}>Done</button>
        </div>
      </div>
    )
  }

  const canComplete = projectedPaid >= order.total && order.items.length > 0

  // ---------- Checkout entry ----------
  return (
    <div className="h-screen flex">
      {/* order + discount */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex items-center gap-3 mb-5">
          <button className="btn-ghost px-3.5 py-3" onClick={() => navigate(`/order/${order.table_id}`)}>
            <IconBack width={22} height={22} />
          </button>
          <h1 className="font-display text-3xl font-bold">
            Checkout{order.table_label ? ` · Table ${order.table_label}` : ''}
          </h1>
        </div>

        <div className="card flex-1 overflow-y-auto p-5 divide-y divide-line/60">
          {order.items.map((it) => (
            <div key={it.id} className="flex justify-between py-2.5 text-lg">
              <span className="text-cream">
                <span className="text-muted tnum mr-2">{it.qty}×</span>
                {it.name}
                {it.modifiers && <span className="block text-sm text-ember ml-7">{it.modifiers}</span>}
              </span>
              <span className="font-semibold tnum">{money(it.unit_price * it.qty)}</span>
            </div>
          ))}
        </div>

        {/* discount control */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-muted text-sm mr-1">Discount</span>
          {DISCOUNTS.map((d) => (
            <button
              key={d}
              onClick={() => setDiscount('percent', d)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                order.subtotal > 0 && order.discount === Math.round((order.subtotal * d) / 100) && (d > 0 || order.discount === 0)
                  ? 'bg-ember text-[#2a1c0c] border-ember'
                  : 'bg-surface2 border-line text-muted hover:text-cream'
              }`}
            >
              {d === 0 ? 'None' : `${d}%`}
            </button>
          ))}
          <button className="px-4 py-2 rounded-xl text-sm font-semibold bg-surface2 border border-line text-muted hover:text-cream" onClick={() => setDiscountModal(true)}>
            Custom
          </button>
        </div>

        <div className="mt-4 space-y-1.5">
          {order.discount > 0 && (
            <>
              <Row label="Subtotal" value={money(order.subtotal)} muted />
              <Row label="Discount" value={`- ${money(order.discount)}`} discount />
            </>
          )}
          <div className="flex justify-between items-baseline">
            <span className="text-xl">Total</span>
            <span className="font-display text-4xl font-bold text-ember tnum">{money(order.total)}</span>
          </div>
        </div>
      </div>

      {/* payment panel */}
      <div className="w-[460px] shrink-0 bg-surface/80 border-l border-line backdrop-blur-md flex flex-col p-6 gap-3 overflow-y-auto">
        {/* tendered / change-or-remaining (live as you type) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface2 border border-line p-3 text-center">
            <div className="text-muted text-xs">Tendered</div>
            <div className="font-display text-2xl font-bold tnum">{money(projectedPaid)}</div>
          </div>
          {remaining > 0 ? (
            <div className="rounded-2xl bg-surface2 border border-line p-3 text-center">
              <div className="text-muted text-xs">Remaining</div>
              <div className="font-display text-2xl font-bold tnum text-ember">{money(remaining)}</div>
            </div>
          ) : (
            <div className="rounded-2xl bg-mint/15 border border-mint/40 p-3 text-center">
              <div className="text-mint/80 text-xs">Change to return</div>
              <div className="font-display text-2xl font-bold tnum text-mint">{money(change)}</div>
            </div>
          )}
        </div>

        {/* existing payments */}
        {order.payments.length > 0 && (
          <div className="space-y-1.5">
            {order.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-surface2/70 border border-line px-3 py-2 animate-pop">
                <span className="chip bg-surface3 text-cream">{p.method === 'card' ? 'Card' : 'Cash'}</span>
                <span className="tnum font-semibold">{money(p.amount)}</span>
                <button className="text-muted hover:text-berry" onClick={() => removePayment(p.id)}>
                  <IconTrash width={18} height={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* method toggle */}
        <div className="grid grid-cols-2 gap-2">
          {['cash', 'card'].map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`py-2.5 rounded-xl font-semibold capitalize border transition ${
                method === m ? 'bg-ember text-[#2a1c0c] border-ember' : 'bg-surface2 border-line text-muted'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* amount display */}
        <div className="rounded-2xl bg-surface2 border border-line px-4 py-3">
          <div className="text-muted text-xs">Amount tendered</div>
          <div className="font-display text-3xl font-bold tnum">{amountStr || '0'}</div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          <button onClick={setExact} className="py-2.5 rounded-xl bg-surface3 text-cream text-sm font-semibold active:scale-95">Exact</button>
          {QUICK_UNITS.map((u) => (
            <button key={u} onClick={() => addQuick(u)} className="py-2.5 rounded-xl bg-surface2 border border-line text-sm font-semibold active:scale-95 tnum">
              +{u}
            </button>
          ))}
        </div>

        <NumberPad value={amountStr} onChange={setAmountStr} />

        <button className="btn-ghost" disabled={amount <= 0} onClick={addPayment}>
          Add {method} payment
        </button>
        <button className="btn-green text-2xl py-4" disabled={!canComplete || busy} onClick={complete}>
          {busy ? 'Processing…' : !canComplete ? `${money(remaining)} left` : change > 0 ? `Complete · return ${money(change)}` : 'Complete sale'}
        </button>
      </div>

      {discountModal && <DiscountModal subtotal={order.subtotal} onClose={() => setDiscountModal(false)} onApply={setDiscount} />}
    </div>
  )
}

function DiscountModal({ subtotal, onClose, onApply }) {
  const [type, setType] = useState('percent')
  const [val, setVal] = useState('')
  return (
    <Modal title="Custom discount" onClose={onClose} width={420}>
      <div className="grid grid-cols-2 gap-2">
        {[['percent', 'Percentage'], ['amount', 'Fixed amount']].map(([t, label]) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`py-2.5 rounded-xl font-semibold border transition ${type === t ? 'bg-ember text-[#2a1c0c] border-ember' : 'bg-surface2 border-line text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        className="input tnum"
        inputMode="decimal"
        autoFocus
        placeholder={type === 'percent' ? '% off (0-100)' : 'amount off'}
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
      <p className="text-muted text-sm">Subtotal: {money(subtotal)}</p>
      <div className="flex gap-3">
        <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
        <button
          className="btn-accent flex-1"
          onClick={() => onApply(type, type === 'percent' ? Number(val) : unitsToMillis(val))}
        >
          Apply
        </button>
      </div>
    </Modal>
  )
}

function Row({ label, value, big, accent, muted, discount }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className={muted ? 'text-muted' : ''}>{label}</span>
      <span className={`tnum font-bold ${big ? 'font-display text-3xl' : ''} ${accent ? 'text-mint' : ''} ${discount ? 'text-berry' : ''}`}>
        {value}
      </span>
    </div>
  )
}
