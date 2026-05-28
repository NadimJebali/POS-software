import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { money } from '../lib/settings'
import { IconBack, IconTrash } from '../components/icons'

export default function Order() {
  const { tableId } = useParams()
  const navigate = useNavigate()

  const [order, setOrder] = useState(null)
  const [categories, setCategories] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [products, setProducts] = useState([])

  useEffect(() => {
    api.orders.openForTable(Number(tableId)).then(setOrder)
    api.categories.list().then((cats) => {
      setCategories(cats)
      if (cats.length) setActiveCat(cats[0].id)
    })
  }, [tableId])

  useEffect(() => {
    if (activeCat != null) api.products.byCategory(activeCat).then(setProducts)
  }, [activeCat])

  const addProduct = (p) => api.orders.addItem(order.id, p.id).then(setOrder)
  const changeQty = (item, delta) => api.orders.setItemQty(item.id, item.qty + delta).then(setOrder)

  const cancelOrder = async () => {
    if (order.items.length && !confirm('Cancel this order and clear the table?')) return
    await api.orders.void(order.id)
    navigate('/')
  }

  if (!order) return <div className="p-8 text-muted">Loading…</div>
  const itemCount = order.items.reduce((s, i) => s + i.qty, 0)

  return (
    <div className="h-screen flex">
      {/* ---------- Product browser ---------- */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex items-center gap-3 mb-5">
          <button className="btn-ghost px-3.5 py-3" onClick={() => navigate('/')}>
            <IconBack width={22} height={22} />
          </button>
          <div>
            <h1 className="font-display text-3xl font-bold leading-none">Table {order.table_label}</h1>
            <p className="text-muted text-sm mt-1">Tap items to add them to the ticket</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              style={activeCat === c.id ? { backgroundColor: c.color, borderColor: c.color } : {}}
              className={`px-5 py-2.5 rounded-full text-base font-semibold whitespace-nowrap border transition-all ${
                activeCat === c.id ? 'text-white shadow-soft' : 'bg-surface2 border-line text-muted hover:text-cream'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pr-1 content-start">
          {products.map((p, i) => (
            <button
              key={p.id}
              onClick={() => addProduct(p)}
              style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}
              className="animate-rise card p-4 h-28 flex flex-col justify-between text-left hover:border-ember/40 hover:bg-surface2 active:scale-[0.97] transition-all"
            >
              <span className="text-lg font-semibold leading-tight">{p.name}</span>
              <span className="text-ember font-display font-bold text-lg tnum">{money(p.price)}</span>
            </button>
          ))}
          {products.length === 0 && <p className="text-muted col-span-full mt-4">No products in this category.</p>}
        </div>
      </div>

      {/* ---------- Order ticket ---------- */}
      <div className="w-[400px] shrink-0 bg-surface/80 border-l border-line backdrop-blur-md flex flex-col">
        <div className="p-6 border-b border-line">
          <h2 className="font-display text-2xl font-bold">Order #{order.id}</h2>
          <p className="text-muted">{itemCount} item{itemCount === 1 ? '' : 's'}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {order.items.length === 0 && <p className="text-muted text-center mt-12">Ticket is empty.</p>}
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 py-3 border-b border-line/60 animate-pop">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{item.name}</div>
                <div className="text-sm text-muted tnum">{money(item.unit_price)} each</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button className="w-9 h-9 rounded-xl bg-surface2 border border-line text-2xl leading-none active:scale-90" onClick={() => changeQty(item, -1)}>−</button>
                <span className="w-7 text-center text-lg font-bold tnum">{item.qty}</span>
                <button className="w-9 h-9 rounded-xl bg-surface2 border border-line text-2xl leading-none active:scale-90" onClick={() => changeQty(item, +1)}>+</button>
              </div>
              <div className="w-[88px] text-right font-display font-bold tnum">{money(item.unit_price * item.qty)}</div>
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-line space-y-4">
          <div className="flex justify-between items-baseline">
            <span className="text-muted text-lg">Total</span>
            <span className="font-display text-4xl font-bold text-ember tnum">{money(order.total)}</span>
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-3">
            <button className="btn-danger px-4" onClick={cancelOrder} title="Cancel order">
              <IconTrash width={20} height={20} />
            </button>
            <button className="btn-green" disabled={order.items.length === 0} onClick={() => navigate(`/checkout/${order.id}`)}>
              Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
