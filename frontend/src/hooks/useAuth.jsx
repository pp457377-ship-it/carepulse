import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api, { tokens } from '../api/client'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!tokens.access) { setUser(null); setLoading(false); return }
    try { setUser((await api.get('/api/auth/me')).data) }
    catch (err) { if (err?.response?.status === 401) { tokens.clear(); setUser(null) } }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password })
    tokens.set(data); await load()
  }
  const register = async (full_name, email, password) => {
    const { data } = await api.post('/api/auth/register', { full_name, email, password })
    tokens.set(data); await load()
  }
  const logout = () => { tokens.clear(); setUser(null) }

  return <Ctx.Provider value={{ user, loading, login, register, logout, reload: load }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
