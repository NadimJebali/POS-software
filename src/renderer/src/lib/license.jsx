import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'

const Ctx = createContext(null)

export function LicenseProvider({ children }) {
  const [status, setStatus] = useState(null) // null = still loading

  const refresh = useCallback(() => api.license.status().then(setStatus), [])
  useEffect(() => {
    refresh()
  }, [refresh])

  const activate = useCallback(async (license) => {
    const s = await api.license.activate(license)
    setStatus(s)
    return s
  }, [])

  return <Ctx.Provider value={{ status, refresh, activate }}>{children}</Ctx.Provider>
}

export function useLicense() {
  return useContext(Ctx)
}
