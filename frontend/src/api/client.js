import axios from 'axios'

const api = axios.create({ baseURL: '/' })

export const tokens = {
  get access() { return localStorage.getItem('cp_access') },
  get refresh() { return localStorage.getItem('cp_refresh') },
  set(pair) {
    localStorage.setItem('cp_access', pair.access_token)
    localStorage.setItem('cp_refresh', pair.refresh_token)
  },
  clear() {
    localStorage.removeItem('cp_access')
    localStorage.removeItem('cp_refresh')
  },
}

api.interceptors.request.use((cfg) => {
  const t = tokens.access
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

let refreshing = null
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry && tokens.refresh &&
        !original.url.includes('/api/auth/')) {
      original._retry = true
      try {
        refreshing ??= axios.post('/api/auth/refresh', { refresh_token: tokens.refresh })
          .then((r) => { tokens.set(r.data); return r.data })
          .finally(() => { refreshing = null })
        await refreshing
        return api(original)
      } catch {
        tokens.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)

export function errorMessages(err) {
  const d = err?.response?.data?.detail
  if (!d) return [err?.message || 'Request failed']
  if (typeof d === 'string') return [d]
  if (Array.isArray(d?.errors)) return d.errors
  if (Array.isArray(d)) return d.map((x) => `${x.loc?.slice(-1)[0]}: ${x.msg}`)
  return [JSON.stringify(d)]
}

export default api
