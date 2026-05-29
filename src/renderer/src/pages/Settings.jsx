import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useSettings } from '../lib/settings'
import PageHeader from '../components/PageHeader'

// Local preview formatter (mirrors lib/settings money()).
function preview(form) {
  const decimals = Math.max(0, Math.min(3, parseInt(form.currency_decimals || '3', 10)))
  const num = (12500 / 1000).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const sym = form.currency_symbol || ''
  return form.currency_position === 'before' ? `${sym}${num}` : `${num} ${sym}`.trim()
}

export default function Settings() {
  const { settings, save } = useSettings()
  const [form, setForm] = useState(settings)
  const [printers, setPrinters] = useState([])
  const [savedAt, setSavedAt] = useState(0)
  const fileRef = useRef(null)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    api.printers.list().then(setPrinters).catch(() => setPrinters([]))
  }, [])

  const onSave = async () => {
    await save(form)
    setSavedAt(Date.now())
    setTimeout(() => setSavedAt(0), 2000)
  }

  const pickLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('logo', reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <div className="h-full flex flex-col p-7 overflow-hidden">
      <PageHeader title="Setup" subtitle="Shop, receipt, currency & printer">
        {savedAt > 0 && <span className="chip bg-mint/15 text-mint">Saved ✓</span>}
        <button className="btn-accent" onClick={onSave}>Save changes</button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-6 overflow-y-auto pr-1 pb-4">
        {/* Shop info */}
        <Section title="Shop information">
          <Field label="Shop name">
            <input className="input" value={form.shop_name} onChange={(e) => set('shop_name', e.target.value)} />
          </Field>
          <Field label="Address">
            <input className="input" value={form.shop_address} onChange={(e) => set('shop_address', e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className="input" value={form.shop_phone} onChange={(e) => set('shop_phone', e.target.value)} />
          </Field>
          <Field label="Logo (shown on receipt)">
            <div className="flex items-center gap-4">
              {form.logo ? (
                <img src={form.logo} alt="logo" className="w-16 h-16 object-contain rounded-xl bg-white p-1" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-surface2 border border-line flex items-center justify-center text-muted text-xs">none</div>
              )}
              <button className="btn-ghost py-2" onClick={() => fileRef.current?.click()}>Upload</button>
              {form.logo && <button className="text-muted hover:text-berry text-sm" onClick={() => set('logo', '')}>Remove</button>}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickLogo} />
            </div>
          </Field>
        </Section>

        {/* Receipt */}
        <Section title="Receipt">
          <Field label="Footer message">
            <input className="input" value={form.receipt_footer} onChange={(e) => set('receipt_footer', e.target.value)} />
          </Field>
          <Field label="Paper width">
            <div className="grid grid-cols-2 gap-2">
              {['58', '80'].map((w) => (
                <button key={w} onClick={() => set('paper_width', w)} className={btn(form.paper_width === w)}>{w} mm</button>
              ))}
            </div>
          </Field>
        </Section>

        {/* Security */}
        <Section title="Security">
          <Field label="Auto-lock after idle minutes (0 = never)">
            <input
              className="input tnum"
              type="number"
              min={0}
              value={form.auto_lock_minutes}
              onChange={(e) => set('auto_lock_minutes', e.target.value)}
            />
          </Field>
          <p className="text-muted text-sm">
            When set, the app signs the current user out after this many minutes with no activity, so an unattended terminal returns to the login screen.
          </p>
        </Section>

        {/* Stock */}
        <Section title="Stock">
          <Field label="Low-stock warning threshold">
            <input
              className="input tnum"
              type="number"
              min={0}
              value={form.low_stock_threshold}
              onChange={(e) => set('low_stock_threshold', e.target.value)}
            />
          </Field>
          <p className="text-muted text-sm">
            Products with stock at or below this number are flagged as low (amber) across the app; a badge on the Menu tab shows how many need restocking. Stock is reduced automatically when a sale is completed and restored if an order is cancelled.
          </p>
        </Section>

        {/* Currency */}
        <Section title="Currency">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol">
              <input className="input tnum" value={form.currency_symbol} onChange={(e) => set('currency_symbol', e.target.value)} />
            </Field>
            <Field label="Decimals">
              <select className="input" value={form.currency_decimals} onChange={(e) => set('currency_decimals', e.target.value)}>
                {[0, 1, 2, 3].map((d) => <option key={d} value={String(d)}>{d}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Symbol position">
            <div className="grid grid-cols-2 gap-2">
              {[['after', 'After (12.500 DT)'], ['before', 'Before ($12.50)']].map(([v, label]) => (
                <button key={v} onClick={() => set('currency_position', v)} className={btn(form.currency_position === v)}>{label}</button>
              ))}
            </div>
          </Field>
          <div className="rounded-2xl bg-surface2 border border-line p-4 text-center">
            <div className="text-muted text-xs">Preview</div>
            <div className="font-display text-3xl font-bold text-ember tnum mt-1">{preview(form)}</div>
          </div>
        </Section>

        {/* Printer */}
        <Section title="Printer">
          <Field label="Receipt printer">
            <select className="input" value={form.printer_name} onChange={(e) => set('printer_name', e.target.value)}>
              <option value="">System default / ask each time</option>
              {printers.map((p) => <option key={p.name} value={p.name}>{p.displayName}{p.isDefault ? ' (default)' : ''}</option>)}
            </select>
          </Field>
          <Field label="Printing mode">
            <div className="grid grid-cols-2 gap-2">
              {[['0', 'Show dialog'], ['1', 'Print silently']].map(([v, label]) => (
                <button key={v} onClick={() => set('print_silent', v)} className={btn(form.print_silent === v)}>{label}</button>
              ))}
            </div>
            <p className="text-muted text-xs mt-2">
              Silent printing sends straight to the selected printer (best for a thermal printer). "Show dialog" lets you choose a printer or print to PDF each time.
            </p>
          </Field>
        </Section>
      </div>
    </div>
  )
}

const btn = (active) =>
  `py-3 rounded-2xl font-semibold border transition ${active ? 'bg-ember text-[#2a1c0c] border-ember' : 'bg-surface2 border-line text-muted hover:text-cream'}`

function Section({ title, children }) {
  return (
    <div className="card p-6 space-y-4 h-fit">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-muted text-sm">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}
