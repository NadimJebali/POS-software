import { useEffect, useState } from 'react'
import { translate } from '../../../shared/i18n'
import { locales } from '../lib/locales'

// The customer-facing screen. It runs in its own window with a subscribe-only
// preload (window.posCustomer) — no app providers, no data access. Everything it
// shows arrives as presentation snapshots pushed from the main process.
export default function CustomerDisplay() {
  const [state, setState] = useState({ phase: 'idle' })

  useEffect(() => window.posCustomer?.onState(setState), [])

  const lang = locales[state.language] ? state.language : 'en'
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const t = (key, vars) => translate(locales, lang, key, vars)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  // Idle: shop branding + welcome. (Payment phases arrive in a later slice.)
  return (
    <div dir={dir} className="h-screen w-screen bg-[#0f172a] text-cream flex flex-col items-center justify-center gap-10 p-16 select-none">
      {state.logo && <img src={state.logo} alt="" className="max-h-52 max-w-[55%] object-contain" />}
      {state.shopName && <h1 className="font-display text-7xl font-bold text-center">{state.shopName}</h1>}
      <p className="text-4xl text-muted">{t('customer.welcome')}</p>
    </div>
  )
}
