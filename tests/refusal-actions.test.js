// Client-side refusal-code parity (#27). The app maps every server refusal code to the
// one UI affordance it offers for it, derived from the shared REFUSAL vocabulary. If the
// server gains a code the app doesn't classify, this fails (table ⊆ handled) instead of
// the app silently defaulting; if the app keeps an action for a code the server can never
// send, that's caught too (handled ⊆ table) — a dead branch.
import { test, expect } from 'vitest'
import { SERVER_REFUSALS } from '../src/shared/refusal-codes'
import { REFUSAL_ACTIONS, refusalAction } from '../src/shared/refusal-actions'

test('the app defines an action for every server refusal code (table ⊆ handled)', () => {
  for (const code of SERVER_REFUSALS) {
    expect(REFUSAL_ACTIONS[code], `no UI action mapped for server refusal '${code}'`).toBeDefined()
  }
})

test('the app maps no action for a code the server never sends (handled ⊆ table)', () => {
  for (const code of Object.keys(REFUSAL_ACTIONS)) {
    expect(SERVER_REFUSALS, `stale action for non-server code '${code}'`).toContain(code)
  }
})

test('unknown codes fall back to just showing the message', () => {
  expect(refusalAction('something_new')).toBe('show_message')
})

test('a licence bound to another machine offers a rebind', () => {
  expect(refusalAction('machine_limit')).toBe('offer_rebind')
})
