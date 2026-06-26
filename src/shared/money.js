// Pure currency helpers shared by the renderer and the main process.
// Money is stored everywhere as integer "millimes" (price * 1000); callers supply
// the currency config (symbol, decimals, position) — this module never reads it.

/**
 * Format integer millimes as a display string.
 * @param {number} millis - amount in millimes (price * 1000); nullish counts as 0
 * @param {{symbol?: string, decimals?: number, position?: 'before'|'after'}} cfg
 */
export function formatMoney(millis, { symbol = '', decimals = 3, position = 'after' } = {}) {
  const dp = Math.max(0, Math.min(3, Number.isFinite(decimals) ? decimals : 3))
  const sign = millis < 0 ? '-' : ''
  const value = Math.abs(Math.round(millis || 0)) / 1000
  const num = value.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
  return position === 'before' ? `${sign}${symbol}${num}` : `${sign}${num} ${symbol}`.trim()
}

// A units string the user types ("12.5", "12,500") -> integer millimes.
export function unitsToMillis(input) {
  const n = parseFloat(String(input).replace(',', '.'))
  return isNaN(n) ? 0 : Math.round(n * 1000)
}
