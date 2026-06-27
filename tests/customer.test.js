// Tests for the customer-display snapshot builder: the pure mapping from an order
// + payment-in-progress to what the customer-facing screen shows. No Electron, no
// React — just the presentation math (which mirrors the cash-only change rule).
import { describe, test, expect } from 'vitest'
import { customerSnapshot } from '../src/shared/customer'

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
