import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'

const Ctx = createContext(null)

export function LicenseProvider({ children }) {
  const [status, setStatus] = useState(null) // null = still loading

  const refresh = useCallback(() => api.license.status().then(setStatus), [])
  useEffect(() => {
    refresh()
  }, [refresh])

  // Silent background renewal: once on startup and roughly daily. Fire-and-forget —
  // it's never awaited before render and swallows its own errors, so it can never
  // block or delay startup or the order flow. A no-op for trial/unlicensed copies.
  useEffect(() => {
    let cancelled = false
    const tick = () =>
      api.license
        .renew()
        .then((s) => !cancelled && s && setStatus(s))
        .catch(() => {})
    tick()
    const id = setInterval(tick, 24 * 60 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const activate = useCallback(async (license) => {
    const s = await api.license.activate(license)
    setStatus(s)
    return s
  }, [])

  const activateByCode = useCallback(async (code) => {
    const s = await api.license.activateByCode(code)
    setStatus(s)
    return s
  }, [])

  return <Ctx.Provider value={{ status, refresh, activate, activateByCode }}>{children}</Ctx.Provider>
}

export function useLicense() {
  return useContext(Ctx)
}
