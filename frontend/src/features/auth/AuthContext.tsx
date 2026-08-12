import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from '../../services/api'
import type { AuthPayload } from '../../services/types'
import { AuthContext, type AuthContextValue } from './auth-context'

const HOUSEHOLD_KEY = 'cuentas.currentHouseholdId'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [sessionExpired, setSessionExpired] = useState(false)
  const [currentHouseholdId, setCurrentHouseholdIdState] = useState<number | null>(
    () => {
      const raw = localStorage.getItem(HOUSEHOLD_KEY)
      return raw ? Number(raw) : null
    },
  )

  const sessionQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await api.me()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null
        }
        throw error
      }
    },
    retry: false,
    staleTime: 30_000,
  })

  const setCurrentHouseholdId = useCallback((id: number | null) => {
    setCurrentHouseholdIdState(id)
    if (id === null) {
      localStorage.removeItem(HOUSEHOLD_KEY)
      return
    }
    localStorage.setItem(HOUSEHOLD_KEY, String(id))
  }, [])

  const login = useCallback(
    async (phone: string, password: string) => {
      const payload = await api.login(phone, password)
      queryClient.setQueryData(['auth', 'me'], payload)
      setSessionExpired(false)
      if (payload.households.length === 1) {
        setCurrentHouseholdId(payload.households[0].id)
      }
    },
    [queryClient, setCurrentHouseholdId],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      queryClient.setQueryData(['auth', 'me'], null)
      setCurrentHouseholdId(null)
    }
  }, [queryClient, setCurrentHouseholdId])

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false)
  }, [])

  const data = sessionQuery.data as AuthPayload | null | undefined
  const households = useMemo(() => data?.households ?? [], [data?.households])
  const currentHousehold = useMemo(
    () =>
      households.find((item) => item.id === currentHouseholdId) ??
      households[0] ??
      null,
    [currentHouseholdId, households],
  )

  const hasPermission = useCallback(
    (key: string) => Boolean(currentHousehold?.effective_permissions.includes(key)),
    [currentHousehold?.effective_permissions],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data?.user ?? null,
      households,
      currentHousehold,
      setCurrentHouseholdId,
      isLoading: sessionQuery.isLoading,
      isAuthenticated: Boolean(data?.user),
      login,
      logout,
      hasPermission,
      sessionExpired,
      clearSessionExpired,
    }),
    [
      clearSessionExpired,
      currentHousehold,
      data?.user,
      hasPermission,
      households,
      login,
      logout,
      sessionExpired,
      sessionQuery.isLoading,
      setCurrentHouseholdId,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
