// Pure derivation of the two license banners from a status object. No I/O, no clock
// of its own — `now` is passed in — so every threshold comes from the signed payload
// fields (exp, warnDays, graceUntil) surfaced on the status.
import { describe, test, expect } from 'vitest'
import { deriveBanner } from '../src/shared/license-banner'

const DAY = 86400000
const now = Date.UTC(2026, 0, 1)

describe('deriveBanner', () => {
  test('shows the grace banner whenever the payload carries graceUntil', () => {
    const status = { state: 'licensed', exp: now + 30 * DAY, warnDays: 7, graceUntil: now + 5 * DAY }
    expect(deriveBanner(status, now)).toEqual({ kind: 'grace', until: now + 5 * DAY })
  })

  test('warns when exp falls within the payload warn window, carrying the expiry date', () => {
    const status = { state: 'licensed', exp: now + 3 * DAY, warnDays: 7, graceUntil: null }
    expect(deriveBanner(status, now)).toEqual({ kind: 'warning', until: now + 3 * DAY })
  })

  test('is silent when exp is comfortably beyond the warn window', () => {
    const status = { state: 'licensed', exp: now + 20 * DAY, warnDays: 7, graceUntil: null }
    expect(deriveBanner(status, now)).toEqual({ kind: 'none' })
  })

  test('grace takes precedence over a near expiry', () => {
    const status = { state: 'licensed', exp: now + 2 * DAY, warnDays: 7, graceUntil: now + 4 * DAY }
    expect(deriveBanner(status, now)).toEqual({ kind: 'grace', until: now + 4 * DAY })
  })

  test('shows nothing for trial, expired, or missing status', () => {
    expect(deriveBanner({ state: 'trial', daysLeft: 3 }, now)).toEqual({ kind: 'none' })
    expect(deriveBanner({ state: 'expired', exp: now - DAY }, now)).toEqual({ kind: 'none' })
    expect(deriveBanner(null, now)).toEqual({ kind: 'none' })
  })
})
