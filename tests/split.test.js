// Tests for the shared split module: the pure math behind a by-item bill split.
// Both the renderer (live preview) and the Order domain (authoritative settle)
// use these, so the cashier's on-screen shares always match what gets recorded.
import { describe, test, expect } from 'vitest'
import { splitShares, evaluateTender } from '../src/shared/split'

describe('splitShares — apportion a (possibly discounted) total', () => {
  test('with no discount, each share is just its pre-discount subtotal', () => {
    expect(splitShares([10000, 40000], 50000, 50000)).toEqual([10000, 40000])
  })

  test('spreads a discount proportionally to each subtotal', () => {
    // 10% off a 50.000 bill -> 45.000, split 10/40 -> 9/36
    expect(splitShares([10000, 40000], 50000, 45000)).toEqual([9000, 36000])
  })

  test('puts the rounding remainder on the largest share so shares sum to the total', () => {
    // 3 equal 1.000 subtotals, 2.000 total: 667 each rounds to 2.001; -1 lands on
    // the first (largest, tie-broken to first) -> 666.
    const shares = splitShares([1000, 1000, 1000], 3000, 2000)
    expect(shares).toEqual([666, 667, 667])
    expect(shares.reduce((s, x) => s + x, 0)).toBe(2000)
  })

  test('apportions nothing when there is no gross subtotal', () => {
    expect(splitShares([0, 0], 0, 0)).toEqual([0, 0])
  })
})

describe('evaluateTender — the per-person cash/card rule', () => {
  test('cash that covers the share is ok and returns change', () => {
    expect(evaluateTender('cash', 20000, 10000)).toEqual({ ok: true, change: 10000 })
  })

  test('cash below the share is rejected', () => {
    expect(evaluateTender('cash', 9000, 10000)).toEqual({ ok: false, reason: 'cash-short' })
  })

  test('card equal to the share is ok with no change', () => {
    expect(evaluateTender('card', 10000, 10000)).toEqual({ ok: true, change: 0 })
  })

  test('card not equal to the share is rejected', () => {
    expect(evaluateTender('card', 12000, 10000)).toEqual({ ok: false, reason: 'card-mismatch' })
  })
})
