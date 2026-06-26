import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useSettings, formatMoney } from '../lib/settings'
import { useLicense } from '../lib/license'
import { useT } from '../lib/i18n'
import { LANGUAGES } from '../lib/locales'
import { useDialog } from '../components/Dialog'
import PageHeader from '../components/PageHeader'

// Live preview of the sample amount under the form's (unsaved) currency settings.
function preview(form) {
  return formatMoney(12500, {
    symbol: form.currency_symbol,
    decimals: parseInt(form.currency_decimals || '3', 10),
    position: form.currency_position
  })
}

export default function Settings() {
  const { settings, save } = useSettings()
  const { t } = useT()
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
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')}>
        {savedAt > 0 && <span className="chip bg-mint/15 text-mint">{t('settings.saved')}</span>}
        <button className="btn-accent" onClick={onSave}>{t('settings.saveChanges')}</button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-6 overflow-y-auto pr-1 pb-4">
        <LicenseSection />

        {/* Language */}
        <Section title={t('settings.language')}>
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGES.map((l) => (
              <button key={l.code} onClick={() => set('language', l.code)} className={btn(form.language === l.code)}>
                {l.label}
              </button>
            ))}
          </div>
          <p className="text-muted text-sm">{t('settings.languageHint')}</p>
        </Section>
        <BackupSection />

        {/* Shop info */}
        <Section title={t('settings.shopInfo')}>
          <Field label={t('settings.shopName')}>
            <input className="input" value={form.shop_name} onChange={(e) => set('shop_name', e.target.value)} />
          </Field>
          <Field label={t('settings.address')}>
            <input className="input" value={form.shop_address} onChange={(e) => set('shop_address', e.target.value)} />
          </Field>
          <Field label={t('settings.phone')}>
            <input className="input" value={form.shop_phone} onChange={(e) => set('shop_phone', e.target.value)} />
          </Field>
          <Field label={t('settings.logo')}>
            <div className="flex items-center gap-4">
              {form.logo ? (
                <img src={form.logo} alt="logo" className="w-16 h-16 object-contain rounded-xl bg-white p-1" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-surface2 border border-line flex items-center justify-center text-muted text-xs">{t('common.none')}</div>
              )}
              <button className="btn-ghost py-2" onClick={() => fileRef.current?.click()}>{t('common.upload')}</button>
              {form.logo && <button className="text-muted hover:text-berry text-sm" onClick={() => set('logo', '')}>{t('common.remove')}</button>}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickLogo} />
            </div>
          </Field>
        </Section>

        {/* Receipt */}
        <Section title={t('settings.receipt')}>
          <Field label={t('settings.footer')}>
            <input className="input" value={form.receipt_footer} onChange={(e) => set('receipt_footer', e.target.value)} />
          </Field>
          <Field label={t('settings.paperWidth')}>
            <div className="grid grid-cols-2 gap-2">
              {['58', '80'].map((w) => (
                <button key={w} onClick={() => set('paper_width', w)} className={btn(form.paper_width === w)}>{t('settings.paperWidthMm', { w })}</button>
              ))}
            </div>
          </Field>
        </Section>

        {/* Security */}
        <Section title={t('settings.security')}>
          <Field label={t('settings.autoLock')}>
            <input
              className="input tnum"
              type="number"
              min={0}
              value={form.auto_lock_minutes}
              onChange={(e) => set('auto_lock_minutes', e.target.value)}
            />
          </Field>
          <p className="text-muted text-sm">{t('settings.autoLockHint')}</p>
        </Section>

        {/* Stock */}
        <Section title={t('settings.stock')}>
          <Field label={t('settings.lowStock')}>
            <input
              className="input tnum"
              type="number"
              min={0}
              value={form.low_stock_threshold}
              onChange={(e) => set('low_stock_threshold', e.target.value)}
            />
          </Field>
          <p className="text-muted text-sm">{t('settings.lowStockHint')}</p>
        </Section>

        {/* Currency */}
        <Section title={t('settings.currency')}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('settings.symbol')}>
              <input className="input tnum" value={form.currency_symbol} onChange={(e) => set('currency_symbol', e.target.value)} />
            </Field>
            <Field label={t('settings.decimals')}>
              <select className="input" value={form.currency_decimals} onChange={(e) => set('currency_decimals', e.target.value)}>
                {[0, 1, 2, 3].map((d) => <option key={d} value={String(d)}>{d}</option>)}
              </select>
            </Field>
          </div>
          <Field label={t('settings.symbolPos')}>
            <div className="grid grid-cols-2 gap-2">
              {[['after', t('settings.posAfter')], ['before', t('settings.posBefore')]].map(([v, label]) => (
                <button key={v} onClick={() => set('currency_position', v)} className={btn(form.currency_position === v)}>{label}</button>
              ))}
            </div>
          </Field>
          <div className="rounded-2xl bg-surface2 border border-line p-4 text-center">
            <div className="text-muted text-xs">{t('settings.preview')}</div>
            <div className="font-display text-3xl font-bold text-ember tnum mt-1">{preview(form)}</div>
          </div>
        </Section>

        {/* Printer */}
        <Section title={t('settings.printer')}>
          <Field label={t('settings.receiptPrinter')}>
            <select className="input" value={form.printer_name} onChange={(e) => set('printer_name', e.target.value)}>
              <option value="">{t('settings.printerDefault')}</option>
              {printers.map((p) => <option key={p.name} value={p.name}>{p.displayName}{p.isDefault ? t('settings.defaultSuffix') : ''}</option>)}
            </select>
          </Field>
          <Field label={t('settings.printingMode')}>
            <div className="grid grid-cols-2 gap-2">
              {[['0', t('settings.showDialog')], ['1', t('settings.printSilently')]].map(([v, label]) => (
                <button key={v} onClick={() => set('print_silent', v)} className={btn(form.print_silent === v)}>{label}</button>
              ))}
            </div>
            <p className="text-muted text-xs mt-2">{t('settings.printerHint')}</p>
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

function BackupSection() {
  const { status } = useLicense()
  const { confirm, alert } = useDialog()
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const licensed = status?.state === 'licensed'

  const doExport = async () => {
    setBusy(true)
    try {
      const res = await api.db.export()
      if (res?.ok) alert({ title: t('settings.backupSaved'), message: res.path })
    } catch (e) {
      alert({ title: t('settings.exportFailed'), message: e.message })
    } finally {
      setBusy(false)
    }
  }

  const doImport = async () => {
    const ok = await confirm({
      title: t('settings.importTitle'),
      message: t('settings.importMsg'),
      confirmText: t('settings.importConfirm'),
      cancelText: t('common.cancel'),
      danger: true
    })
    if (!ok) return
    setBusy(true)
    try {
      await api.db.import() // on success the app relaunches; cancel/error returns here
    } catch (e) {
      alert({ title: t('settings.importFailed'), message: e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title={t('settings.backup')}>
      {!licensed ? (
        <p className="text-muted text-sm">{t('settings.backupNeedLicense')}</p>
      ) : (
        <>
          <p className="text-muted text-sm">{t('settings.backupDesc')}</p>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-accent" disabled={busy} onClick={doExport}>{t('settings.exportBackup')}</button>
            <button className="btn-ghost" disabled={busy} onClick={doImport}>{t('settings.importBackup')}</button>
          </div>
        </>
      )}
    </Section>
  )
}

function LicenseSection() {
  const { status, activate } = useLicense()
  const { t } = useT()
  const [license, setLicense] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const apply = async () => {
    if (!license.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      await activate(license.trim())
      setLicense('')
      setMsg({ ok: true, text: t('settings.licenseActivated') })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setBusy(false)
    }
  }

  const labels = { licensed: t('settings.licLicensed'), trial: t('settings.licTrial'), unlicensed: t('settings.licUnlicensed'), expired: t('settings.licExpired') }
  const chip =
    status?.state === 'licensed' ? 'bg-mint/15 text-mint' : status?.state === 'trial' ? 'bg-ember/15 text-ember' : 'bg-berry/20 text-berry'

  return (
    <Section title={t('settings.license')}>
      <div className="flex items-center flex-wrap gap-2 text-sm">
        <span className={`chip ${chip}`}>{labels[status?.state] || '—'}</span>
        {status?.state === 'trial' && <span className="text-muted">{t('settings.daysLeft', { n: status.daysLeft })}</span>}
        {status?.name && <span className="text-muted">· {status.name}</span>}
        {status?.exp && <span className="text-muted">· {t('settings.expires', { date: new Date(status.exp).toLocaleDateString() })}</span>}
      </div>
      <Field label={t('settings.machineId')}>
        <div className="flex items-center gap-2">
          <code className="font-display tnum flex-1 break-all">{status?.machineId || '…'}</code>
          <button className="btn-ghost py-2 px-3" onClick={() => navigator.clipboard?.writeText(status?.machineId || '')}>{t('settings.copy')}</button>
        </div>
      </Field>
      <Field label={t('settings.enterLicense')}>
        <textarea
          className="input font-mono text-sm h-24 resize-none"
          value={license}
          placeholder={t('settings.pasteLicense')}
          onChange={(e) => setLicense(e.target.value)}
        />
      </Field>
      {msg && <p className={`text-sm ${msg.ok ? 'text-mint' : 'text-berry'}`}>{msg.text}</p>}
      <button className="btn-accent" disabled={!license.trim() || busy} onClick={apply}>
        {busy ? t('settings.activating') : t('settings.activateLicense')}
      </button>
    </Section>
  )
}
