import { useEffect, useState } from 'react'
import { translate } from '../../../shared/i18n'
import { formatMoney } from '../../../shared/money'
import { locales } from '../lib/locales'
import { applyTheme } from '../lib/themes'

const THANKS_MS = 6000 // how long the thank-you lingers before returning to idle

// The customer-facing screen. It runs in its own window with a subscribe-only
// preload (window.posCustomer) — no app providers, no data access. Everything it
// shows arrives as presentation snapshots pushed from the main process.
export default function CustomerDisplay() {
  const [state, setState] = useState({ phase: 'idle' })

  useEffect(() => window.posCustomer?.onState(setState), [])

  // After the thank-you, fall back to idle branding on our own (the cashier has
  // already moved on), keeping the shop name/logo/currency from the last snapshot.
  useEffect(() => {
    if (state.phase !== 'thanks') return
    const id = setTimeout(
      () => setState((s) => ({ phase: 'idle', shopName: s.shopName, logo: s.logo, language: s.language, currency: s.currency })),
      THANKS_MS
    )
    return () => clearTimeout(id)
  }, [state.phase])

  const lang = locales[state.language] ? state.language : 'en'
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const t = (key, vars) => translate(locales, lang, key, vars)
  const fmt = (millis) => formatMoney(millis ?? 0, state.currency || { symbol: '', decimals: 3, position: 'after' })

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  useEffect(() => {
    applyTheme(state.theme)
  }, [state.theme])

  const shell = (children) => (
    <div dir={dir} className="h-screen w-screen bg-base text-cream flex flex-col items-center justify-center gap-10 p-16 select-none">
      {children}
    </div>
  )

  // ---------- Payment ----------
  if (state.phase === 'payment') {
    return shell(
      <>
        {state.shopName && <h2 className="font-display text-3xl text-muted">{state.shopName}</h2>}
        <div className="flex flex-col items-center gap-2">
          <span className="text-2xl text-muted">{t('customer.total')}</span>
          <span className="font-display text-6xl font-bold tnum">{fmt(state.total)}</span>
        </div>
        {state.amountDue > 0 ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl text-ember">{t('customer.amountDue')}</span>
            <span className="font-display text-8xl font-bold tnum text-ember">{fmt(state.amountDue)}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl text-mint">{t('customer.change')}</span>
            <span className="font-display text-8xl font-bold tnum text-mint">{fmt(state.change)}</span>
          </div>
        )}
      </>
    )
  }

  // ---------- Split in progress ----------
  if (state.phase === 'split') {
    return shell(
      <>
        {state.shopName && <h2 className="font-display text-3xl text-muted">{state.shopName}</h2>}
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl text-muted">{t('customer.total')}</span>
          <span className="font-display text-5xl font-bold tnum">{fmt(state.total)}</span>
        </div>
        <div className="w-full max-w-3xl flex flex-col gap-3">
          {(state.persons || []).map((p) => (
            <div
              key={p.label}
              className={`flex items-center justify-between rounded-2xl border px-6 py-4 text-2xl ${
                p.settled ? 'bg-mint/10 border-mint/40' : 'bg-white/5 border-white/10'
              }`}
            >
              <span className="flex items-center gap-3">
                {p.settled && <span className="text-mint text-3xl">✓</span>}
                {t('customer.person', { n: p.label })}
              </span>
              <span className="flex items-baseline gap-4 tnum">
                <span>{fmt(p.share)}</span>
                {p.settled && p.change > 0 && <span className="text-mint text-xl">{t('customer.change')} {fmt(p.change)}</span>}
              </span>
            </div>
          ))}
        </div>
      </>
    )
  }

  // ---------- Thank you ----------
  if (state.phase === 'thanks') {
    return shell(
      <>
        <div className="w-28 h-28 rounded-full bg-mint/15 flex items-center justify-center">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#54D6A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 className="font-display text-6xl font-bold">{t('customer.thankYou')}</h1>
        {state.change > 0 && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl text-mint">{t('customer.change')}</span>
            <span className="font-display text-7xl font-bold tnum text-mint">{fmt(state.change)}</span>
          </div>
        )}
      </>
    )
  }

  // ---------- Idle branding ----------
  return shell(
    <>
      {state.logo && <img src={state.logo} alt="" className="max-h-52 max-w-[55%] object-contain" />}
      {state.shopName && <h1 className="font-display text-7xl font-bold text-center">{state.shopName}</h1>}
      <p className="text-4xl text-muted">{t('customer.welcome')}</p>
    </>
  )
}
