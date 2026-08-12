import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  PiggyBank,
  Receipt,
  Scale,
  Shield,
  ShoppingBasket,
  TrendingDown,
  TrendingUp,
  Wallet,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Alert, Badge, Button, Panel } from '../../design-system'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { api } from '../../services/api'
import type { Recurrence } from '../../services/types'
import { useAuth } from '../auth/useAuth'
import {
  debtStatusLabel,
  expenseStatusLabel,
  expenseStatusTone,
  frequencyLabel,
  incomeStatusLabel,
  recurrenceKindLabel,
  savingsStatusLabel,
} from '../finance/labels'

function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function inPeriod(date: string | null | undefined, period: string) {
  return Boolean(date && date.startsWith(period))
}

function isDueOrOverdue(date: string | null | undefined, today: string) {
  return Boolean(date && date <= today)
}

function financePath(householdId: number, tab: string) {
  return `/app/households/${householdId}/finance?tab=${encodeURIComponent(tab)}`
}

type DashAlert = {
  id: string
  tone: 'info' | 'danger' | 'success'
  title: string
  detail: string
  href: string
}

export function HouseholdDashboardPage() {
  const { householdId } = useParams()
  const id = Number(householdId)
  const { user, households, hasPermission, logout, setCurrentHouseholdId } = useAuth()
  const navigate = useNavigate()
  const household = households.find((item) => item.id === id)
  const period = currentPeriod()
  const today = todayIso()
  const currency = household?.currency_code ?? 'COP'

  useEffect(() => {
    if (Number.isFinite(id)) setCurrentHouseholdId(id)
  }, [id, setCurrentHouseholdId])

  const canIncomes =
    hasPermission('ingresos.ver_propios') || hasPermission('ingresos.ver_compartidos')
  const canExpenses =
    hasPermission('gastos.ver_propios') || hasPermission('gastos.ver_compartidos')
  const canRecurrences = hasPermission('recurrencias.ver')
  const canDebts = hasPermission('deudas.ver_propias') || hasPermission('deudas.ver_compartidas')
  const canSavings =
    hasPermission('ahorros.ver_propios') || hasPermission('ahorros.ver_compartidos')
  const canBudgets = hasPermission('presupuestos.ver')
  const canBalances = canExpenses
  const canAudit = hasPermission('auditoria.ver')
  const canAccounts = hasPermission('cuentas.ver')

  const incomes = useQuery({
    queryKey: ['incomes', id],
    queryFn: () => api.incomes(id),
    enabled: Number.isFinite(id) && canIncomes,
  })
  const expenses = useQuery({
    queryKey: ['expenses', id],
    queryFn: () => api.expenses(id),
    enabled: Number.isFinite(id) && canExpenses,
  })
  const recurrences = useQuery({
    queryKey: ['recurrences', id],
    queryFn: () => api.recurrences(id),
    enabled: Number.isFinite(id) && canRecurrences,
  })
  const balances = useQuery({
    queryKey: ['balances', id],
    queryFn: () => api.balances(id),
    enabled: Number.isFinite(id) && canBalances,
  })
  const debts = useQuery({
    queryKey: ['debts', id],
    queryFn: () => api.debts(id),
    enabled: Number.isFinite(id) && canDebts,
  })
  const savings = useQuery({
    queryKey: ['savings', id],
    queryFn: () => api.savingsGoals(id),
    enabled: Number.isFinite(id) && canSavings,
  })
  const budgets = useQuery({
    queryKey: ['budgets', id],
    queryFn: () => api.budgets(id),
    enabled: Number.isFinite(id) && canBudgets,
  })
  const cashFlow = useQuery({
    queryKey: ['cashflow', id, period],
    queryFn: () => api.cashFlow(id, period),
    enabled: Number.isFinite(id) && (canIncomes || canExpenses),
  })
  const settlements = useQuery({
    queryKey: ['settlements', id],
    queryFn: () => api.settlements(id),
    enabled: Number.isFinite(id) && canExpenses,
  })
  const audit = useQuery({
    queryKey: ['audit', id],
    queryFn: () => api.auditLogs(id),
    enabled: Number.isFinite(id) && canAudit,
  })
  const accounts = useQuery({
    queryKey: ['accounts', id],
    queryFn: () => api.accounts(id),
    enabled: Number.isFinite(id) && canAccounts,
  })

  const incomeList = incomes.data?.data ?? []
  const expenseList = expenses.data?.data ?? []
  const recurrenceList = recurrences.data?.data ?? []
  const debtList = debts.data?.data ?? []
  const savingsList = savings.data?.data ?? []
  const budgetList = budgets.data?.data ?? []
  const balanceList = balances.data?.data ?? []
  const settlementList = settlements.data?.data ?? []
  const auditList = audit.data?.data ?? []
  const accountList = accounts.data?.data ?? []
  const flow = cashFlow.data?.data

  const monthIncomes = useMemo(
    () =>
      incomeList.filter(
        (i) =>
          inPeriod(i.effective_on, period) ||
          (i.status === 'expected' && inPeriod(i.expected_on, period)),
      ),
    [incomeList, period],
  )
  const monthExpenses = useMemo(
    () => expenseList.filter((e) => inPeriod(e.occurred_on, period) && e.status !== 'cancelled'),
    [expenseList, period],
  )
  const pendingExpenses = useMemo(
    () =>
      expenseList.filter(
        (e) =>
          (e.status === 'committed' || e.status === 'partial' || e.status === 'planned') &&
          Number(e.pending_amount) > 0,
      ),
    [expenseList],
  )
  const expectedIncomes = useMemo(
    () => incomeList.filter((i) => i.status === 'expected'),
    [incomeList],
  )
  const dueRecurrences = useMemo(
    () =>
      recurrenceList.filter(
        (r) => r.is_active && isDueOrOverdue(r.next_occurrence_on, today),
      ),
    [recurrenceList, today],
  )
  const upcomingRecurrences = useMemo(
    () =>
      recurrenceList
        .filter((r) => r.is_active && r.next_occurrence_on > today)
        .slice()
        .sort((a, b) => a.next_occurrence_on.localeCompare(b.next_occurrence_on))
        .slice(0, 5),
    [recurrenceList, today],
  )
  const dueDebts = useMemo(
    () =>
      debtList.filter(
        (d) => d.status === 'active' && isDueOrOverdue(d.next_payment_on, today),
      ),
    [debtList, today],
  )
  const generatedAlerts = useMemo(() => {
    return auditList
      .filter((log) => log.action === 'recurrence.generated')
      .slice(0, 8)
  }, [auditList])
  const programmedGenerated = useMemo(() => {
    const incomesGen = monthIncomes.filter(
      (i) =>
        i.status !== 'cancelled' &&
        (Boolean(i.recurrence_template_id) || i.frequency !== 'once'),
    )
    const expensesGen = monthExpenses.filter(
      (e) =>
        Boolean(e.recurrence_template_id) ||
        e.frequency !== 'once' ||
        e.status === 'planned',
    )
    return { incomesGen, expensesGen }
  }, [monthIncomes, monthExpenses])

  const alerts = useMemo(() => {
    const items: DashAlert[] = []

    for (const r of dueRecurrences) {
      items.push({
        id: `rec-due-${r.id}`,
        tone: 'danger',
        title: 'Recurrencia pendiente de generar',
        detail: `${recurrenceKindLabel(r.kind)} ${frequencyLabel(r.frequency)} · vencía el ${formatDate(r.next_occurrence_on)}`,
        href: financePath(id, 'recurrences'),
      })
    }

    for (const log of generatedAlerts) {
      items.push({
        id: `rec-gen-${log.id}`,
        tone: 'success',
        title: 'Programación generada en el núcleo',
        detail: `${formatDateTime(log.created_at)} · ${log.actor?.name ?? 'Sistema'} · recurrence.generated`,
        href: financePath(id, 'recurrences'),
      })
    }

    for (const e of pendingExpenses.slice(0, 6)) {
      items.push({
        id: `exp-${e.id}`,
        tone: e.status === 'planned' ? 'info' : 'danger',
        title:
          e.status === 'planned'
            ? 'Gasto programado sin comprometer'
            : 'Gasto con saldo pendiente',
        detail: `${e.category?.name ?? 'Gasto'} · ${expenseStatusLabel(e.status)} · pendiente ${formatMoney(e.pending_amount, e.currency_code)} · ${formatDate(e.occurred_on)}`,
        href: financePath(id, 'expenses'),
      })
    }

    for (const i of expectedIncomes.filter((x) => isDueOrOverdue(x.expected_on, today)).slice(0, 5)) {
      items.push({
        id: `inc-${i.id}`,
        tone: 'info',
        title: 'Ingreso esperado pendiente de recibir',
        detail: `${i.category?.name ?? 'Ingreso'} · ${formatMoney(i.net_amount, i.currency_code)} · esperado ${formatDate(i.expected_on)}`,
        href: financePath(id, 'incomes'),
      })
    }

    for (const d of dueDebts) {
      items.push({
        id: `debt-${d.id}`,
        tone: 'danger',
        title: 'Cuota de deuda vencida o por pagar hoy',
        detail: `${d.name} (${d.creditor_name}) · mín. ${formatMoney(d.minimum_payment, d.currency_code)} · ${formatDate(d.next_payment_on)}`,
        href: financePath(id, 'debts'),
      })
    }

    for (const b of balanceList.filter((x) => x.meaning === 'debe').slice(0, 5)) {
      items.push({
        id: `bal-${b.membership_id}`,
        tone: 'info',
        title: `${b.name} debe en saldos internos`,
        detail: `Neto ${formatMoney(b.net_internal_balance, currency)} · conviene compensar`,
        href: financePath(id, 'settlements'),
      })
    }

    for (const w of flow?.warnings ?? []) {
      items.push({
        id: `cf-${w.date}`,
        tone: 'danger',
        title: 'Flujo de caja en alerta',
        detail: `${formatDate(w.date)} · ${w.message}`,
        href: financePath(id, 'budgets'),
      })
    }

    const openBudget = budgetList.find((b) => b.period === period && b.status === 'open')
    if (!openBudget && canBudgets) {
      items.push({
        id: 'budget-missing',
        tone: 'info',
        title: 'Sin presupuesto abierto este mes',
        detail: `No hay presupuesto abierto para ${period}.`,
        href: financePath(id, 'budgets'),
      })
    }

    return items
  }, [
    dueRecurrences,
    generatedAlerts,
    pendingExpenses,
    expectedIncomes,
    dueDebts,
    balanceList,
    flow?.warnings,
    budgetList,
    canBudgets,
    period,
    today,
    id,
    currency,
  ])

  if (!household) {
    return <Navigate to="/app" replace />
  }

  const activeDebts = debtList.filter((d) => d.status === 'active')
  const debtTotal = activeDebts.reduce((s, d) => s + Number(d.current_balance), 0)
  const savingsTotal = savingsList
    .filter((g) => g.status === 'active')
    .reduce((s, g) => s + Number(g.current_amount), 0)
  const pendingExpenseTotal = pendingExpenses.reduce((s, e) => s + Number(e.pending_amount), 0)

  return (
    <main className="min-h-screen bg-stone-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border-t-8 border-brand-500 bg-white p-6 shadow-panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-600">
                Dashboard del hogar
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-900">{household.name}</h1>
              <p className="mt-1 font-semibold text-slate-500">
                {user?.name} · Resumen de {period} · datos del núcleo financiero
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => navigate(financePath(id, 'accounts'))}>
                <WalletCards className="h-4 w-4" />
                Núcleo financiero
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/app/households/${id}/market`)}
              >
                <ShoppingBasket className="h-4 w-4" />
                Lista de mercado
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/app/households/${id}/admin`)}
              >
                <Shield className="h-4 w-4" />
                Administración
              </Button>
              <Button
                type="button"
                variant="outline"
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

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
            label="Ingresos del mes"
            value={flow ? formatMoney(flow.income_total, currency) : '—'}
            hint={`${monthIncomes.length} registros`}
          />
          <StatCard
            icon={<TrendingDown className="h-5 w-5 text-rose-600" />}
            label="Gastos del mes"
            value={flow ? formatMoney(flow.expense_total, currency) : '—'}
            hint={`${monthExpenses.length} registros`}
          />
          <StatCard
            icon={<Wallet className="h-5 w-5 text-brand-600" />}
            label="Neto del mes"
            value={flow ? formatMoney(flow.net, currency) : '—'}
            hint={flow && Number(flow.net) < 0 ? 'Déficit' : 'Balance'}
          />
          <StatCard
            icon={<Receipt className="h-5 w-5 text-amber-600" />}
            label="Pendiente por pagar"
            value={formatMoney(String(pendingExpenseTotal.toFixed(4)), currency)}
            hint={`${pendingExpenses.length} gastos`}
          />
        </section>

        <Panel title="Alertas y programaciones">
          <p className="mb-4 text-sm font-semibold text-slate-500">
            Incluye recurrencias vencidas, programaciones ya generadas en el núcleo, pagos
            pendientes, deudas y saldos internos.
          </p>
          {alerts.length === 0 ? (
            <Alert tone="success">Sin alertas urgentes por ahora.</Alert>
          ) : (
            <ul className="space-y-3">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <Alert tone={alert.tone} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                      <div>
                        <p className="font-black">{alert.title}</p>
                        <p className="mt-0.5 text-xs opacity-90">{alert.detail}</p>
                      </div>
                    </div>
                    <Link
                      to={alert.href}
                      className="inline-flex items-center gap-1 text-xs font-black underline-offset-2 hover:underline"
                    >
                      Ir al núcleo <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Alert>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Programación generada este mes">
            <p className="mb-3 text-sm font-semibold text-slate-500">
              Movimientos del mes con origen programado o frecuencia recurrente.
            </p>
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-black text-slate-700">Ingresos</h3>
                <ItemList
                  empty="No hay ingresos programados este mes"
                  items={programmedGenerated.incomesGen.slice(0, 6).map((i) => ({
                    key: `i-${i.id}`,
                    title: i.category?.name ?? 'Ingreso',
                    meta: `${incomeStatusLabel(i.status)} · ${formatMoney(i.net_amount, i.currency_code)} · ${formatDate(i.effective_on ?? i.expected_on)}`,
                    tone: i.status === 'received' ? 'success' : 'warning',
                    badge: incomeStatusLabel(i.status),
                  }))}
                />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-black text-slate-700">Gastos</h3>
                <ItemList
                  empty="No hay gastos programados este mes"
                  items={programmedGenerated.expensesGen.slice(0, 6).map((e) => ({
                    key: `e-${e.id}`,
                    title: e.category?.name ?? 'Gasto',
                    meta: `${expenseStatusLabel(e.status)} · ${formatMoney(e.amount, e.currency_code)} · ${formatDate(e.occurred_on)}`,
                    tone: expenseStatusTone(e.status),
                    badge: expenseStatusLabel(e.status),
                  }))}
                />
              </div>
            </div>
            <div className="mt-4">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(financePath(id, 'recurrences'))}
              >
                <CalendarClock className="h-4 w-4" /> Ver recurrencias
              </Button>
            </div>
          </Panel>

          <Panel title="Próximas recurrencias">
            {dueRecurrences.length > 0 ? (
              <Alert tone="danger" className="mb-3">
                {dueRecurrences.length} recurrencia(s) con fecha de generación vencida o de hoy.
              </Alert>
            ) : null}
            <ItemList
              empty="No hay recurrencias activas próximas"
              items={[...dueRecurrences, ...upcomingRecurrences]
                .slice(0, 8)
                .map((r: Recurrence) => ({
                  key: `r-${r.id}`,
                  title: `${recurrenceKindLabel(r.kind)} · ${frequencyLabel(r.frequency)}`,
                  meta: `Próxima: ${formatDate(r.next_occurrence_on)}`,
                  tone: isDueOrOverdue(r.next_occurrence_on, today) ? 'danger' : 'neutral',
                  badge: isDueOrOverdue(r.next_occurrence_on, today) ? 'Vencida' : 'Programada',
                }))}
            />
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Deudas activas">
            <p className="mb-3 text-sm font-black text-slate-800">
              Total {formatMoney(String(debtTotal.toFixed(4)), currency)}
            </p>
            <ItemList
              empty="Sin deudas activas"
              items={activeDebts.slice(0, 6).map((d) => ({
                key: `d-${d.id}`,
                title: d.name,
                meta: `${d.creditor_name} · ${formatMoney(d.current_balance, d.currency_code)}${d.next_payment_on ? ` · próximo ${formatDate(d.next_payment_on)}` : ''}`,
                tone: dueDebts.some((x) => x.id === d.id) ? 'danger' : 'warning',
                badge: debtStatusLabel(d.status),
              }))}
            />
            <QuickLink to={financePath(id, 'debts')} label="Abrir deudas" />
          </Panel>

          <Panel title="Ahorros">
            <p className="mb-3 text-sm font-black text-slate-800">
              Acumulado {formatMoney(String(savingsTotal.toFixed(4)), currency)}
            </p>
            <ItemList
              empty="Sin metas de ahorro"
              items={savingsList
                .filter((g) => g.status === 'active')
                .slice(0, 6)
                .map((g) => ({
                  key: `s-${g.id}`,
                  title: g.name,
                  meta: `${formatMoney(g.current_amount, g.currency_code)} de ${formatMoney(g.target_amount, g.currency_code)}${g.progress_percent ? ` · ${g.progress_percent}%` : ''}`,
                  tone: 'success',
                  badge: savingsStatusLabel(g.status),
                }))}
            />
            <QuickLink to={financePath(id, 'savings')} label="Abrir ahorros" />
          </Panel>

          <Panel title="Saldos internos">
            <ItemList
              empty="Sin saldos internos"
              items={balanceList.slice(0, 8).map((b) => ({
                key: `b-${b.membership_id}`,
                title: b.name,
                meta: `${b.meaning} · ${formatMoney(b.net_internal_balance, currency)}`,
                tone: b.meaning === 'debe' ? 'warning' : 'success',
                badge: b.meaning,
              }))}
            />
            <QuickLink to={financePath(id, 'balances')} label="Ver saldos" />
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Presupuesto y flujo">
            <div className="mb-4 space-y-2 text-sm font-semibold text-slate-600">
              <p className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-brand-600" />
                Flujo {period}: ingresos{' '}
                {flow ? formatMoney(flow.income_total, currency) : '—'} · gastos{' '}
                {flow ? formatMoney(flow.expense_total, currency) : '—'}
              </p>
              {(flow?.warnings.length ?? 0) > 0 ? (
                <Alert tone="danger">
                  {flow!.warnings.length} aviso(s) de saldo proyectado negativo.
                </Alert>
              ) : (
                <Alert tone="success">Sin avisos de flujo negativo este mes.</Alert>
              )}
            </div>
            <ItemList
              empty="Sin presupuestos"
              items={budgetList
                .filter((b) => b.period === period)
                .map((b) => ({
                  key: `bu-${b.id}`,
                  title: b.name,
                  meta: `${b.lines.length} líneas · ${b.scope}`,
                  tone: b.status === 'open' ? 'success' : 'neutral',
                  badge: b.status === 'open' ? 'Abierto' : 'Cerrado',
                }))}
            />
            <QuickLink to={financePath(id, 'budgets')} label="Abrir presupuesto" />
          </Panel>

          <Panel title="Compensaciones y cuentas">
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-black text-slate-700">Últimas compensaciones</h3>
              <ItemList
                empty="Sin compensaciones"
                items={settlementList.slice(0, 5).map((s) => ({
                  key: `st-${s.id}`,
                  title: `${s.from_membership?.user?.name ?? '—'} → ${s.to_membership?.user?.name ?? '—'}`,
                  meta: `${formatMoney(s.amount, s.currency_code)} · ${formatDate(s.settled_on)}`,
                  tone: 'neutral',
                  badge: 'Registrada',
                }))}
              />
            </div>
            {canAccounts ? (
              <div>
                <h3 className="mb-2 text-sm font-black text-slate-700">Cuentas</h3>
                <ItemList
                  empty="Sin cuentas"
                  items={accountList.slice(0, 5).map((a) => ({
                    key: `a-${a.id}`,
                    title: a.name,
                    meta: a.is_active ? 'Activa' : 'Inactiva',
                    tone: a.is_active ? 'success' : 'neutral',
                    badge: a.type,
                  }))}
                />
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <QuickLink to={financePath(id, 'settlements')} label="Compensaciones" />
              <QuickLink to={financePath(id, 'reports')} label="Reportes" />
            </div>
          </Panel>
        </div>

        {canAudit ? (
          <Panel title="Actividad reciente del núcleo">
            <ItemList
              empty="Sin eventos de auditoría"
              items={auditList.slice(0, 10).map((log) => ({
                key: `au-${log.id}`,
                title: log.action,
                meta: `${formatDateTime(log.created_at)} · ${log.actor?.name ?? 'Sistema'}`,
                tone: log.action.includes('generated') ? 'success' : 'neutral',
                badge: log.action.includes('generated') ? 'Generado' : 'Evento',
              }))}
            />
          </Panel>
        ) : null}

        <p className="flex items-center justify-center gap-2 pb-4 text-xs font-semibold text-slate-400">
          <PiggyBank className="h-4 w-4" />
          La información se calcula en vivo desde el núcleo financiero
        </p>
      </div>
    </main>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-panel">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-400">{hint}</p>
    </div>
  )
}

function ItemList({
  items,
  empty,
}: {
  empty: string
  items: {
    key: string
    title: string
    meta: string
    badge: string
    tone: 'neutral' | 'success' | 'warning' | 'danger'
  }[]
}) {
  if (!items.length) {
    return <p className="text-sm font-semibold text-slate-400">{empty}</p>
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.key}
          className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-800">{item.title}</p>
            <p className="text-xs font-semibold text-slate-500">{item.meta}</p>
          </div>
          <Badge tone={item.tone}>{item.badge}</Badge>
        </li>
      ))}
    </ul>
  )
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="mt-4 inline-flex items-center gap-1 text-sm font-black text-brand-600 hover:underline"
    >
      {label} <ArrowRight className="h-4 w-4" />
    </Link>
  )
}
