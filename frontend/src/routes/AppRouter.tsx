import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { LoginPage } from '../features/auth/LoginPage'
import { HouseholdDashboardPage } from '../features/dashboard/HouseholdDashboardPage'
import { HouseholdSelectPage } from '../features/households/HouseholdSelectPage'
import { HouseholdAdminPage } from '../features/members/HouseholdAdminPage'
import { MarketWorkspacePage } from '../features/market/MarketWorkspacePage'
import { FinancialWorkspacePage } from '../features/finance/FinancialWorkspacePage'

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100">
        <p className="font-black text-slate-600">Cargando sesión...</p>
      </main>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<HouseholdSelectPage />} />
        <Route
          path="/app/households/:householdId"
          element={<HouseholdDashboardPage />}
        />
        <Route
          path="/app/households/:householdId/admin"
          element={<HouseholdAdminPage />}
        />
        <Route
          path="/app/households/:householdId/market"
          element={<MarketWorkspacePage />}
        />
        <Route
          path="/app/households/:householdId/finance"
          element={<FinancialWorkspacePage />}
        />
      </Route>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
