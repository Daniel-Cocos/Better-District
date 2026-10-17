import axios, { isAxiosError } from 'axios'

const TOKEN_KEY = 'scc.adminToken'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

/** Shared axios instance. In dev, Vite proxies /api to FastAPI on :8000. */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let onUnauthorized: (() => void) | null = null

/** Lets the auth layer react when any request comes back 401 (expired session). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

api.interceptors.response.use(undefined, (error) => {
  if (isAxiosError(error) && error.response?.status === 401 && !error.config?.url?.endsWith('/auth/login')) {
    tokenStore.clear()
    onUnauthorized?.()
  }
  return Promise.reject(error)
})

/** Turns an axios/FastAPI error into a sentence fit for the UI. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (isAxiosError(err)) {
    if (!err.response) return 'Can’t reach the server. Check your connection and try again.'
    const detail = err.response.data?.detail
    if (typeof detail === 'string') return detail
  }
  return fallback
}
