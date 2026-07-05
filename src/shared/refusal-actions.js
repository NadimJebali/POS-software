// Maps each server refusal code to the one UI affordance the app offers for it, derived
// from the shared REFUSAL vocabulary (src/shared/refusal-codes.js, vendored from the
// server). Keeps the app's response to every boundary refusal explicit and covered by a
// parity test — a new server code with no entry here trips the test rather than silently
// falling through.
//
//   'offer_rebind'   — the licence is bound to another machine; offer "move it here"
//   'transfer_limit' — the yearly transfer limit is spent; show the contact-vendor line
//   'show_message'   — surface the server's own message as-is
import { SERVER_REFUSALS } from './refusal-codes'

export const REFUSAL_ACTIONS = {
  machine_limit: 'offer_rebind',
  transfer_limit: 'transfer_limit',
  invalid_code: 'show_message',
  suspended: 'show_message',
  revoked: 'show_message',
  invalid_key: 'show_message',
  machine_mismatch: 'show_message',
  unbound: 'show_message',
  lapsed: 'show_message',
  bad_request: 'show_message',
  internal: 'show_message'
}

export function refusalAction(code) {
  return REFUSAL_ACTIONS[code] ?? 'show_message'
}

export { SERVER_REFUSALS }
