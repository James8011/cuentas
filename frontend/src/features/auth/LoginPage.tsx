import { zodResolver } from '@hookform/resolvers/zod'
import { HeartHandshake, Lock, Phone } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Alert, Button, FormField, Input, Panel } from '../../design-system'
import { ApiError } from '../../services/api'
import { useAuth } from './useAuth'

const loginSchema = z.object({
  phone: z.string().min(7, 'Ingresa un teléfono válido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  })

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/app" replace />
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-brand-50 via-stone-100 to-accent-100">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-200/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-accent-100/80 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <Panel className="border-t-8 border-brand-500">
          <div className="mb-6 flex items-center gap-3">
            <HeartHandshake className="h-10 w-10 text-brand-600" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-600">
                Finanzas del hogar
              </p>
              <h1 className="text-2xl font-black text-slate-900">Iniciar sesión</h1>
            </div>
          </div>

          <p className="mb-5 text-sm font-semibold text-slate-500">
            Accede con tu teléfono y contraseña. No hay autorregistro en el MVP.
          </p>

          {form.formState.errors.root ? (
            <Alert tone="danger" className="mb-4">
              {form.formState.errors.root.message}
            </Alert>
          ) : null}

          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await login(values.phone, values.password)
                navigate('/app')
              } catch (error) {
                const message =
                  error instanceof ApiError
                    ? (error.body.errors?.phone?.[0] ??
                      error.message)
                    : 'No se pudo iniciar sesión'
                form.setError('root', { message })
              }
            })}
          >
            <FormField
              label="Teléfono"
              htmlFor="phone"
              required
              error={form.formState.errors.phone?.message}
              hint="Colombia: 3001112233 o +57..."
            >
              <Input
                id="phone"
                autoComplete="tel"
                leftIcon={<Phone className="h-4 w-4" />}
                {...form.register('phone')}
              />
            </FormField>

            <FormField
              label="Contraseña"
              htmlFor="password"
              required
              error={form.formState.errors.password?.message}
            >
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                leftIcon={<Lock className="h-4 w-4" />}
                {...form.register('password')}
              />
            </FormField>

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Ingresando...' : 'Entrar'}
            </Button>
          </form>
        </Panel>
      </div>
    </main>
  )
}
