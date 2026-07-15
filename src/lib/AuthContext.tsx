'use client'

import { createContext, useContext } from 'react'
import { AuthUser } from '@/types/database'

const AuthContext = createContext<AuthUser | null>(null)

export function AuthProvider({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthUser {
  const user = useContext(AuthContext)
  if (!user) throw new Error('useAuth must be used within AuthProvider')
  return user
}

export function useIsAdmin(): boolean {
  return useAuth().role === 'admin'
}
