import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { money, unitsToMillis, useSettings } from '../lib/settings'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { IconPlus, IconTrash } from '../components/icons'

// Stock badge with low/out colouring.
function StockBadge({ stock, threshold }) {
  if (stock <= 0) return <span className="chip bg-berry/20 text-berry">Out of stock</span>
  if (stock <= threshold) return <span className="chip bg-ember/15 text-ember tnum">{stock} left</span>
  return <span className="chip bg-surface3 text-muted tnum">{stock} in stock</span>
}

const COLORS = ['#EC9A45', '#E26A52', '#54D6A0', '#6BA3F7', '#B583F7', '#F7B96B', '#9AA35A', '#9789A8']

export default function Products() {
  const { settings } = useSettings()
  const threshold = parseInt(settings.low_stock_threshold || '5', 10)
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [selectedCat, setSelectedCat] = useState(null)
  const [editing, setEditing] = useState(null)
  const [catModal, setCatModal] = useState(null)

  const loadAll = async () => {
    const [cats, prods] = await Promise.all([api.categories.list(), api.products.list()])
    setCategories(cats)
    setProducts(prods)
  }
  useEffect(() => {
    loadAll()
  }, [])

  const visible = selectedCat ? products.filter((p) => p.category_id === selectedCat) : products

  const saveProduct = async (form) => {
    const payload = {
      ...form,
      price: unitsToMillis(form.priceStr),
      category_id: Number(form.category_id),
      stock: Number(form.stock) || 0
    }
    if (form.id) await api.products.update(payload)
    else await api.products.create(payload)
    setEditing(null)
    loadAll()
  }

  const lowItems = products.filter((p) => p.stock <= threshold)
  const deleteProduct = async (p) => {
    if (confirm(`Delete "${p.name}"?`)) {
      await api.products.remove(p.id)
      loadAll()
    }
  }
  const saveCategory = async (form) => {
    if (form.id) await api.categories.update(form)
    else await api.categories.create(form)
    setCatModal(null)
    loadAll()
  }
  const deleteCategory = async (c) => {
    if (confirm(`Delete category "${c.name}" and all its products?`)) {
      await api.categories.remove(c.id)
      if (selectedCat === c.id) setSelectedCat(null)
      loadAll()
    }
  }

  return (
    <div className="h-full flex">
      {/* categories rail */}
      <div className="w-72 shrink-0 bg-surface/60 border-r border-line p-4 flex flex-col gap-2 overflow-y-auto">
        <h2 className="font-display text-lg font-bold mb-1 px-1">Categories</h2>
        <button
          onClick={() => setSelectedCat(null)}
          className={`text-left px-4 py-3 rounded-2xl font-semibold transition ${selectedCat === null ? 'bg-ember text-[#2a1c0c]' : 'bg-surface2 hover:bg-surface3'}`}
        >
          All products · {products.length}
        </button>
        {categories.map((c) => {
          const count = products.filter((p) => p.category_id === c.id).length
          return (
            <div key={c.id} className="flex items-center gap-1">
              <button
                onClick={() => setSelectedCat(c.id)}
                className={`flex-1 text-left px-4 py-3 rounded-2xl font-semibold flex items-center gap-2.5 transition ${selectedCat === c.id ? 'bg-ember text-[#2a1c0c]' : 'bg-surface2 hover:bg-surface3'}`}
              >
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs opacity-70 tnum">{count}</span>
              </button>
              <button className="px-2 py-3 text-muted hover:text-cream" onClick={() => setCatModal(c)}>✎</button>
            </div>
          )
        })}
        <button className="btn-ghost mt-2" onClick={() => setCatModal({ name: '', color: COLORS[0], sort_order: categories.length + 1 })}>
          <IconPlus width={18} height={18} /> Category
        </button>
      </div>

      {/* product list */}
      <div className="flex-1 flex flex-col p-7 overflow-hidden">
        <PageHeader title="Menu" subtitle={`${visible.length} product${visible.length === 1 ? '' : 's'}`}>
          <button className="btn-accent" disabled={categories.length === 0} onClick={() => setEditing({ name: '', priceStr: '', category_id: selectedCat || categories[0]?.id, active: 1, stock: 0 })}>
            <IconPlus width={20} height={20} /> Add product
          </button>
        </PageHeader>

        {lowItems.length > 0 && (
          <div className="mb-4 rounded-2xl bg-ember/10 border border-ember/40 px-5 py-3 flex items-center gap-3 animate-rise">
            <span className="text-2xl">⚠️</span>
            <span className="text-cream">
              <span className="font-semibold text-ember">{lowItems.length}</span> product{lowItems.length === 1 ? ' is' : 's are'} low or out of stock
              <span className="text-muted"> (threshold {threshold})</span>: {lowItems.slice(0, 4).map((p) => p.name).join(', ')}{lowItems.length > 4 ? '…' : ''}
            </span>
          </div>
        )}

        <div className="card flex-1 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface text-muted text-sm z-10">
              <tr>
                <th className="px-5 py-4 font-medium">Name</th>
                <th className="px-5 py-4 font-medium">Category</th>
                <th className="px-5 py-4 font-medium text-right">Price</th>
                <th className="px-5 py-4 font-medium text-center">Stock</th>
                <th className="px-5 py-4 font-medium text-center">Status</th>
                <th className="px-5 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className="border-t border-line/60 text-lg hover:bg-surface2/40">
                  <td className="px-5 py-3.5 font-semibold">{p.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-2 text-muted">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.category_color }} />
                      {p.category_name || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-display font-bold text-ember tnum">{money(p.price)}</td>
                  <td className="px-5 py-3.5 text-center"><StockBadge stock={p.stock} threshold={threshold} /></td>
                  <td className="px-5 py-3.5 text-center">
                    {p.active ? <span className="chip bg-mint/15 text-mint">Active</span> : <span className="chip bg-surface3 text-muted">Hidden</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <button className="px-3 py-2 rounded-xl bg-surface2 border border-line mr-2 hover:bg-surface3" onClick={() => setEditing({ ...p, priceStr: String(p.price / 1000) })}>Edit</button>
                    <button className="px-3 py-2 rounded-xl bg-berry/80 text-white hover:bg-berry" onClick={() => deleteProduct(p)}>Delete</button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted">No products yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <ProductModal product={editing} categories={categories} onClose={() => setEditing(null)} onSave={saveProduct} />}
      {catModal && <CategoryModal category={catModal} onClose={() => setCatModal(null)} onSave={saveCategory} onDelete={catModal.id ? () => deleteCategory(catModal) : null} />}
    </div>
  )
}

function ProductModal({ product, categories, onClose, onSave }) {
  const [form, setForm] = useState(product)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <Modal title={product.id ? 'Edit product' : 'New product'} onClose={onClose}>
      <label className="block">
        <span className="text-muted text-sm">Name</span>
        <input className="input mt-1.5" value={form.name} autoFocus onChange={(e) => set('name', e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-muted text-sm">Price</span>
          <input className="input mt-1.5 tnum" inputMode="decimal" placeholder="e.g. 2.500" value={form.priceStr} onChange={(e) => set('priceStr', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-muted text-sm">Stock on hand</span>
          <input className="input mt-1.5 tnum" type="number" inputMode="numeric" value={form.stock ?? 0} onChange={(e) => set('stock', e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className="text-muted text-sm">Category</span>
        <select className="input mt-1.5" value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-3">
        <input type="checkbox" className="w-6 h-6 accent-[#EC9A45]" checked={!!form.active} onChange={(e) => set('active', e.target.checked ? 1 : 0)} />
        <span>Active (shown on order screen)</span>
      </label>
      <div className="flex gap-3 pt-1">
        <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
        <button className="btn-accent flex-1" disabled={!form.name.trim()} onClick={() => onSave(form)}>Save</button>
      </div>
    </Modal>
  )
}

function CategoryModal({ category, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(category)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <Modal title={category.id ? 'Edit category' : 'New category'} onClose={onClose}>
      <label className="block">
        <span className="text-muted text-sm">Name</span>
        <input className="input mt-1.5" value={form.name} autoFocus onChange={(e) => set('name', e.target.value)} />
      </label>
      <div>
        <span className="text-muted text-sm">Color</span>
        <div className="flex flex-wrap gap-2.5 mt-2">
          {COLORS.map((c) => (
            <button key={c} onClick={() => set('color', c)} style={{ backgroundColor: c }} className={`w-10 h-10 rounded-full transition ${form.color === c ? 'ring-2 ring-cream ring-offset-2 ring-offset-surface' : ''}`} />
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        {onDelete && <button className="btn-danger px-4" onClick={onDelete}><IconTrash width={20} height={20} /></button>}
        <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
        <button className="btn-accent flex-1" disabled={!form.name.trim()} onClick={() => onSave(form)}>Save</button>
      </div>
    </Modal>
  )
}
