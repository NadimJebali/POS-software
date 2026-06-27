// Builds the presentation snapshot pushed to the customer-facing display. Pure, so
// it can be unit-tested without Electron and reused by the cashier's live updates.
// Money is integer millimes; change comes only from cash, mirroring orders.complete.

import { evaluateTender } from './split'

const sum = (rows, pred = () => true) => rows.filter(pred).reduce((s, p) => s + p.amount, 0)

/**
 * @param phase    'idle' | 'payment' | 'thanks'
 * @param branding { shopName, logo, language } — shown in every phase
 * @param order    { total, payments } — current order (payments already recorded)
 * @param typed    millimes the cashier is entering but hasn't recorded yet
 * @param method   'cash' | 'card' for the typed amount
 */
export function customerSnapshot({ phase, branding = {}, order, typed = 0, method = 'cash' }) {
  const base = { phase, shopName: branding.shopName, logo: branding.logo, language: branding.language, currency: branding.currency }
  if (phase === 'idle' || !order) return base

  const payments = order.payments || []
  const tendered = sum(payments) + typed
  const cash = sum(payments, (p) => p.method === 'cash') + (method === 'cash' ? typed : 0)
  const change = Math.max(0, Math.min(tendered - order.total, cash))
  const amountDue = Math.max(0, order.total - tendered)
  return { ...base, total: order.total, amountDue, change }
}

/**
 * Snapshot for a by-item split in progress: one row per person with their share,
 * tender, change and whether they're settled (the same cash/card rule as the
 * domain, via evaluateTender). `persons` = [{ method, tendered, share }].
 */
export function splitSnapshot({ branding = {}, total, persons = [] }) {
  return {
    phase: 'split',
    shopName: branding.shopName,
    logo: branding.logo,
    language: branding.language,
    currency: branding.currency,
    total,
    persons: persons.map((p, i) => {
      const ev = evaluateTender(p.method, p.tendered, p.share)
      return { label: i + 1, share: p.share, tendered: p.tendered, change: ev.ok ? ev.change : 0, settled: ev.ok }
    })
  }
}
