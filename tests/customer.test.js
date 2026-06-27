// Tests for the customer-display snapshot builder: the pure mapping from an order
// + payment-in-progress to what the customer-facing screen shows. No Electron, no
// React — just the presentation math (which mirrors the cash-only change rule).
import { describe, test, expect } from 'vitest'
import { customerSnapshot, splitSnapshot } from '../src/shared/customer'

const BRANDING = { shopName: 'Café', logo: 'data:logo', language: 'fr' }

describe('customerSnapshot', () => {
  test('a cash payment in progress shows amount due and change', () => {
    const snap = customerSnapshot({
      phase: 'payment',
      branding: BRANDING,
      order: { total: 5000, payments: [] },
      typed: 8000,
      method: 'cash'
    })
    expect(snap).toMatchObject({ phase: 'payment', total: 5000, amountDue: 0, change: 3000, shopName: 'Café', language: 'fr' })
  })

  test('idle shows only branding, no amounts', () => {
    const snap = customerSnapshot({ phase: 'idle', branding: BRANDING })
    expect(snap).toEqual({ phase: 'idle', shopName: 'Café', logo: 'data:logo', language: 'fr' })
  })

  test('a partial payment shows the remaining amount due and no change', () => {
    const snap = customerSnapshot({ phase: 'payment', branding: BRANDING, order: { total: 5000, payments: [] }, typed: 2000, method: 'cash' })
    expect(snap).toMatchObject({ amountDue: 3000, change: 0 })
  })

  test('a card overpayment earns no change', () => {
    const snap = customerSnapshot({ phase: 'payment', branding: BRANDING, order: { total: 5000, payments: [] }, typed: 8000, method: 'card' })
    expect(snap).toMatchObject({ amountDue: 0, change: 0 })
  })

  test('already-recorded payments count toward the tender', () => {
    const snap = customerSnapshot({ phase: 'payment', branding: BRANDING, order: { total: 5000, payments: [{ method: 'cash', amount: 5000 }] } })
    expect(snap).toMatchObject({ amountDue: 0, change: 0 })
  })

  test('thanks shows the final total and change from recorded payments', () => {
    const snap = customerSnapshot({ phase: 'thanks', branding: BRANDING, order: { total: 5000, payments: [{ method: 'cash', amount: 8000 }] } })
    expect(snap).toMatchObject({ phase: 'thanks', total: 5000, change: 3000 })
  })
})

describe('splitSnapshot', () => {
  test('builds per-person rows with a settled flag and each person’s change', () => {
    const snap = splitSnapshot({
      branding: BRANDING,
      total: 50000,
      persons: [
        { method: 'cash', tendered: 20000, share: 10000 }, // settled, change 10000
        { method: 'cash', tendered: 30000, share: 40000 } //  short -> not settled
      ]
    })
    expect(snap).toMatchObject({ phase: 'split', total: 50000, shopName: 'Café', language: 'fr' })
    expect(snap.persons[0]).toMatchObject({ label: 1, share: 10000, tendered: 20000, change: 10000, settled: true })
    expect(snap.persons[1]).toMatchObject({ label: 2, share: 40000, tendered: 30000, change: 0, settled: false })
  })

  test('a card tender equal to the share is settled with no change', () => {
    const snap = splitSnapshot({ branding: BRANDING, total: 40000, persons: [{ method: 'card', tendered: 40000, share: 40000 }] })
    expect(snap.persons[0]).toMatchObject({ change: 0, settled: true })
  })
})
