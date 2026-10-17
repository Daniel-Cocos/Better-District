import { api, tokenStore } from './client'

export interface AdminCredentials {
  identifier: string // email address
  password: string
}

export interface AdminUser {
  email: string
  name: string
  job_title: string
}

interface LoginResponse {
  access_token: string
  token_type: 'bearer'
  user: AdminUser
}

export async function signInAdmin(credentials: AdminCredentials): Promise<AdminUser> {
  const { data } = await api.post<LoginResponse>('/auth/login', credentials)
  tokenStore.set(data.access_token)
  return data.user
}

export async function fetchCurrentAdmin(): Promise<AdminUser> {
  const { data } = await api.get<AdminUser>('/auth/me')
  return data
}

export function signOutAdmin() {
  // Revoke the token server-side too; signing out locally never waits on it
  const token = tokenStore.get()
  tokenStore.clear()
  if (token) api.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
}
