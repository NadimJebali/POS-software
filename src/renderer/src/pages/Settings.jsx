import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useSettings, formatMoney } from '../lib/settings'
import { useLicense } from '../lib/license'
import { useT } from '../lib/i18n'
import { LANGUAGES } from '../lib/locales'
import { THEMES, applyTheme } from '../lib/themes'
import { useDialog } from '../components/Dialog'
import PageHeader from '../components/PageHeader'
import { refusalAction } from '../../../shared/refusal-actions'

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
  const [displays, setDisplays] = useState([])
  const [savedAt, setSavedAt] = useState(0)
  const fileRef = useRef(null)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    api.printers.list().then(setPrinters).catch(() => setPrinters([]))
    api.displays.list().then(setDisplays).catch(() => setDisplays([]))
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

        {/* Display */}
        <Section title={t('settings.display')}>
          <Field label={t('settings.theme')}>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  onClick={() => {
                    set('theme', th.id)
                    applyTheme(th.id) // live preview; persisted on Save
                  }}
                  className={`flex flex-col items-center gap-2.5 py-3.5 rounded-2xl border transition ${
                    form.theme === th.id ? 'border-ember ring-2 ring-ember/40 bg-surface2' : 'border-line bg-surface2 hover:bg-surface3'
                  }`}
                >
                  <span className="flex gap-1.5">
                    {th.swatches.map((c) => (
                      <span key={c} className="w-5 h-5 rounded-full border border-black/20" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="text-sm font-semibold text-cream">{th.label}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('settings.fullscreen')}>
            <div className="grid grid-cols-2 gap-2">
              {[['0', t('settings.windowed')], ['1', t('settings.fullscreen')]].map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => {
                    set('fullscreen', v)
                    api.window.setFullscreen(v === '1') // apply live; also persisted on Save
                  }}
                  className={btn(form.fullscreen === v)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-muted text-sm mt-2">{t('settings.fullscreenHint')}</p>
          </Field>

          <Field label={t('settings.custDisplay')}>
            <div className="grid grid-cols-2 gap-2">
              {[['0', t('settings.off')], ['1', t('settings.on')]].map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => {
                    set('customer_display', v)
                    api.customer.enable(v === '1', form.customer_display_monitor || '')
                  }}
                  className={btn(form.customer_display === v)}
                >
                  {label}
                </button>
              ))}
            </div>
            {form.customer_display === '1' && displays.length > 1 && (
              <select
                className="input mt-2"
                value={form.customer_display_monitor || ''}
                onChange={(e) => {
                  set('customer_display_monitor', e.target.value)
                  api.customer.enable(true, e.target.value)
                }}
              >
                <option value="">{t('settings.monitor')}: {t('common.none')}</option>
                {displays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {t('settings.monitor')} {d.label}{d.primary ? t('settings.defaultSuffix') : ''}
                  </option>
                ))}
              </select>
            )}
            <p className="text-muted text-sm mt-2">{t('settings.custDisplayHint')}</p>
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
  const { status, activateByCode, rebindByCode } = useLicense()
  const { t } = useT()
  const [code, setCode] = useState('')
  const [boundElsewhere, setBoundElsewhere] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState('')

  useEffect(() => {
    api.app.version().then(setVersion).catch(() => {})
  }, [])

  // Activate (or move) this machine with a short code — same online flow as the
  // Activate screen. A raw signed key is never pasted here; the server issues keys.
  const activate = async () => {
    if (!code.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await activateByCode(code.trim())
      if (res.ok) {
        setCode('')
        setMsg({ ok: true, text: t('settings.licenseActivated') })
      } else if (refusalAction(res.code) === 'offer_rebind') {
        setBoundElsewhere(true) // already active elsewhere → offer to move it here
      } else {
        setMsg({ ok: false, text: res.message })
      }
    } finally {
      setBusy(false)
    }
  }

  const move = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await rebindByCode(code.trim())
      setBoundElsewhere(false)
      if (res.ok) {
        setCode('')
        setMsg({ ok: true, text: t('settings.licenseActivated') })
      } else {
        setMsg({ ok: false, text: refusalAction(res.code) === 'transfer_limit' ? t('license.transferLimit') : res.message })
      }
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
        {version && <span className="text-muted">· {t('settings.appVersion', { v: version })}</span>}
      </div>
      <Field label={t('settings.machineId')}>
        <div className="flex items-center gap-2">
          <code className="font-display tnum flex-1 break-all">{status?.machineId || '…'}</code>
          <button className="btn-ghost py-2 px-3" onClick={() => navigator.clipboard?.writeText(status?.machineId || '')}>{t('settings.copy')}</button>
        </div>
      </Field>
      <Field label={t('settings.enterCode')}>
        <input
          className="input font-display text-lg tracking-[0.15em] uppercase"
          value={code}
          placeholder="POSK-XXXX-XXXX-XXXX"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && !boundElsewhere && activate()}
        />
      </Field>
      {msg && <p className={`text-sm ${msg.ok ? 'text-mint' : 'text-berry'}`}>{msg.text}</p>}
      {boundElsewhere ? (
        <div className="rounded-2xl bg-ember/10 border border-ember/30 p-4">
          <p className="font-semibold text-ember">{t('license.moveTitle')}</p>
          <p className="text-muted text-sm mt-1">{t('license.movePrompt')}</p>
          <div className="flex gap-2 mt-3">
            <button className="btn-ghost min-h-[44px]" disabled={busy} onClick={() => setBoundElsewhere(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn-accent min-h-[44px]" disabled={busy} onClick={move}>
              {busy ? t('license.moving') : t('license.moveConfirm')}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-accent" disabled={!code.trim() || busy} onClick={activate}>
          {busy ? t('settings.activating') : t('settings.activateLicense')}
        </button>
      )}
    </Section>
  )
}
