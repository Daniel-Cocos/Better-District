import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchCurrentAdmin, signInAdmin, signOutAdmin, type AdminCredentials, type AdminUser } from '../api/auth'
import { setUnauthorizedHandler, tokenStore } from '../api/client'

interface AuthState {
  user: AdminUser | null
  /** True while an existing token is being checked on first load. */
  restoring: boolean
  signIn: (credentials: AdminCredentials) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [restoring, setRestoring] = useState(() => Boolean(tokenStore.get()))

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    if (tokenStore.get()) {
      fetchCurrentAdmin()
        .then(setUser)
        .catch(() => signOutAdmin())
        .finally(() => setRestoring(false))
    }
    return () => setUnauthorizedHandler(null)
  }, [])

  const signIn = useCallback(async (credentials: AdminCredentials) => {
    setUser(await signInAdmin(credentials))
  }, [])

  const signOut = useCallback(() => {
    signOutAdmin()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, restoring, signIn, signOut }), [user, restoring, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
