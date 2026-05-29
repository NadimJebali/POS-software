import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'
import { useSettings } from './settings'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const { settings } = useSettings()
  // Session lives in memory only — a fresh app launch requires signing in again.
  const [user, setUser] = useState(null)
  const [needsSetup, setNeedsSetup] = useState(null) // null = still checking

  useEffect(() => {
    api.auth.needsSetup().then(setNeedsSetup)
  }, [])

  // Auto-lock: sign out after a configurable idle period (0 = never).
  useEffect(() => {
    const mins = parseInt(settings.auto_lock_minutes || '0', 10)
    if (!user || !mins) return
    let timer
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        api.auth.logout().finally(() => setUser(null))
      }, mins * 60000)
    }
    const events = ['mousedown', 'keydown', 'touchstart', 'pointerdown', 'wheel']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [user, settings.auto_lock_minutes])

  const login = async (username, pin) => {
    const u = await api.auth.login(username, pin)
    setUser(u)
    return u
  }
  const logout = async () => {
    await api.auth.logout()
    setUser(null)
  }
  // First-run: create the initial admin and sign them straight in.
  const setup = async (data) => {
    const u = await api.auth.setup(data)
    setNeedsSetup(false)
    setUser(u)
    return u
  }

  return (
    <Ctx.Provider value={{ user, needsSetup, login, logout, setup, isAdmin: user?.role === 'admin' }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  return useContext(Ctx)
}
