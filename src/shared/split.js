// Shared math for a by-item bill split, in integer millimes. Used by both the
// renderer (live per-person preview during checkout) and the Order domain (the
// authoritative settle), so what the cashier sees always matches what is recorded.

/**
 * Apportion `total` across people in proportion to their pre-discount subtotals.
 * `gross` is the sum of the subtotals (the order's pre-discount subtotal); when it
 * differs from `total` an order discount is being spread across the people.
 */
export function splitShares(preSubtotals, gross, total) {
  if (gross <= 0) return preSubtotals.map(() => 0)
  const shares = preSubtotals.map((sub) => Math.round((sub * total) / gross))
  // Push any rounding drift onto the largest share (ties -> first) so the shares
  // sum to `total` exactly — nobody is over- or under-charged by a millime.
  const drift = total - shares.reduce((s, x) => s + x, 0)
  if (drift !== 0 && shares.length) {
    let largest = 0
    for (let i = 1; i < preSubtotals.length; i++) if (preSubtotals[i] > preSubtotals[largest]) largest = i
    shares[largest] += drift
  }
  return shares
}

/**
 * Evaluate one person's tender against their share. Change only ever comes from
 * cash; a card payment must be exact. Returns `{ ok: true, change }` when valid,
 * or `{ ok: false, reason }` ('cash-short' | 'card-mismatch') so each caller can
 * present it its own way — the domain throws, the UI just disables Complete.
 */
export function evaluateTender(method, tendered, share) {
  if (method === 'cash') {
    return tendered < share ? { ok: false, reason: 'cash-short' } : { ok: true, change: tendered - share }
  }
  return tendered !== share ? { ok: false, reason: 'card-mismatch' } : { ok: true, change: 0 }
}
