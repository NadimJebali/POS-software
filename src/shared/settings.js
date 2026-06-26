// Shared settings schema: the canonical defaults (in storage form — all strings)
// and a parser that turns the raw key/value row into typed values. Both the
// renderer and the main process read settings through this, so the string keys,
// defaults, and coercion live in exactly one place.

export const DEFAULT_SETTINGS = {
  shop_name: 'My Restaurant',
  shop_address: '',
  shop_phone: '',
  receipt_footer: 'Thank you! Come back soon',
  logo: '',
  currency_symbol: 'DT',
  currency_decimals: '3',
  currency_position: 'after', // 'before' | 'after'
  print_silent: '0',
  printer_name: '',
  paper_width: '80', // mm: '58' | '80'
  low_stock_threshold: '5', // warn when product stock is at or below this
  auto_lock_minutes: '0', // sign out after this many idle minutes (0 = never)
  language: 'en' // UI language: 'en' | 'fr' | 'ar'
}

const intOr = (value, fallback) => {
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

/**
 * Parse the raw settings row (string key/value map) into typed values, applying
 * defaults for missing/blank keys so a caller never sees `NaN` or undefined.
 */
export function parseSettings(raw = {}) {
  const s = { ...DEFAULT_SETTINGS, ...raw }
  return {
    lowStockThreshold: Math.max(0, intOr(s.low_stock_threshold, 5)),
    autoLockMinutes: Math.max(0, intOr(s.auto_lock_minutes, 0)),
    printSilent: s.print_silent === '1',
    printerName: s.printer_name,
    paperWidth: s.paper_width,
    language: s.language,
    currency: {
      symbol: s.currency_symbol,
      decimals: clamp(intOr(s.currency_decimals, 3), 0, 3),
      position: s.currency_position
    }
  }
}
