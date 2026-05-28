import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// Internal cache so the pure money() helper works outside React components too.
// Money is stored everywhere as integer "millis" (price * 1000).
let cache = { currency_symbol: 'DT', currency_decimals: '3', currency_position: 'after' }

export function currencyDecimals() {
  return Math.max(0, Math.min(3, parseInt(cache.currency_decimals ?? '3', 10)))
}

export function money(millis) {
  const decimals = currencyDecimals()
  const sign = millis < 0 ? '-' : ''
  const value = Math.abs(Math.round(millis || 0)) / 1000
  const num = value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const sym = cache.currency_symbol || ''
  return cache.currency_position === 'before' ? `${sign}${sym}${num}` : `${sign}${num} ${sym}`.trim()
}

// A units string the user types ("12.5", "12,500") -> integer millis.
export function unitsToMillis(input) {
  const n = parseFloat(String(input).replace(',', '.'))
  return isNaN(n) ? 0 : Math.round(n * 1000)
}

const Ctx = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    window.pos['settings:get']().then((s) => {
      cache = s
      setSettings(s)
    })
  }, [])

  const save = useCallback(async (patch) => {
    const s = await window.pos['settings:set']({ patch })
    cache = s
    setSettings(s)
    return s
  }, [])

  if (!settings) return null // gate the app until settings have loaded
  return <Ctx.Provider value={{ settings, save }}>{children}</Ctx.Provider>
}

export function useSettings() {
  return useContext(Ctx)
}
