import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { money, unitsToMillis, currencyDecimals, useSettings } from '../lib/settings'
import { parseSettings } from '../../../shared/settings'
import { splitShares, evaluateTender } from '../../../shared/split'
import { splitSnapshot, customerSnapshot } from '../../../shared/customer'
import { useT } from '../lib/i18n'
import NumberPad from '../components/NumberPad'
import { useDialog } from '../components/Dialog'
import { IconBack } from '../components/icons'

const MAX_PEOPLE = 6
const blankPerson = () => ({ alloc: {}, method: 'cash', tenderStr: '' })

export default function Split() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { alert } = useDialog()
  const { t } = useT()
  const { settings } = useSettings()

  const [order, setOrder] = useState(null)
  const [people, setPeople] = useState([blankPerson(), blankPerson()])
  const [sel, setSel] = useState(0)
  const [busy, setBusy] = useState(false)
  const [paid, setPaid] = useState(null)

  const branding = { shopName: settings.shop_name, logo: settings.logo, language: settings.language, currency: parseSettings(settings).currency, theme: settings.theme }
  const brandingRef = useRef(branding)
  useEffect(() => {
    brandingRef.current = branding
  })

  useEffect(() => {
    api.orders.get(Number(orderId)).then(setOrder)
  }, [orderId])

  // Mirror the split-in-progress to the customer display (per-person rows); reset
  // it to idle on leave. The 'thanks' screen is pushed on completion.
  useEffect(() => {
    if (!order || paid) return
    const priceById = Object.fromEntries(order.items.map((i) => [i.id, i.unit_price]))
    const preSubtotals = people.map((p) => Object.entries(p.alloc).reduce((s, [id, q]) => s + (priceById[id] || 0) * q, 0))
    const shares = splitShares(preSubtotals, order.subtotal, order.total)
    const persons = people
      .map((p, i) => ({ method: p.method, tendered: p.method === 'card' ? shares[i] : unitsToMillis(p.tenderStr), share: shares[i] }))
      .filter((_, i) => preSubtotals[i] > 0)
    api.customer.present(splitSnapshot({ branding: brandingRef.current, total: order.total, persons }))
  }, [order, people, paid])

  useEffect(() => () => api.customer.present(customerSnapshot({ phase: 'idle', branding: brandingRef.current })), [])

  if (!order) return <div className="p-8 text-muted">{t('common.loading')}</div>

  const dec = currencyDecimals()
  const lineById = Object.fromEntries(order.items.map((i) => [i.id, i]))
  const assignedOf = (itemId) => people.reduce((s, p) => s + (p.alloc[itemId] || 0), 0)
  const unassignedOf = (item) => item.qty - assignedOf(item.id)
  const unassignedTotal = order.items.reduce((s, it) => s + unassignedOf(it), 0)

  // Per-person pre-discount subtotal -> discounted share (same math the domain uses).
  const preSubtotals = people.map((p) =>
    Object.entries(p.alloc).reduce((s, [itemId, qty]) => s + (lineById[itemId]?.unit_price || 0) * qty, 0)
  )
  const shares = splitShares(preSubtotals, order.subtotal, order.total)
  // A card pays the exact share (nothing to type); cash uses the entered amount.
  const tenderOf = (p, i) => (p.method === 'card' ? shares[i] : unitsToMillis(p.tenderStr))
  const evals = people.map((p, i) => evaluateTender(p.method, tenderOf(p, i), shares[i]))

  // People with at least one item are the ones who actually pay.
  const payers = people.map((_, i) => i).filter((i) => preSubtotals[i] > 0)
  const canComplete = unassignedTotal === 0 && payers.length > 0 && payers.every((i) => evals[i].ok)
  const totalChange = payers.reduce((s, i) => s + (evals[i].ok ? evals[i].change : 0), 0)

  const patchSel = (patch) => setPeople((ps) => ps.map((p, i) => (i === sel ? { ...p, ...patch } : p)))

  const assignOne = (item) => {
    if (unassignedOf(item) <= 0) return
    setPeople((ps) => ps.map((p, i) => (i === sel ? { ...p, alloc: { ...p.alloc, [item.id]: (p.alloc[item.id] || 0) + 1 } } : p)))
  }
  const unassignOne = (item) => {
    setPeople((ps) =>
      ps.map((p, i) => {
        if (i !== sel) return p
        const cur = p.alloc[item.id] || 0
        if (cur <= 0) return p
        const alloc = { ...p.alloc }
        if (cur - 1 === 0) delete alloc[item.id]
        else alloc[item.id] = cur - 1
        return { ...p, alloc }
      })
    )
  }

  const addPerson = () => setPeople((ps) => (ps.length >= MAX_PEOPLE ? ps : [...ps, blankPerson()]))
  const removePerson = () => {
    if (people.length <= 2) return
    setPeople((ps) => ps.filter((_, i) => i !== sel))
    setSel((s) => Math.max(0, s - 1))
  }
  const setExact = () => patchSel({ tenderStr: (shares[sel] / 1000).toFixed(dec) })

  const complete = async () => {
    setBusy(true)
    try {
      const groups = payers.map((i) => ({
        method: people[i].method,
        tendered: tenderOf(people[i], i),
        items: Object.entries(people[i].alloc).map(([itemId, qty]) => ({ itemId: Number(itemId), qty }))
      }))
      const result = await api.orders.completeSplit(order.id, groups)
      setPaid(result)
      api.customer.present(customerSnapshot({ phase: 'thanks', branding: brandingRef.current, order: result }))
    } catch (e) {
      alert({ title: t('checkout.cannotComplete'), message: e.message })
    } finally {
      setBusy(false)
    }
  }

  // ---------- Done confirmation ----------
  if (paid) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-20 h-20 rounded-full bg-mint/15 flex items-center justify-center animate-pop">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#54D6A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 className="font-display text-4xl font-bold animate-rise">{t('split.splitComplete')}</h1>
        <div className="card p-8 w-[440px] space-y-3 text-lg animate-rise">
          {paid.payments.map((p, i) => (
            <div key={p.id} className="flex justify-between items-baseline">
              <span className="text-muted">{t('split.person', { n: i + 1 })} · {p.method === 'card' ? t('split.card') : t('split.cash')}</span>
              <span className="tnum font-semibold">
                {money(p.amount - p.change)}{p.change > 0 && <span className="text-mint"> · {t('split.change')} {money(p.change)}</span>}
              </span>
            </div>
          ))}
          <div className="h-px bg-line my-1" />
          <div className="flex justify-between items-baseline">
            <span>{t('split.totalChange')}</span>
            <span className="font-display text-3xl font-bold text-mint tnum">{money(paid.change_due)}</span>
          </div>
        </div>
        <button className="btn-accent" onClick={() => navigate('/')}>{t('split.done')}</button>
      </div>
    )
  }

  const cur = people[sel]
  const curShare = shares[sel]
  const curEval = evals[sel]

  // ---------- Split entry ----------
  return (
    <div className="h-screen flex">
      {/* assignment side */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <button className="btn-ghost px-3.5 py-3" onClick={() => navigate(`/checkout/${order.id}`)}>
            <IconBack width={22} height={22} />
          </button>
          <h1 className="font-display text-3xl font-bold">
            {order.table_label ? t('split.titleTable', { label: order.table_label }) : t('split.title')}
          </h1>
        </div>

        {/* people tabs */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {people.map((p, i) => (
            <button
              key={i}
              onClick={() => setSel(i)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition flex items-center gap-2 ${
                i === sel ? 'bg-ember text-[#2a1c0c] border-ember' : 'bg-surface2 border-line text-muted hover:text-cream'
              }`}
            >
              <span>{t('split.person', { n: i + 1 })}</span>
              <span className="tnum opacity-80">{money(shares[i])}</span>
              {preSubtotals[i] > 0 && evals[i].ok && <span className="text-mint">✓</span>}
            </button>
          ))}
          <button onClick={addPerson} disabled={people.length >= MAX_PEOPLE} className="px-3 py-2 rounded-xl text-sm font-semibold bg-surface2 border border-line text-muted hover:text-cream disabled:opacity-40">
            + {t('split.addPerson')}
          </button>
          {people.length > 2 && (
            <button onClick={removePerson} className="px-3 py-2 rounded-xl text-sm font-semibold bg-surface2 border border-line text-muted hover:text-berry">
              − {t('split.remove')}
            </button>
          )}
        </div>

        <div className="text-sm mb-2">
          {unassignedTotal > 0 ? (
            <span className="text-ember">{t('split.unassigned', { n: unassignedTotal })}</span>
          ) : (
            <span className="text-mint">{t('split.allAssigned')}</span>
          )}
          <span className="text-muted ms-3">{t('split.hint')}</span>
        </div>

        {/* item list */}
        <div className="card flex-1 overflow-y-auto p-3 divide-y divide-line/60">
          {order.items.length === 0 && <div className="p-6 text-muted">{t('split.none')}</div>}
          {order.items.map((it) => {
            const mine = cur.alloc[it.id] || 0
            const left = unassignedOf(it)
            return (
              <div key={it.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="min-w-0">
                  <div className="text-lg text-cream truncate">
                    <span className="text-muted tnum me-2">{it.qty}×</span>
                    {it.name}
                  </div>
                  <div className="text-sm text-muted tnum">
                    {money(it.unit_price)} · {left > 0 ? t('split.unassigned', { n: left }) : t('split.allAssigned')}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => unassignOne(it)} disabled={mine <= 0} className="w-11 h-11 rounded-xl bg-surface2 border border-line text-2xl font-display active:scale-95 disabled:opacity-30">−</button>
                  <span className="w-8 text-center tnum font-display text-2xl">{mine}</span>
                  <button onClick={() => assignOne(it)} disabled={left <= 0} className="w-11 h-11 rounded-xl bg-surface3 text-cream text-2xl font-display active:scale-95 disabled:opacity-30">+</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* selected person's payment */}
      <div className="w-[460px] shrink-0 bg-surface/80 border-s border-line backdrop-blur-md flex flex-col p-6 gap-3 overflow-y-auto">
        <div className="text-muted text-sm">{t('split.person', { n: sel + 1 })}</div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface2 border border-line p-3 text-center">
            <div className="text-muted text-xs">{t('split.share')}</div>
            <div className="font-display text-2xl font-bold tnum text-ember">{money(curShare)}</div>
          </div>
          {curEval.ok ? (
            <div className="rounded-2xl bg-mint/15 border border-mint/40 p-3 text-center">
              <div className="text-mint/80 text-xs">{t('split.change')}</div>
              <div className="font-display text-2xl font-bold tnum text-mint">{money(curEval.change)}</div>
            </div>
          ) : (
            <div className="rounded-2xl bg-surface2 border border-line p-3 text-center">
              <div className="text-muted text-xs">{t('split.short')}</div>
              <div className="font-display text-2xl font-bold tnum text-berry">
                {money(Math.max(0, curShare - unitsToMillis(cur.tenderStr)))}
              </div>
            </div>
          )}
        </div>

        {/* method toggle */}
        <div className="grid grid-cols-2 gap-2">
          {['cash', 'card'].map((m) => (
            <button
              key={m}
              onClick={() => patchSel({ method: m })}
              className={`py-2.5 rounded-xl font-semibold border transition ${
                cur.method === m ? 'bg-ember text-[#2a1c0c] border-ember' : 'bg-surface2 border-line text-muted'
              }`}
            >
              {t('split.' + m)}
            </button>
          ))}
        </div>

        {/* tender display */}
        <div className="rounded-2xl bg-surface2 border border-line px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-muted text-xs">{t('split.tendered')}</div>
            <div className="font-display text-3xl font-bold tnum">
              {cur.method === 'card' ? (curShare / 1000).toFixed(dec) : cur.tenderStr || '0'}
            </div>
          </div>
          {cur.method === 'cash' && (
            <button onClick={setExact} className="py-2.5 px-4 rounded-xl bg-surface3 text-cream text-sm font-semibold active:scale-95">
              {t('split.exact')}
            </button>
          )}
        </div>

        {cur.method === 'cash' ? (
          <NumberPad value={cur.tenderStr} onChange={(v) => patchSel({ tenderStr: v })} />
        ) : (
          <div className="rounded-2xl bg-surface2/60 border border-line p-6 text-center text-muted">
            {t('split.card')} · <span className="tnum text-cream">{money(curShare)}</span>
          </div>
        )}

        <button
          className={`text-2xl py-4 ${canComplete ? 'btn-green' : 'btn-ghost'}`}
          disabled={!canComplete || busy}
          onClick={complete}
        >
          {busy
            ? t('split.processing')
            : unassignedTotal > 0
              ? t('split.assignAll')
              : totalChange > 0
                ? t('split.completeReturn', { amount: money(totalChange) })
                : t('split.complete')}
        </button>
      </div>
    </div>
  )
}
