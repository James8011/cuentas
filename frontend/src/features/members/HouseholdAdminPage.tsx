import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Shield, UserPlus, WalletCards } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import {
  Alert,
  Badge,
  Button,
  Dialog,
  FormField,
  Input,
  Panel,
} from '../../design-system'
import { ApiError, api } from '../../services/api'
import { useAuth } from '../auth/useAuth'

const memberSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  phone: z.string().min(7, 'Teléfono requerido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role_ids: z.array(z.number()).min(1, 'Asigna al menos un rol'),
})

const roleSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional(),
  permission_keys: z.array(z.string()).min(1, 'Selecciona permisos'),
})

type MemberForm = z.infer<typeof memberSchema>
type RoleForm = z.infer<typeof roleSchema>

export function HouseholdAdminPage() {
  const { householdId } = useParams()
  const id = Number(householdId)
  const { user, households, hasPermission, logout, setCurrentHouseholdId } =
    useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [memberOpen, setMemberOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const household = households.find((item) => item.id === id)

  useEffect(() => {
    if (Number.isFinite(id)) setCurrentHouseholdId(id)
  }, [id, setCurrentHouseholdId])

  const membersQuery = useQuery({
    queryKey: ['members', id],
    queryFn: () => api.members(id),
    enabled: Number.isFinite(id) && hasPermission('miembros.ver'),
  })

  const rolesQuery = useQuery({
    queryKey: ['roles', id],
    queryFn: () => api.roles(id),
    enabled: Number.isFinite(id) && hasPermission('roles.ver'),
  })

  const permissionsQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.permissions(),
    enabled: hasPermission('roles.gestionar'),
  })

  const memberForm = useForm<MemberForm>({
    resolver: zodResolver(memberSchema),
    defaultValues: { name: '', phone: '', password: '', role_ids: [] },
  })

  const roleForm = useForm<RoleForm>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: '', description: '', permission_keys: [] },
  })

  const createMember = useMutation({
    mutationFn: (values: MemberForm) => api.createMember(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['members', id] })
      setMemberOpen(false)
      memberForm.reset()
      setError(null)
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear')
    },
  })

  const createRole = useMutation({
    mutationFn: (values: RoleForm) => api.createRole(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roles', id] })
      setRoleOpen(false)
      roleForm.reset()
      setError(null)
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el rol')
    },
  })

  const updateMember = useMutation({
    mutationFn: (payload: {
      membershipId: number
      body: { status?: string; role_ids?: number[] }
    }) => api.updateMember(id, payload.membershipId, payload.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['members', id] })
      setError(null)
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar')
    },
  })

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, { key: string; name: string }[]>()
    for (const permission of permissionsQuery.data?.data ?? []) {
      const list = groups.get(permission.group) ?? []
      list.push({ key: permission.key, name: permission.name })
      groups.set(permission.group, list)
    }
    return [...groups.entries()]
  }, [permissionsQuery.data])

  if (!household) {
    return <Navigate to="/app" replace />
  }

  const canManageMembers = hasPermission('miembros.gestionar')
  const canCreateMembers = hasPermission('miembros.crear')
  const canManageRoles = hasPermission('roles.gestionar')

  return (
    <main className="min-h-screen bg-stone-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border-t-8 border-brand-500 bg-white p-6 shadow-panel">
          <Link
            to={`/app/households/${id}`}
            className="inline-flex items-center gap-1 text-sm font-black text-brand-600"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-600">
                Administración
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-900">
                {household.name}
              </h1>
              <p className="mt-1 font-semibold text-slate-500">
                {user?.name} · {user?.phone}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => navigate(`/app/households/${id}/finance`)}
              >
                <WalletCards className="h-4 w-4" />
                Núcleo financiero
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setCurrentHouseholdId(null)
                  navigate('/app')
                }}
              >
                Cambiar hogar
              </Button>
              <Button type="button" variant="outline" onClick={() => void logout()}>
                Cerrar sesión
              </Button>
            </div>
          </div>
        </header>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        {!hasPermission('miembros.ver') && !hasPermission('roles.ver') ? (
          <Alert tone="danger">
            No tienes permisos para administrar este hogar.
          </Alert>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Integrantes">
            <div className="mb-4 flex justify-end">
              {canCreateMembers ? (
                <Button type="button" size="sm" onClick={() => setMemberOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                  Crear integrante
                </Button>
              ) : null}
            </div>

            {membersQuery.isLoading ? (
              <p className="font-semibold text-slate-500">Cargando...</p>
            ) : membersQuery.isError ? (
              <Alert tone="danger">
                {membersQuery.error instanceof ApiError &&
                membersQuery.error.status === 403
                  ? 'Acceso denegado'
                  : 'No se pudieron cargar los integrantes'}
              </Alert>
            ) : (
              <ul className="space-y-3">
                {(membersQuery.data?.data ?? []).map((membership) => (
                  <li
                    key={membership.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-slate-800">
                          {membership.user.name}
                        </p>
                        <p className="text-sm font-semibold text-slate-500">
                          {membership.user.phone}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {membership.roles.map((role) => (
                            <Badge key={role.id}>{role.name}</Badge>
                          ))}
                        </div>
                      </div>
                      <Badge
                        tone={
                          membership.status === 'active' ? 'success' : 'warning'
                        }
                      >
                        {membership.status}
                      </Badge>
                    </div>
                    {canManageMembers ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={updateMember.isPending}
                          onClick={() =>
                            updateMember.mutate({
                              membershipId: membership.id,
                              body: {
                                status:
                                  membership.status === 'active'
                                    ? 'suspended'
                                    : 'active',
                              },
                            })
                          }
                        >
                          {membership.status === 'active'
                            ? 'Suspender'
                            : 'Reactivar'}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Roles y permisos">
            <div className="mb-4 flex justify-end">
              {canManageRoles ? (
                <Button type="button" size="sm" onClick={() => setRoleOpen(true)}>
                  <Shield className="h-4 w-4" />
                  Crear rol
                </Button>
              ) : null}
            </div>

            {rolesQuery.isLoading ? (
              <p className="font-semibold text-slate-500">Cargando...</p>
            ) : rolesQuery.isError ? (
              <Alert tone="danger">No se pudieron cargar los roles</Alert>
            ) : (
              <ul className="space-y-3">
                {(rolesQuery.data?.data ?? []).map((role) => (
                  <li
                    key={role.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-slate-800">{role.name}</p>
                        <p className="text-sm font-semibold text-slate-500">
                          {role.description ?? 'Sin descripción'}
                        </p>
                      </div>
                      <Badge tone={role.status === 'active' ? 'success' : 'neutral'}>
                        {role.is_system ? 'sistema' : role.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      {(role.permission_keys ?? []).length} permisos
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Dialog
        open={memberOpen}
        onOpenChange={setMemberOpen}
        title="Crear integrante"
        description="La cuenta queda activa de inmediato. Entrega teléfono y contraseña a la persona."
        footer={
          <Button
            type="button"
            disabled={createMember.isPending}
            onClick={memberForm.handleSubmit((values) =>
              createMember.mutate(values),
            )}
          >
            {createMember.isPending ? 'Creando...' : 'Crear cuenta'}
          </Button>
        }
      >
        <FormField
          label="Nombre"
          htmlFor="member-name"
          required
          error={memberForm.formState.errors.name?.message}
        >
          <Input id="member-name" {...memberForm.register('name')} />
        </FormField>
        <FormField
          label="Teléfono"
          htmlFor="member-phone"
          required
          error={memberForm.formState.errors.phone?.message}
        >
          <Input id="member-phone" {...memberForm.register('phone')} />
        </FormField>
        <FormField
          label="Contraseña inicial"
          htmlFor="member-password"
          required
          error={memberForm.formState.errors.password?.message}
        >
          <Input
            id="member-password"
            type="password"
            {...memberForm.register('password')}
          />
        </FormField>
        <FormField
          label="Roles"
          required
          error={memberForm.formState.errors.role_ids?.message}
        >
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-2xl border border-slate-100 p-3">
            {(rolesQuery.data?.data ?? [])
              .filter((role) => role.status === 'active')
              .map((role) => {
                const selected = memberForm.watch('role_ids').includes(role.id)
                return (
                  <label
                    key={role.id}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => {
                        const current = memberForm.getValues('role_ids')
                        memberForm.setValue(
                          'role_ids',
                          event.target.checked
                            ? [...current, role.id]
                            : current.filter((value) => value !== role.id),
                          { shouldValidate: true },
                        )
                      }}
                    />
                    {role.name}
                  </label>
                )
              })}
          </div>
        </FormField>
      </Dialog>

      <Dialog
        open={roleOpen}
        onOpenChange={setRoleOpen}
        title="Crear rol"
        description="Solo puedes elegir permisos del catálogo del sistema."
        className="max-w-2xl"
        footer={
          <Button
            type="button"
            disabled={createRole.isPending}
            onClick={roleForm.handleSubmit((values) => createRole.mutate(values))}
          >
            {createRole.isPending ? 'Guardando...' : 'Guardar rol'}
          </Button>
        }
      >
        <FormField
          label="Nombre"
          htmlFor="role-name"
          required
          error={roleForm.formState.errors.name?.message}
        >
          <Input id="role-name" {...roleForm.register('name')} />
        </FormField>
        <FormField label="Descripción" htmlFor="role-description">
          <Input id="role-description" {...roleForm.register('description')} />
        </FormField>
        <FormField
          label="Permisos"
          required
          error={roleForm.formState.errors.permission_keys?.message}
        >
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-2xl border border-slate-100 p-3">
            {permissionGroups.map(([group, items]) => (
              <div key={group}>
                <p className="mb-1 text-xs font-black uppercase tracking-wide text-brand-600">
                  {group}
                </p>
                <div className="space-y-1">
                  {items.map((permission) => {
                    const selected = roleForm
                      .watch('permission_keys')
                      .includes(permission.key)
                    return (
                      <label
                        key={permission.key}
                        className="flex items-center gap-2 text-sm font-semibold text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) => {
                            const current = roleForm.getValues('permission_keys')
                            roleForm.setValue(
                              'permission_keys',
                              event.target.checked
                                ? [...current, permission.key]
                                : current.filter((value) => value !== permission.key),
                              { shouldValidate: true },
                            )
                          }}
                        />
                        {permission.name}
                        <span className="text-xs text-slate-400">
                          {permission.key}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </FormField>
      </Dialog>
    </main>
  )
}
