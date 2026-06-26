import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { formatMoney, unitsToMillis } from '../../../shared/money'
import { parseSettings } from '../../../shared/settings'

// Internal cache so the money() adapter works outside React components too.
// Money is stored everywhere as integer "millis" (price * 1000).
let cache = { currency_symbol: 'DT', currency_decimals: '3', currency_position: 'after' }

export function currencyDecimals() {
  return parseSettings(cache).currency.decimals
}

// Renderer adapter: formats with the cached currency settings.
export function money(millis) {
  return formatMoney(millis, parseSettings(cache).currency)
}

// Re-export so existing call sites keep importing it from '../lib/settings'.
export { unitsToMillis, formatMoney }

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
