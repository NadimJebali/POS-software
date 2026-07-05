// App-side licence policy applied after the shared crypto verify: machine binding and
// expiry against the monotonic clock. Pure, so it's tested directly with plain payloads
// (no keys, no electron). Fills the coverage the deleted contract-test copy used to give.
import { test, expect } from 'vitest'
import { applyLicencePolicy } from '../src/main/licence-policy'

test('accepts a payload bound to this machine and not expired', () => {
  expect(applyLicencePolicy({ machineId: 'M', exp: 100 }, 'M', 50)).toEqual({
    valid: true,
    payload: { machineId: 'M', exp: 100 }
  })
})

test('rejects a payload bound to a different machine', () => {
  const r = applyLicencePolicy({ machineId: 'OTHER', exp: 100 }, 'M', 50)
  expect(r.valid).toBe(false)
  expect(r.reason).toMatch(/different machine/)
})

test('rejects an expired payload against the monotonic clock', () => {
  const r = applyLicencePolicy({ machineId: 'M', exp: 100 }, 'M', 200)
  expect(r.valid).toBe(false)
  expect(r.reason).toMatch(/expired/)
})

test('treats a payload with no exp as non-expiring', () => {
  expect(applyLicencePolicy({ machineId: 'M' }, 'M', 999).valid).toBe(true)
})
