import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { money, unitsToMillis, useSettings } from '../lib/settings'
import { useT } from '../lib/i18n'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { useDialog } from '../components/Dialog'
import { IconPlus, IconTrash } from '../components/icons'

// Downscale a chosen image to a small JPEG data URL so the DB stays lean. A white
// backdrop is painted first so transparent PNGs don't flatten to black.
function fileToResizedDataUrl(file, max = 512, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the image'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not a valid image'))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// Stock badge with low/out colouring.
function StockBadge({ stock, threshold }) {
  const { t } = useT()
  if (stock <= 0) return <span className="chip bg-berry/20 text-berry">{t('products.outOfStock')}</span>
  if (stock <= threshold) return <span className="chip bg-ember/15 text-ember tnum">{t('products.left', { n: stock })}</span>
  return <span className="chip bg-surface3 text-muted tnum">{t('products.inStock', { n: stock })}</span>
}

const COLORS = ['#EC9A45', '#E26A52', '#54D6A0', '#6BA3F7', '#B583F7', '#F7B96B', '#9AA35A', '#9789A8']

export default function Products() {
  const { settings } = useSettings()
  const { confirm } = useDialog()
  const { t } = useT()
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
    if (await confirm({ title: t('products.deleteTitle'), message: t('products.deleteMsg', { name: p.name }), confirmText: t('common.delete'), danger: true })) {
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
    if (await confirm({ title: t('products.deleteCatTitle'), message: t('products.deleteCatMsg', { name: c.name }), confirmText: t('common.delete'), danger: true })) {
      await api.categories.remove(c.id)
      if (selectedCat === c.id) setSelectedCat(null)
      loadAll()
    }
  }

  return (
    <div className="h-full flex">
      {/* categories rail */}
      <div className="w-72 shrink-0 bg-surface/60 border-r border-line p-4 flex flex-col gap-2 overflow-y-auto">
        <h2 className="font-display text-lg font-bold mb-1 px-1">{t('products.categories')}</h2>
        <button
          onClick={() => setSelectedCat(null)}
          className={`text-left px-4 py-3 rounded-2xl font-semibold transition ${selectedCat === null ? 'bg-ember text-[#2a1c0c]' : 'bg-surface2 hover:bg-surface3'}`}
        >
          {t('products.allProducts', { n: products.length })}
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
          <IconPlus width={18} height={18} /> {t('products.category')}
        </button>
      </div>

      {/* product list */}
      <div className="flex-1 flex flex-col p-7 overflow-hidden">
        <PageHeader title={t('products.title')} subtitle={t('products.count', { n: visible.length })}>
          <button className="btn-accent" disabled={categories.length === 0} onClick={() => setEditing({ name: '', priceStr: '', category_id: selectedCat || categories[0]?.id, active: 1, stock: 0, barcode: '' })}>
            <IconPlus width={20} height={20} /> {t('products.addProduct')}
          </button>
        </PageHeader>

        {lowItems.length > 0 && (
          <div className="mb-4 rounded-2xl bg-ember/10 border border-ember/40 px-5 py-3 flex items-center gap-3 animate-rise">
            <span className="text-2xl">⚠️</span>
            <span className="text-cream">
              {t('products.lowWarn', { n: lowItems.length, t: threshold })}: {lowItems.slice(0, 4).map((p) => p.name).join(', ')}{lowItems.length > 4 ? '…' : ''}
            </span>
          </div>
        )}

        <div className="card flex-1 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface text-muted text-sm z-10">
              <tr>
                <th className="px-5 py-4 font-medium">{t('products.cols.name')}</th>
                <th className="px-5 py-4 font-medium">{t('products.cols.category')}</th>
                <th className="px-5 py-4 font-medium text-right">{t('products.cols.price')}</th>
                <th className="px-5 py-4 font-medium text-center">{t('products.cols.stock')}</th>
                <th className="px-5 py-4 font-medium text-center">{t('products.cols.status')}</th>
                <th className="px-5 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className="border-t border-line/60 text-lg hover:bg-surface2/40">
                  <td className="px-5 py-3.5 font-semibold">
                    <div className="flex items-center gap-3">
                      {p.image ? (
                        <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover border border-line shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-surface2 border border-line shrink-0" />
                      )}
                      <span>{p.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-2 text-muted">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.category_color }} />
                      {p.category_name || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-display font-bold text-ember tnum">{money(p.price)}</td>
                  <td className="px-5 py-3.5 text-center"><StockBadge stock={p.stock} threshold={threshold} /></td>
                  <td className="px-5 py-3.5 text-center">
                    {p.active ? <span className="chip bg-mint/15 text-mint">{t('common.active')}</span> : <span className="chip bg-surface3 text-muted">{t('common.hidden')}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <button className="px-3 py-2 rounded-xl bg-surface2 border border-line mr-2 hover:bg-surface3" onClick={() => setEditing({ ...p, priceStr: String(p.price / 1000) })}>{t('common.edit')}</button>
                    <button className="px-3 py-2 rounded-xl bg-berry/80 text-white hover:bg-berry" onClick={() => deleteProduct(p)}>{t('common.delete')}</button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted">{t('products.noProducts')}</td></tr>
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
  const [imgError, setImgError] = useState('')
  const fileRef = useRef(null)
  const { t } = useT()
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const pickImage = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file later
    if (!file) return
    setImgError('')
    try {
      set('image', await fileToResizedDataUrl(file))
    } catch (err) {
      setImgError(err.message)
    }
  }

  return (
    <Modal title={product.id ? t('products.editProduct') : t('products.newProduct')} onClose={onClose} width={product.id ? 560 : 480}>
      <div className="flex gap-4">
        <div className="shrink-0">
          {form.image ? (
            <img src={form.image} alt="" className="w-20 h-20 rounded-2xl object-cover border border-line" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-surface2 border border-line flex items-center justify-center text-muted text-xs text-center px-1">
              {t('products.noImage')}
            </div>
          )}
        </div>
        <div className="flex-1 self-center">
          <span className="text-muted text-sm">{t('products.image')}</span>
          <div className="flex items-center gap-3 mt-1.5">
            <button className="btn-ghost py-2" onClick={() => fileRef.current?.click()}>{t('common.upload')}</button>
            {form.image && <button className="text-muted hover:text-berry text-sm" onClick={() => set('image', '')}>{t('common.remove')}</button>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
          </div>
          {imgError && <p className="text-berry text-xs mt-1.5">{imgError}</p>}
        </div>
      </div>

      <label className="block">
        <span className="text-muted text-sm">{t('products.name')}</span>
        <input className="input mt-1.5" value={form.name} autoFocus onChange={(e) => set('name', e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-muted text-sm">{t('products.price')}</span>
          <input className="input mt-1.5 tnum" inputMode="decimal" placeholder={t('products.pricePh')} value={form.priceStr} onChange={(e) => set('priceStr', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-muted text-sm">{t('products.stockOnHand')}</span>
          <input className="input mt-1.5 tnum" type="number" inputMode="numeric" value={form.stock ?? 0} onChange={(e) => set('stock', e.target.value)} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-muted text-sm">{t('products.category')}</span>
          <select className="input mt-1.5" value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-muted text-sm">{t('products.barcode')}</span>
          <input className="input mt-1.5 tnum" placeholder={t('products.scanOrType')} value={form.barcode || ''} onChange={(e) => set('barcode', e.target.value)} />
        </label>
      </div>
      <label className="flex items-center gap-3">
        <input type="checkbox" className="w-6 h-6 accent-[#EC9A45]" checked={!!form.active} onChange={(e) => set('active', e.target.checked ? 1 : 0)} />
        <span>{t('products.activeShown')}</span>
      </label>

      {product.id ? (
        <ModifierEditor productId={product.id} />
      ) : (
        <p className="text-muted text-xs">{t('products.saveFirst')}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button className="btn-ghost flex-1" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-accent flex-1" disabled={!form.name.trim()} onClick={() => onSave(form)}>{t('common.save')}</button>
      </div>
    </Modal>
  )
}

function ModifierEditor({ productId }) {
  const { confirm } = useDialog()
  const { t } = useT()
  const [groups, setGroups] = useState([])
  const [adding, setAdding] = useState(false)
  const [gName, setGName] = useState('')
  const [gRequired, setGRequired] = useState(false)
  const [gMulti, setGMulti] = useState(false)

  const load = () => api.products.modifiers(productId).then(setGroups)
  useEffect(() => {
    load()
  }, [productId])

  const addGroup = async () => {
    if (!gName.trim()) return
    await api.modifiers.createGroup({ product_id: productId, name: gName.trim(), required: gRequired, multi: gMulti })
    setGName('')
    setGRequired(false)
    setGMulti(false)
    setAdding(false)
    load()
  }
  const removeGroup = async (id) => {
    if (await confirm({ title: t('products.deleteGroupTitle'), message: t('products.deleteGroupMsg'), confirmText: t('common.delete'), danger: true })) {
      await api.modifiers.removeGroup(id)
      load()
    }
  }
  const addOption = async (groupId, name, priceStr) => {
    await api.modifiers.createOption({ group_id: groupId, name, price_delta: unitsToMillis(priceStr) })
    load()
  }
  const removeOption = async (id) => {
    await api.modifiers.removeOption(id)
    load()
  }

  return (
    <div className="rounded-2xl border border-line bg-surface2/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{t('products.options')}</span>
        {!adding && <button className="text-ember text-sm font-semibold" onClick={() => setAdding(true)}>{t('products.addGroup')}</button>}
      </div>

      {groups.length === 0 && !adding && <p className="text-muted text-sm">{t('products.noOptions')}</p>}

      {groups.map((g) => (
        <div key={g.id} className="rounded-xl bg-surface border border-line p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">
              {g.name}
              <span className="text-xs text-muted ml-2">{g.required ? t('common.required') + ' · ' : ''}{g.multi ? t('products.multiple') : t('products.pickOne')}</span>
            </span>
            <button className="text-muted hover:text-berry" onClick={() => removeGroup(g.id)}><IconTrash width={16} height={16} /></button>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {g.options.map((o) => (
              <span key={o.id} className="chip bg-surface3 text-cream">
                {o.name}{o.price_delta ? ` (+${money(o.price_delta)})` : ''}
                <button className="ml-1 text-muted hover:text-berry" onClick={() => removeOption(o.id)}>✕</button>
              </span>
            ))}
          </div>
          <OptionAdder onAdd={(name, price) => addOption(g.id, name, price)} />
        </div>
      ))}

      {adding && (
        <div className="rounded-xl bg-surface border border-line p-3 space-y-2">
          <input className="input py-2" placeholder={t('products.groupName')} value={gName} autoFocus onChange={(e) => setGName(e.target.value)} />
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-[#EC9A45]" checked={gRequired} onChange={(e) => setGRequired(e.target.checked)} /> {t('products.requiredOpt')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-[#EC9A45]" checked={gMulti} onChange={(e) => setGMulti(e.target.checked)} /> {t('products.allowMultiple')}</label>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1 py-2" onClick={() => setAdding(false)}>{t('common.cancel')}</button>
            <button className="btn-accent flex-1 py-2" disabled={!gName.trim()} onClick={addGroup}>{t('products.addGroupBtn')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function OptionAdder({ onAdd }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const { t } = useT()
  const submit = () => {
    if (!name.trim()) return
    onAdd(name.trim(), price)
    setName('')
    setPrice('')
  }
  return (
    <div className="flex gap-2">
      <input className="input py-2 flex-1" placeholder={t('products.optionName')} value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input py-2 w-28 tnum" placeholder={t('products.addPricePh')} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      <button className="btn-ghost py-2 px-4" disabled={!name.trim()} onClick={submit}>{t('common.add')}</button>
    </div>
  )
}

function CategoryModal({ category, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(category)
  const { t } = useT()
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <Modal title={category.id ? t('products.editCategory') : t('products.newCategory')} onClose={onClose}>
      <label className="block">
        <span className="text-muted text-sm">{t('products.name')}</span>
        <input className="input mt-1.5" value={form.name} autoFocus onChange={(e) => set('name', e.target.value)} />
      </label>
      <div>
        <span className="text-muted text-sm">{t('products.color')}</span>
        <div className="flex flex-wrap gap-2.5 mt-2">
          {COLORS.map((c) => (
            <button key={c} onClick={() => set('color', c)} style={{ backgroundColor: c }} className={`w-10 h-10 rounded-full transition ${form.color === c ? 'ring-2 ring-cream ring-offset-2 ring-offset-surface' : ''}`} />
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        {onDelete && <button className="btn-danger px-4" onClick={onDelete}><IconTrash width={20} height={20} /></button>}
        <button className="btn-ghost flex-1" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-accent flex-1" disabled={!form.name.trim()} onClick={() => onSave(form)}>{t('common.save')}</button>
      </div>
    </Modal>
  )
}
