import { Home, Users } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button, Panel } from '../../design-system'
import { useAuth } from '../auth/useAuth'

export function HouseholdSelectPage() {
  const { households, currentHousehold, setCurrentHouseholdId, isAuthenticated } =
    useAuth()
  const navigate = useNavigate()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (households.length === 1 && currentHousehold) {
    return <Navigate to={`/app/households/${currentHousehold.id}`} replace />
  }

  return (
    <main className="min-h-screen bg-stone-100 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-3xl border-t-8 border-brand-500 bg-white p-6 shadow-panel">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-600">
            Finanzas del hogar
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">
            Elige un hogar
          </h1>
          <p className="mt-2 font-semibold text-slate-500">
            Tus permisos y datos dependen del hogar seleccionado.
          </p>
        </header>

        <div className="grid gap-4">
          {households.map((household) => (
            <Panel key={household.id} title={household.name}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-sm font-semibold text-slate-500">
                  <p className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-brand-600" />
                    {household.country_code} · {household.currency_code} ·{' '}
                    {household.timezone}
                  </p>
                  <p className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand-600" />
                    {household.effective_permissions.length} permisos efectivos
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    setCurrentHouseholdId(household.id)
                    navigate(`/app/households/${household.id}`)
                  }}
                >
                  Entrar
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </main>
  )
}
