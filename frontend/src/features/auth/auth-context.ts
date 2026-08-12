import { createContext } from 'react'
import type { Household, User } from '../../services/types'

export type AuthContextValue = {
  user: User | null
  households: Household[]
  currentHousehold: Household | null
  setCurrentHouseholdId: (id: number | null) => void
  isLoading: boolean
  isAuthenticated: boolean
  login: (phone: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (key: string) => boolean
  sessionExpired: boolean
  clearSessionExpired: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
