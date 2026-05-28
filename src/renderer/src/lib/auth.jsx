import { createContext, useContext, useState } from 'react'
import { api } from './api'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  // Session lives in memory only — a fresh app launch requires signing in again.
  const [user, setUser] = useState(null)

  const login = async (username, pin) => {
    const u = await api.auth.login(username, pin)
    setUser(u)
    return u
  }
  const logout = async () => {
    await api.auth.logout()
    setUser(null)
  }

  return <Ctx.Provider value={{ user, login, logout, isAdmin: user?.role === 'admin' }}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}
