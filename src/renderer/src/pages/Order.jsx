import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { money, unitsToMillis, useSettings } from '../lib/settings'
import { useT } from '../lib/i18n'
import Modal from '../components/Modal'
import ProductCard from '../components/ProductCard'
import { useDialog } from '../components/Dialog'
import { IconBack, IconTrash } from '../components/icons'

export default function Order() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const { confirm } = useDialog()
  const { t } = useT()
  const threshold = parseInt(settings.low_stock_threshold || '5', 10)

  const [order, setOrder] = useState(null)
  const [categories, setCategories] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [products, setProducts] = useState([])
  const [stockMap, setStockMap] = useState({})
  const [toast, setToast] = useState(null)
  const [picker, setPicker] = useState(null) // { product, groups } when choosing modifiers
  const scan = useRef({ buf: '', last: 0 })

  // Live stock per product. Stock is reserved as items are added to the order, so
  // these counts reflect what's still available and must be refreshed after changes.
  const refreshStock = async () => {
    const rows = await api.products.stock() // [{ id, stock }] — no image payload
    const map = Object.fromEntries(rows.map((r) => [r.id, r.stock]))
    setStockMap(map)
    return map
  }

  useEffect(() => {
    api.orders.openForTable(Number(tableId)).then(setOrder)
    api.categories.list().then((cats) => {
      setCategories(cats)
      if (cats.length) setActiveCat(cats[0].id)
    })
    refreshStock()
  }, [tableId])

  useEffect(() => {
    if (activeCat != null) api.products.byCategory(activeCat).then(setProducts)
  }, [activeCat])

  const warn = (level, text) => setToast({ level, text, at: Date.now() })

  // Warn once the reserved unit leaves stock running low / empty (uses live remaining).
  const warnStock = (name, left) => {
    if (left <= 0) warn('out', t('order.lastOne', { name }))
    else if (left <= threshold) warn('low', t('order.runningLow', { name, n: left }))
  }

  // Tap a product: if it has size/extra options, open the picker; otherwise add directly.
  const addProduct = async (p) => {
    if (p.modifier_count > 0) {
      const groups = await api.products.modifiers(p.id)
      setPicker({ product: p, groups })
      return
    }
    try {
      setOrder(await api.orders.addItem(order.id, p.id))
    } catch (e) {
      warn('out', e.message)
      return
    }
    const map = await refreshStock()
    warnStock(p.name, map[p.id] ?? 0)
  }

  const confirmPicker = async (optionIds) => {
    const p = picker.product
    try {
      setOrder(await api.orders.addItemWithMods(order.id, p.id, optionIds))
    } catch (e) {
      warn('out', e.message)
      return
    }
    setPicker(null)
    const map = await refreshStock()
    warnStock(p.name, map[p.id] ?? 0)
  }

  // auto-dismiss the toast
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(id)
  }, [toast])

  // Barcode scanner support: scanners type fast and end with Enter.
  useEffect(() => {
    if (!order) return
    const onKey = async (e) => {
      const el = document.activeElement
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return // don't hijack real typing
      const now = Date.now()
      const s = scan.current
      if (e.key === 'Enter') {
        const code = s.buf
        s.buf = ''
        if (code.length >= 3) {
          const p = await api.products.byBarcode(code)
          if (p) addProduct(p)
          else warn('out', t('order.noBarcode', { code }))
        }
        return
      }
      if (e.key.length === 1) {
        if (now - s.last > 100) s.buf = '' // reset if it wasn't a fast burst
        s.buf += e.key
        s.last = now
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [order, picker])
  const changeQty = async (item, delta) => {
    try {
      setOrder(await api.orders.setItemQty(item.id, item.qty + delta))
    } catch (e) {
      warn('out', e.message)
      return
    }
    refreshStock() // adding reserves stock, removing returns it
  }

  const cancelOrder = async () => {
    if (
      order.items.length &&
      !(await confirm({
        title: t('order.cancelTitle'),
        message: t('order.cancelMsg'),
        confirmText: t('order.cancelConfirm'),
        cancelText: t('common.keep'),
        danger: true
      }))
    )
      return
    await api.orders.void(order.id)
    navigate('/')
  }

  if (!order) return <div className="p-8 text-muted">{t('common.loading')}</div>
  const itemCount = order.items.reduce((s, i) => s + i.qty, 0)
  // Units of a product still addable: stock is already reduced as items are reserved,
  // so the live count is exactly what remains.
  const remainingFor = (productId) =>
    stockMap[productId] == null ? Infinity : Math.max(0, stockMap[productId])

  return (
    <div className="h-screen flex">
      {/* ---------- Product browser ---------- */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex items-center gap-3 mb-5">
          <button className="btn-ghost px-3.5 py-3" onClick={() => navigate('/')}>
            <IconBack width={22} height={22} />
          </button>
          <div>
            <h1 className="font-display text-3xl font-bold leading-none">{t('order.tableTitle', { label: order.table_label })}</h1>
            <p className="text-muted text-sm mt-1">{t('order.tapItems')}</p>
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
            <ProductCard key={p.id} product={p} remaining={remainingFor(p.id)} threshold={threshold} index={i} onAdd={addProduct} />
          ))}
          {products.length === 0 && <p className="text-muted col-span-full mt-4">{t('order.noProducts')}</p>}
        </div>
      </div>

      {/* low/out-of-stock toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-pop">
          <div
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-soft border font-semibold ${
              toast.level === 'out' ? 'bg-berry text-white border-berry' : 'bg-ember text-[#2a1c0c] border-ember'
            }`}
          >
            <span className="text-xl">⚠️</span>
            {toast.text}
          </div>
        </div>
      )}

      {/* ---------- Order ticket ---------- */}
      <div className="w-[400px] shrink-0 bg-surface/80 border-s border-line backdrop-blur-md flex flex-col">
        <div className="p-6 border-b border-line">
          <h2 className="font-display text-2xl font-bold">{t('order.orderNum', { id: order.id })}</h2>
          <p className="text-muted">{itemCount === 1 ? t('order.item', { n: itemCount }) : t('order.items', { n: itemCount })}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {order.items.length === 0 && <p className="text-muted text-center mt-12">{t('order.ticketEmpty')}</p>}
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 py-3 border-b border-line/60 animate-pop">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{item.name}</div>
                {item.modifiers && <div className="text-xs text-ember truncate">{item.modifiers}</div>}
                <div className="text-sm text-muted tnum">{t('order.eachPrice', { price: money(item.unit_price) })}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button className="w-9 h-9 rounded-xl bg-surface2 border border-line text-2xl leading-none active:scale-90" onClick={() => changeQty(item, -1)}>−</button>
                <span className="w-7 text-center text-lg font-bold tnum">{item.qty}</span>
                <button
                  className="w-9 h-9 rounded-xl bg-surface2 border border-line text-2xl leading-none active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                  disabled={item.product_id != null && remainingFor(item.product_id) <= 0}
                  onClick={() => changeQty(item, +1)}
                >
                  +
                </button>
              </div>
              <div className="w-[88px] text-end font-display font-bold tnum">{money(item.unit_price * item.qty)}</div>
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-line space-y-4">
          <div className="flex justify-between items-baseline">
            <span className="text-muted text-lg">{t('order.total')}</span>
            <span className="font-display text-4xl font-bold text-ember tnum">{money(order.total)}</span>
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-3">
            <button className="btn-danger px-4" onClick={cancelOrder} title={t('order.cancelTitle')}>
              <IconTrash width={20} height={20} />
            </button>
            <button className="btn-green" disabled={order.items.length === 0} onClick={() => navigate(`/checkout/${order.id}`)}>
              {t('order.checkout')}
            </button>
          </div>
        </div>
      </div>

      {picker && <ModifierPicker product={picker.product} groups={picker.groups} onClose={() => setPicker(null)} onConfirm={confirmPicker} />}
    </div>
  )
}

function ModifierPicker({ product, groups, onClose, onConfirm }) {
  // selected: { [groupId]: number[] } of chosen option ids
  const [selected, setSelected] = useState({})
  const { t } = useT()

  const toggle = (group, optId) => {
    setSelected((s) => {
      const cur = s[group.id] || []
      if (group.multi) {
        return { ...s, [group.id]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] }
      }
      return { ...s, [group.id]: [optId] } // single choice
    })
  }

  const allOptions = groups.flatMap((g) => g.options)
  const chosenIds = Object.values(selected).flat()
  const delta = chosenIds.reduce((sum, id) => sum + (allOptions.find((o) => o.id === id)?.price_delta || 0), 0)
  const missingRequired = groups.some((g) => g.required && !(selected[g.id] || []).length)

  return (
    <Modal title={product.name} subtitle={t('order.chooseOptions')} onClose={onClose} width={460}>
      <div className="max-h-[50vh] overflow-y-auto space-y-4 -mx-1 px-1">
        {groups.map((g) => (
          <div key={g.id}>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-semibold">{g.name}</span>
              <span className="text-xs text-muted">{g.required ? t('common.required') + ' · ' : ''}{g.multi ? t('order.chooseAny') : t('order.chooseOne')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {g.options.map((o) => {
                const on = (selected[g.id] || []).includes(o.id)
                return (
                  <button
                    key={o.id}
                    onClick={() => toggle(g, o.id)}
                    className={`px-4 py-3 rounded-xl border text-start transition ${on ? 'bg-ember text-[#2a1c0c] border-ember' : 'bg-surface2 border-line hover:bg-surface3'}`}
                  >
                    <div className="font-semibold">{o.name}</div>
                    {o.price_delta !== 0 && <div className={`text-xs tnum ${on ? '' : 'text-muted'}`}>+{money(o.price_delta)}</div>}
                  </button>
                )
              })}
              {g.options.length === 0 && <p className="text-muted text-sm col-span-2">{t('order.noOptionsInGroup')}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-muted">{t('order.itemTotal')}</span>
        <span className="font-display text-2xl font-bold text-ember tnum">{money(product.price + delta)}</span>
      </div>
      <div className="flex gap-3">
        <button className="btn-ghost flex-1" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-accent flex-1" disabled={missingRequired} onClick={() => onConfirm(chosenIds)}>
          {missingRequired ? t('order.selectRequired') : t('order.addToOrder')}
        </button>
      </div>
    </Modal>
  )
}
