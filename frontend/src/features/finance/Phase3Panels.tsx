import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Download, Pencil, Plus, ReceiptText } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Alert,
  Badge,
  Button,
  Dialog,
  FormField,
  Input,
  MoneyInput,
  Panel,
  Select,
} from '../../design-system'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatDecimal, formatMoney } from '../../lib/money'
import { ApiError, api } from '../../services/api'
import type { Budget, Debt, SavingsGoal } from '../../services/types'
import {
  budgetStatusLabel,
  debtStatusLabel,
  savingsStatusLabel,
} from './labels'

function Card({
  title,
  status,
  statusTone = 'neutral',
  children,
}: {
  title: string
  status: string
  statusTone?: 'neutral' | 'success' | 'warning' | 'danger'
  children: ReactNode
}) {
  return (
    <article className="h-full rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="mb-2 flex justify-between gap-2">
        <h3 className="font-black text-slate-800">{title}</h3>
        <Badge tone={statusTone}>{status}</Badge>
      </div>
      <div className="space-y-1 text-sm font-semibold text-slate-500">{children}</div>
    </article>
  )
}

function CardList({ children, empty }: { children: ReactNode; empty: string }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean)
  return items.length ? (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  ) : (
    <div className="rounded-2xl border border-dashed p-8 text-center font-semibold text-slate-500">
      <ReceiptText className="mx-auto mb-2 h-8 w-8" />
      {empty}
    </div>
  )
}

function Toolbar({
  allowed,
  onAdd,
  label,
}: {
  allowed: boolean
  onAdd: () => void
  label: string
}) {
  return (
    <div className="mb-4 flex justify-end">
      {allowed ? (
        <Button size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {label}
        </Button>
      ) : null}
    </div>
  )
}

type Props = {
  householdId: number
  currency: string
  tab: 'debts' | 'savings' | 'budgets' | 'settlements' | 'reports'
  members: { id: number; user: { name: string } }[]
  accounts: { id: number; name: string }[]
  categories: { id: number; name: string; type: string }[]
  hasPermission: (key: string) => boolean
}

function fail(reason: unknown) {
  return reason instanceof ApiError
    ? (Object.values(reason.body.errors ?? {})[0]?.[0] ?? reason.message)
    : 'No se pudo completar la operación'
}

const emptyDebt = (ownerId: string) => ({
  name: '',
  creditor_name: '',
  principal_amount: '',
  minimum_payment: '',
  owner_membership_id: ownerId,
})

const emptyGoal = () => ({
  name: '',
  kind: 'goal' as 'goal' | 'emergency',
  target_amount: '',
  emergency_months: '3',
  contribution_amount: '',
})

const emptyBudget = (period: string) => ({
  name: 'Presupuesto',
  period,
  category_id: '',
  planned_amount: '',
})

const emptySettle = () => ({
  from_membership_id: '',
  to_membership_id: '',
  amount: '',
})

export function Phase3Panels({
  householdId: id,
  currency,
  tab,
  members,
  accounts,
  categories,
  hasPermission,
}: Props) {
  const qc = useQueryClient()
  const periodDefault = new Date().toISOString().slice(0, 7)
  const [period, setPeriod] = useState(periodDefault)
  const ownerDefault = String(members[0]?.id ?? '')

  const [debtDialog, setDebtDialog] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)
  const [debtForm, setDebtForm] = useState(emptyDebt(ownerDefault))
  const [payDebtId, setPayDebtId] = useState<number | null>(null)
  const [payAmount, setPayAmount] = useState('')

  const [goalDialog, setGoalDialog] = useState(false)
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null)
  const [goalForm, setGoalForm] = useState(emptyGoal())
  const [moveGoalId, setMoveGoalId] = useState<number | null>(null)
  const [moveAmount, setMoveAmount] = useState('')

  const [budgetDialog, setBudgetDialog] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [budgetForm, setBudgetForm] = useState(emptyBudget(periodDefault))

  const [settleDialog, setSettleDialog] = useState(false)
  const [settleForm, setSettleForm] = useState(emptySettle())

  const debts = useQuery({
    queryKey: ['debts', id],
    queryFn: () => api.debts(id),
    enabled: tab === 'debts',
  })
  const savings = useQuery({
    queryKey: ['savings', id],
    queryFn: () => api.savingsGoals(id),
    enabled: tab === 'savings',
  })
  const budgets = useQuery({
    queryKey: ['budgets', id],
    queryFn: () => api.budgets(id),
    enabled: tab === 'budgets',
  })
  const cashFlow = useQuery({
    queryKey: ['cashflow', id, period],
    queryFn: () => api.cashFlow(id, period),
    enabled: tab === 'budgets' || tab === 'reports',
  })
  const settlements = useQuery({
    queryKey: ['settlements', id],
    queryFn: () => api.settlements(id),
    enabled: tab === 'settlements',
  })
  const audit = useQuery({
    queryKey: ['audit', id],
    queryFn: () => api.auditLogs(id),
    enabled: tab === 'reports' && hasPermission('auditoria.ver'),
  })

  const refresh = (...keys: string[]) =>
    Promise.all(keys.map((key) => qc.invalidateQueries({ queryKey: [key, id] })))

  const openCreateDebt = () => {
    setEditingDebt(null)
    setDebtForm(emptyDebt(ownerDefault))
    setDebtDialog(true)
  }
  const openEditDebt = (debt: Debt) => {
    setEditingDebt(debt)
    setDebtForm({
      name: debt.name,
      creditor_name: debt.creditor_name,
      principal_amount: debt.current_balance,
      minimum_payment: debt.minimum_payment,
      owner_membership_id: ownerDefault,
    })
    setDebtDialog(true)
  }

  const saveDebt = useMutation({
    mutationFn: async () => {
      if (editingDebt) {
        return api.updateDebt(id, editingDebt.id, {
          name: debtForm.name,
          creditor_name: debtForm.creditor_name,
          minimum_payment: debtForm.minimum_payment || '0.0000',
        })
      }
      return api.createDebt(id, {
        name: debtForm.name,
        creditor_name: debtForm.creditor_name,
        owner_membership_id: Number(debtForm.owner_membership_id),
        principal_amount: debtForm.principal_amount,
        current_balance: debtForm.principal_amount,
        minimum_payment: debtForm.minimum_payment || '0.0000',
        currency_code: currency,
      })
    },
    onSuccess: async () => {
      await refresh('debts')
      setDebtDialog(false)
      toast.success(editingDebt ? 'Deuda actualizada' : 'Deuda registrada', {
        description: editingDebt
          ? `Se guardaron los cambios de “${debtForm.name}”.`
          : `“${debtForm.name}” quedó con saldo ${formatMoney(debtForm.principal_amount || '0', currency)}.`,
      })
    },
    onError: (e) => toast.error('No se pudo guardar la deuda', { description: fail(e) }),
  })

  const cancelDebt = useMutation({
    mutationFn: (debtId: number) => api.cancelDebt(id, debtId),
    onSuccess: async () => {
      await refresh('debts')
      toast.success('Deuda cancelada', {
        description: 'La deuda ya no aparece como activa ni admite pagos.',
      })
    },
    onError: (e) => toast.error('No se pudo cancelar la deuda', { description: fail(e) }),
  })

  const payDebt = useMutation({
    mutationFn: () =>
      api.createDebtPayment(id, payDebtId!, {
        payer_membership_id: members[0]?.id,
        account_id: accounts[0]?.id,
        amount: payAmount,
        paid_on: new Date().toISOString().slice(0, 10),
        idempotency_key: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      await refresh('debts', 'balances')
      setPayDebtId(null)
      setPayAmount('')
      toast.success('Pago de deuda registrado', {
        description: `Se aplicó un pago de ${formatMoney(payAmount || '0', currency)}.`,
      })
    },
    onError: (e) => toast.error('No se pudo registrar el pago', { description: fail(e) }),
  })

  const openCreateGoal = () => {
    setEditingGoal(null)
    setGoalForm(emptyGoal())
    setGoalDialog(true)
  }
  const openEditGoal = (goal: SavingsGoal) => {
    setEditingGoal(goal)
    setGoalForm({
      name: goal.name,
      kind: goal.kind,
      target_amount: goal.target_amount,
      emergency_months: String(goal.emergency_months ?? 3),
      contribution_amount: '',
    })
    setGoalDialog(true)
  }

  const saveGoal = useMutation({
    mutationFn: async () => {
      if (editingGoal) {
        return api.updateSavingsGoal(id, editingGoal.id, {
          name: goalForm.name,
          kind: goalForm.kind,
          target_amount: goalForm.kind === 'goal' ? goalForm.target_amount : undefined,
          emergency_months:
            goalForm.kind === 'emergency' ? Number(goalForm.emergency_months) : undefined,
        })
      }
      return api.createSavingsGoal(id, {
        name: goalForm.name,
        kind: goalForm.kind,
        scope: 'shared',
        target_amount: goalForm.kind === 'goal' ? goalForm.target_amount : undefined,
        emergency_months:
          goalForm.kind === 'emergency' ? Number(goalForm.emergency_months) : undefined,
        currency_code: currency,
      })
    },
    onSuccess: async () => {
      await refresh('savings')
      setGoalDialog(false)
      toast.success(editingGoal ? 'Ahorro actualizado' : 'Ahorro creado', {
        description: editingGoal
          ? `Se guardaron los cambios de “${goalForm.name}”.`
          : goalForm.kind === 'emergency'
            ? `Fondo de emergencia “${goalForm.name}” creado.`
            : `Objetivo “${goalForm.name}” creado.`,
      })
    },
    onError: (e) => toast.error('No se pudo guardar el ahorro', { description: fail(e) }),
  })

  const cancelGoal = useMutation({
    mutationFn: (goalId: number) => api.cancelSavingsGoal(id, goalId),
    onSuccess: async () => {
      await refresh('savings')
      toast.success('Objetivo cancelado', {
        description: 'El ahorro quedó inactivo y ya no admite aportes.',
      })
    },
    onError: (e) => toast.error('No se pudo cancelar el ahorro', { description: fail(e) }),
  })

  const moveSavings = useMutation({
    mutationFn: () =>
      api.moveSavings(id, moveGoalId!, {
        membership_id: members[0]?.id,
        type: 'contribution',
        amount: moveAmount,
        moved_on: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: async () => {
      await refresh('savings')
      const amount = moveAmount
      setMoveGoalId(null)
      setMoveAmount('')
      toast.success('Aporte registrado', {
        description: `Se sumó ${formatMoney(amount || '0', currency)} al objetivo.`,
      })
    },
    onError: (e) => toast.error('No se pudo registrar el aporte', { description: fail(e) }),
  })

  const openCreateBudget = () => {
    setEditingBudget(null)
    setBudgetForm(emptyBudget(period))
    setBudgetDialog(true)
  }
  const openEditBudget = (budget: Budget) => {
    const line = budget.lines[0]
    setEditingBudget(budget)
    setBudgetForm({
      name: budget.name,
      period: budget.period,
      category_id: line ? String(line.category_id) : '',
      planned_amount: line?.planned_amount ?? '',
    })
    setBudgetDialog(true)
  }

  const saveBudget = useMutation({
    mutationFn: async () => {
      const lines = [
        {
          category_id: Number(budgetForm.category_id),
          planned_amount: budgetForm.planned_amount,
        },
      ]
      if (editingBudget) {
        return api.updateBudget(id, editingBudget.id, {
          name: budgetForm.name,
          lines,
        })
      }
      return api.createBudget(id, {
        name: budgetForm.name,
        scope: 'shared',
        period: budgetForm.period,
        currency_code: currency,
        lines,
      })
    },
    onSuccess: async () => {
      await refresh('budgets')
      setBudgetDialog(false)
      toast.success(editingBudget ? 'Presupuesto actualizado' : 'Presupuesto creado', {
        description: editingBudget
          ? `Se actualizó “${budgetForm.name}”.`
          : `“${budgetForm.name}” para ${budgetForm.period} quedó listo.`,
      })
    },
    onError: (e) => toast.error('No se pudo guardar el presupuesto', { description: fail(e) }),
  })

  const cancelBudget = useMutation({
    mutationFn: (budgetId: number) => api.cancelBudget(id, budgetId),
    onSuccess: async () => {
      await refresh('budgets')
      toast.success('Presupuesto cancelado', {
        description: 'El presupuesto abierto quedó anulado.',
      })
    },
    onError: (e) => toast.error('No se pudo cancelar el presupuesto', { description: fail(e) }),
  })

  const closePeriod = useMutation({
    mutationFn: () => api.closePeriod(id, period),
    onSuccess: async () => {
      await refresh('budgets', 'cashflow')
      toast.success('Período cerrado', {
        description: `Se guardó la fotografía financiera de ${period}.`,
      })
    },
    onError: (e) => toast.error('No se pudo cerrar el período', { description: fail(e) }),
  })

  const settle = useMutation({
    mutationFn: () =>
      api.createSettlement(id, {
        from_membership_id: Number(settleForm.from_membership_id),
        to_membership_id: Number(settleForm.to_membership_id),
        amount: settleForm.amount,
        currency_code: currency,
        settled_on: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: async () => {
      const amount = settleForm.amount
      await refresh('settlements', 'balances')
      setSettleDialog(false)
      setSettleForm(emptySettle())
      toast.success('Compensación registrada', {
        description: `Se registró ${formatMoney(amount || '0', currency)} entre integrantes.`,
      })
    },
    onError: (e) => toast.error('No se pudo registrar la compensación', { description: fail(e) }),
  })

  const exportXlsx = async () => {
    try {
      const res = await fetch(api.exportUrl(id, period), { credentials: 'include' })
      if (!res.ok) throw new Error('Exportación fallida')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-${id}-${period}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Reporte Excel listo', {
        description: 'Incluye movimientos del mes y auditoría.',
      })
    } catch (e) {
      toast.error('No se pudo exportar', { description: fail(e) })
    }
  }

  const expenseCats = categories.filter((c) => c.type === 'expense')
  const statusTone = (status: string): 'neutral' | 'success' | 'warning' | 'danger' => {
    if (status === 'active' || status === 'open' || status === 'completed') return 'success'
    if (status === 'cancelled') return 'danger'
    if (status === 'paid' || status === 'closed') return 'neutral'
    return 'warning'
  }

  if (tab === 'debts') {
    return (
      <Panel title="Deudas">
        <Alert className="mb-4">
          Registra acreedor, saldo, cuota mínima y titular. Edita o cancela desde cada tarjeta; los
          pagos reducen el saldo.
        </Alert>
        <Toolbar
          allowed={hasPermission('deudas.crear')}
          onAdd={openCreateDebt}
          label="Nueva deuda"
        />
        <CardList empty="No hay deudas">
          {debts.data?.data.map((item) => (
            <Card
              key={item.id}
              title={item.name}
              status={debtStatusLabel(item.status)}
              statusTone={statusTone(item.status)}
            >
              <p className="text-xs">
                {item.creditor_name} · Titular: {item.owner?.user?.name ?? '—'}
              </p>
              <p>
                Saldo: <strong>{formatMoney(item.current_balance, item.currency_code)}</strong>
              </p>
              <p className="text-xs">
                Mínimo: {formatMoney(item.minimum_payment, item.currency_code)}
                {item.next_payment_on ? ` · Próximo: ${formatDate(item.next_payment_on)}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {hasPermission('deudas.editar') && item.status === 'active' ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => openEditDebt(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!accounts[0] || !members[0]}
                      onClick={() => {
                        setPayDebtId(item.id)
                        setPayAmount(item.minimum_payment)
                      }}
                    >
                      Registrar pago
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cancelDebt.isPending}
                      onClick={() => {
                        if (window.confirm(`¿Cancelar la deuda “${item.name}”?`)) {
                          cancelDebt.mutate(item.id)
                        }
                      }}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Cancelar
                    </Button>
                  </>
                ) : null}
              </div>
            </Card>
          ))}
        </CardList>

        <Dialog
          open={debtDialog}
          onOpenChange={(open) => !open && setDebtDialog(false)}
          title={editingDebt ? 'Editar deuda' : 'Nueva deuda'}
          footer={
            <Button disabled={saveDebt.isPending} onClick={() => saveDebt.mutate()}>
              {saveDebt.isPending ? 'Guardando…' : editingDebt ? 'Guardar cambios' : 'Registrar deuda'}
            </Button>
          }
        >
          <FormField
            label="Nombre"
            tooltip="Nombre corto de la obligación (por ejemplo Tarjeta Bancolombia o Préstamo carro)."
          >
            <Input
              value={debtForm.name}
              onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })}
            />
          </FormField>
          <FormField
            label="Acreedor"
            tooltip="Entidad o persona a la que se debe el dinero (banco, comercio, familiar)."
          >
            <Input
              value={debtForm.creditor_name}
              onChange={(e) => setDebtForm({ ...debtForm, creditor_name: e.target.value })}
            />
          </FormField>
          {!editingDebt ? (
            <FormField
              label="Saldo / principal"
              tooltip="Saldo actual de la deuda. Al crearla suele ser el monto pendiente por pagar."
            >
              <MoneyInput
                value={debtForm.principal_amount}
                onChange={(v) => setDebtForm({ ...debtForm, principal_amount: v })}
              />
            </FormField>
          ) : null}
          <FormField
            label="Cuota mínima"
            tooltip="Pago mínimo sugerido del período. Se usa como valor por defecto al registrar un pago."
          >
            <MoneyInput
              value={debtForm.minimum_payment}
              onChange={(v) => setDebtForm({ ...debtForm, minimum_payment: v })}
            />
          </FormField>
          {!editingDebt ? (
            <FormField
              label="Titular"
              tooltip="Integrante titular legal de la deuda. Puede diferir de quien aporta al pago."
            >
              <Select
                value={debtForm.owner_membership_id}
                onValueChange={(v) => setDebtForm({ ...debtForm, owner_membership_id: v })}
                options={members.map((m) => ({ value: String(m.id), label: m.user.name }))}
              />
            </FormField>
          ) : null}
        </Dialog>

        <Dialog
          open={payDebtId !== null}
          onOpenChange={(open) => !open && setPayDebtId(null)}
          title="Registrar pago de deuda"
          footer={
            <Button
              disabled={payDebt.isPending || !payAmount}
              onClick={() => payDebt.mutate()}
            >
              {payDebt.isPending ? 'Registrando…' : 'Confirmar pago'}
            </Button>
          }
        >
          <FormField
            label="Monto a pagar"
            tooltip="Monto que se abona ahora. No puede superar el saldo pendiente de la deuda."
          >
            <MoneyInput value={payAmount} onChange={setPayAmount} />
          </FormField>
          <p className="text-xs text-slate-500">
            Se debitará desde {accounts[0]?.name ?? 'la primera cuenta activa'} por{' '}
            {members[0]?.user.name ?? 'el primer integrante'}.
          </p>
        </Dialog>
      </Panel>
    )
  }

  if (tab === 'savings') {
    return (
      <Panel title="Ahorros y fondo de emergencia">
        <Alert className="mb-4">
          Objetivos de ahorro y fondo de emergencia. Usa el botón para crear; edita, aporta o cancela
          desde cada tarjeta.
        </Alert>
        <Toolbar
          allowed={hasPermission('ahorros.gestionar')}
          onAdd={openCreateGoal}
          label="Nuevo ahorro"
        />
        <CardList empty="No hay objetivos de ahorro">
          {savings.data?.data.map((item) => (
            <Card
              key={item.id}
              title={item.name}
              status={
                item.kind === 'emergency'
                  ? 'Emergencia'
                  : savingsStatusLabel(item.status)
              }
              statusTone={statusTone(item.status)}
            >
              <p>
                {formatMoney(item.current_amount, item.currency_code)} /{' '}
                {formatMoney(item.target_amount, item.currency_code)}
              </p>
              <p className="text-xs">
                Avance: {formatDecimal(item.progress_percent ?? '0', 'es-CO', 2)}% · Falta:{' '}
                {formatMoney(item.remaining_amount ?? '0', item.currency_code)}
              </p>
              {hasPermission('ahorros.gestionar') && item.status === 'active' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEditGoal(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setMoveGoalId(item.id)
                      setMoveAmount('')
                    }}
                  >
                    Aportar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (window.confirm(`¿Cancelar “${item.name}”?`)) cancelGoal.mutate(item.id)
                    }}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Cancelar
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </CardList>

        <Dialog
          open={goalDialog}
          onOpenChange={(open) => !open && setGoalDialog(false)}
          title={editingGoal ? 'Editar ahorro' : 'Nuevo ahorro'}
          footer={
            <Button disabled={saveGoal.isPending} onClick={() => saveGoal.mutate()}>
              {saveGoal.isPending ? 'Guardando…' : editingGoal ? 'Guardar cambios' : 'Crear ahorro'}
            </Button>
          }
        >
          <FormField
            label="Nombre"
            tooltip="Nombre del objetivo (por ejemplo Vacaciones, Fondo emergencia o Remodelación)."
          >
            <Input
              value={goalForm.name}
              onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
            />
          </FormField>
          <FormField
            label="Tipo"
            tooltip="Objetivo: meta libre. Fondo de emergencia: se calcula con meses × promedio de gastos esenciales."
          >
            <Select
              value={goalForm.kind}
              onValueChange={(v) => setGoalForm({ ...goalForm, kind: v as 'goal' | 'emergency' })}
              options={[
                { value: 'goal', label: 'Objetivo' },
                { value: 'emergency', label: 'Fondo de emergencia' },
              ]}
            />
          </FormField>
          {goalForm.kind === 'goal' ? (
            <FormField
              label="Meta"
              tooltip="Monto total que quieres alcanzar. El progreso se calcula con los aportes."
            >
              <MoneyInput
                value={goalForm.target_amount}
                onChange={(v) => setGoalForm({ ...goalForm, target_amount: v })}
              />
            </FormField>
          ) : (
            <FormField
              label="Meses de cobertura"
              tooltip="Cuántos meses de gastos esenciales quieres cubrir. La meta se calcula automáticamente."
            >
              <Input
                type="number"
                value={goalForm.emergency_months}
                onChange={(e) => setGoalForm({ ...goalForm, emergency_months: e.target.value })}
              />
            </FormField>
          )}
        </Dialog>

        <Dialog
          open={moveGoalId !== null}
          onOpenChange={(open) => !open && setMoveGoalId(null)}
          title="Registrar aporte"
          footer={
            <Button
              disabled={moveSavings.isPending || !moveAmount}
              onClick={() => moveSavings.mutate()}
            >
              {moveSavings.isPending ? 'Registrando…' : 'Confirmar aporte'}
            </Button>
          }
        >
          <FormField
            label="Monto del aporte"
            tooltip="Cantidad que sumas ahora al objetivo. Aumenta el saldo actual del ahorro."
          >
            <MoneyInput value={moveAmount} onChange={setMoveAmount} />
          </FormField>
        </Dialog>
      </Panel>
    )
  }

  if (tab === 'budgets') {
    return (
      <Panel title="Presupuesto y flujo de caja">
        <Alert className="mb-4">
          Crea presupuestos por período y categoría. El flujo de caja resume ingresos y gastos del
          mes.
        </Alert>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <FormField
            label="Mes y año"
            tooltip="Elige el mes del flujo de caja y del cierre mensual."
          >
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            {hasPermission('cierres.ejecutar') ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={closePeriod.isPending}
                onClick={() => closePeriod.mutate()}
              >
                Cerrar período
              </Button>
            ) : null}
            {hasPermission('presupuestos.gestionar') ? (
              <Button size="sm" onClick={openCreateBudget}>
                <Plus className="h-4 w-4" />
                Nuevo presupuesto
              </Button>
            ) : null}
          </div>
        </div>
        <Alert className="mb-4">
          Flujo {period}: ingresos{' '}
          {formatMoney(cashFlow.data?.data.income_total ?? '0', currency)} · gastos{' '}
          {formatMoney(cashFlow.data?.data.expense_total ?? '0', currency)} · neto{' '}
          <strong>{formatMoney(cashFlow.data?.data.net ?? '0', currency)}</strong>
        </Alert>
        {cashFlow.data?.data.warnings.length ? (
          <Alert tone="danger" className="mb-4">
            {cashFlow.data.data.warnings.map((w) => (
              <p key={w.date}>
                {formatDate(w.date)}: {w.message}
              </p>
            ))}
          </Alert>
        ) : null}
        <CardList empty="No hay presupuestos">
          {budgets.data?.data.map((item) => (
            <Card
              key={item.id}
              title={`${item.name} · ${item.period}`}
              status={budgetStatusLabel(item.status)}
              statusTone={statusTone(item.status)}
            >
              {item.lines.map((line) => (
                <p key={line.id} className="text-sm">
                  {line.category?.name ?? `Cat #${line.category_id}`}:{' '}
                  {formatMoney(line.planned_amount, item.currency_code)}
                </p>
              ))}
              {hasPermission('presupuestos.gestionar') && item.status === 'open' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEditBudget(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (window.confirm(`¿Cancelar “${item.name}”?`)) cancelBudget.mutate(item.id)
                    }}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Cancelar
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </CardList>

        <Dialog
          open={budgetDialog}
          onOpenChange={(open) => !open && setBudgetDialog(false)}
          title={editingBudget ? 'Editar presupuesto' : 'Nuevo presupuesto'}
          footer={
            <Button disabled={saveBudget.isPending} onClick={() => saveBudget.mutate()}>
              {saveBudget.isPending
                ? 'Guardando…'
                : editingBudget
                  ? 'Guardar cambios'
                  : 'Crear presupuesto'}
            </Button>
          }
        >
          <FormField
            label="Nombre"
            tooltip="Nombre del presupuesto (por ejemplo Presupuesto hogar agosto)."
          >
            <Input
              value={budgetForm.name}
              onChange={(e) => setBudgetForm({ ...budgetForm, name: e.target.value })}
            />
          </FormField>
          {!editingBudget ? (
            <FormField
              label="Mes y año"
              tooltip="Mes al que aplica este presupuesto."
            >
              <Input
                type="month"
                value={budgetForm.period}
                onChange={(e) => setBudgetForm({ ...budgetForm, period: e.target.value })}
              />
            </FormField>
          ) : null}
          <FormField
            label="Categoría"
            tooltip="Categoría de gasto a la que asignas el monto planeado (por ejemplo Alimentación)."
          >
            <Select
              value={budgetForm.category_id}
              onValueChange={(v) => setBudgetForm({ ...budgetForm, category_id: v })}
              options={expenseCats.map((c) => ({ value: String(c.id), label: c.name }))}
            />
          </FormField>
          <FormField
            label="Monto planeado"
            tooltip="Tope presupuestado para esa categoría en el período. Se compara con gastos comprometidos."
          >
            <MoneyInput
              value={budgetForm.planned_amount}
              onChange={(v) => setBudgetForm({ ...budgetForm, planned_amount: v })}
            />
          </FormField>
        </Dialog>
      </Panel>
    )
  }

  if (tab === 'settlements') {
    return (
      <Panel title="Compensaciones">
        <Alert className="mb-4">
          Quien “debe” paga a quien “adelantó”. Ajusta el saldo interno sin crear deuda bancaria.
        </Alert>
        <Toolbar
          allowed={hasPermission('gastos.ver_propios') || hasPermission('gastos.ver_compartidos')}
          onAdd={() => {
            setSettleForm(emptySettle())
            setSettleDialog(true)
          }}
          label="Nueva compensación"
        />
        <CardList empty="No hay compensaciones">
          {settlements.data?.data.map((s) => (
            <Card
              key={s.id}
              title={`${s.from_membership?.user?.name ?? '—'} → ${s.to_membership?.user?.name ?? '—'}`}
              status="Registrada"
              statusTone="success"
            >
              <strong>{formatMoney(s.amount, s.currency_code)}</strong>
              <p className="text-xs">{formatDate(s.settled_on)}</p>
            </Card>
          ))}
        </CardList>

        <Dialog
          open={settleDialog}
          onOpenChange={(open) => !open && setSettleDialog(false)}
          title="Nueva compensación"
          footer={
            <Button disabled={settle.isPending} onClick={() => settle.mutate()}>
              {settle.isPending ? 'Guardando…' : 'Registrar compensación'}
            </Button>
          }
        >
          <FormField
            label="Paga (quien debe)"
            tooltip="Integrante que cubre su parte pendiente. Suele ser quien aparece como “debe” en saldos internos."
          >
            <Select
              value={settleForm.from_membership_id}
              onValueChange={(v) => setSettleForm({ ...settleForm, from_membership_id: v })}
              options={members.map((m) => ({ value: String(m.id), label: m.user.name }))}
            />
          </FormField>
          <FormField
            label="Recibe (quien adelantó)"
            tooltip="Integrante que había pagado de más. Suele ser quien aparece como “adelantó” en saldos internos."
          >
            <Select
              value={settleForm.to_membership_id}
              onValueChange={(v) => setSettleForm({ ...settleForm, to_membership_id: v })}
              options={members.map((m) => ({ value: String(m.id), label: m.user.name }))}
            />
          </FormField>
          <FormField
            label="Monto"
            tooltip="Monto de la compensación entre ambos. Ajusta el saldo interno; no crea una deuda bancaria."
          >
            <MoneyInput
              value={settleForm.amount}
              onChange={(v) => setSettleForm({ ...settleForm, amount: v })}
            />
          </FormField>
        </Dialog>
      </Panel>
    )
  }

  return (
    <Panel title="Reportes y auditoría">
      <Alert className="mb-4">
        Exporta un Excel (.xlsx) con todos los movimientos del mes (ingresos, gastos, pagos, deudas,
        compensaciones, ahorros) y la auditoría del período.
      </Alert>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <FormField
          label="Mes y año"
          tooltip="Mes del reporte Excel y del resumen."
        >
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </FormField>
        {hasPermission('datos.exportar') ? (
          <Button size="sm" onClick={() => void exportXlsx()}>
            <Download className="h-4 w-4" /> Exportar Excel
          </Button>
        ) : null}
      </div>

      {cashFlow.data?.data ? (
        <Alert className="mb-4">
          Resumen {period}: ingresos{' '}
          {formatMoney(cashFlow.data.data.income_total, currency)} · gastos{' '}
          {formatMoney(cashFlow.data.data.expense_total, currency)} · neto{' '}
          <strong>{formatMoney(cashFlow.data.data.net, currency)}</strong>
        </Alert>
      ) : null}

      {hasPermission('auditoria.ver') ? (
        <>
          <h3 className="mb-2 font-black">Auditoría reciente</h3>
          <div className="space-y-1 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            {audit.data?.data.length ? (
              audit.data.data.map((log) => (
                <p key={log.id} className="text-xs text-slate-600">
                  {formatDateTime(log.created_at)} · {log.actor?.name ?? 'Sistema'} · {log.action}
                </p>
              ))
            ) : (
              <p className="text-sm text-slate-500">No hay eventos de auditoría</p>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          No tienes permiso para ver la auditoría. Puedes exportar Excel si tienes acceso a datos.
        </p>
      )}
    </Panel>
  )
}
