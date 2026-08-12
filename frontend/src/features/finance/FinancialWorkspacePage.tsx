import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, CheckCircle2, Pencil, Plus, Power, ReceiptText, WalletCards } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Controller, useForm, type UseFormReturn } from 'react-hook-form'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
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
import {
  allocateExpense,
  formatDecimal,
  formatMoney,
  parseDecimalInput,
  sumPercentages,
} from '../../lib/money'
import { formatDate, formatDateTime, dayOfMonthFromDate, nextDateForDayOfMonth, nextDateForWeekday, nextDateForQuincenaDay, weekdayFromDate, quincenaDayFromDate, WEEKDAY_OPTIONS, scheduleAnchorLabel } from '../../lib/dates'
import { ApiError, api } from '../../services/api'
import type {
  Expense,
  FinancialAccount,
  FinancialCategory,
  Income,
} from '../../services/types'
import { useAuth } from '../auth/useAuth'
import {
  accountTypeLabel,
  activeStatusTone,
  balanceMeaningTone,
  classificationLabel,
  expenseStatusLabel,
  expenseStatusTone,
  frequencyLabel,
  incomeKindLabel,
  incomeStatusLabel,
  incomeStatusTone,
  recurrenceKindLabel,
  scopeLabel,
} from './labels'
import { Phase3Panels } from './Phase3Panels'

const decimal = z
  .string()
  .transform((value, ctx) => {
    const parsed = parseDecimalInput(value, 4)
    if (!parsed || !/^\d{1,15}\.\d{4}$/.test(parsed)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Importe inválido (máximo 2 decimales)',
      })
      return z.NEVER
    }
    return parsed
  })

const accountSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['cash', 'savings', 'checking', 'credit_card']),
  currency_code: z.string().length(3),
  opening_balance: decimal,
  scope: z.enum(['individual', 'shared']),
  owner_membership_id: z.string(),
})
const categorySchema = z.object({
  name: z.string().min(2),
  type: z.enum(['income', 'expense']),
  classification: z.enum(['essential', 'discretionary', '']),
})
const incomeSchema = z
  .object({
    owner_membership_id: z.string().min(1),
    account_id: z.string(),
    category_id: z.string().min(1),
    kind: z.enum(['fixed', 'variable', 'extraordinary']),
    scope: z.enum(['individual', 'shared']),
    net_amount: decimal,
    currency_code: z.string().length(3),
    effective_on: z.string(),
    day_of_month: z.string(),
    weekday: z.string(),
    day_of_quincena: z.string(),
    frequency: z.enum(['once', 'weekly', 'biweekly', 'monthly']),
    notes: z.string(),
  })
  .superRefine((value, ctx) => {
    const frequency = value.kind === 'extraordinary' ? 'once' : value.frequency
    if (frequency === 'monthly') {
      const day = Number(value.day_of_month)
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        ctx.addIssue({
          code: 'custom',
          path: ['day_of_month'],
          message: 'Elige un día del 1 al 31',
        })
      }
      return
    }
    if (frequency === 'weekly') {
      const day = Number(value.weekday)
      if (!Number.isInteger(day) || day < 1 || day > 7) {
        ctx.addIssue({
          code: 'custom',
          path: ['weekday'],
          message: 'Elige un día de la semana',
        })
      }
      return
    }
    if (frequency === 'biweekly') {
      const day = Number(value.day_of_quincena)
      if (!Number.isInteger(day) || day < 1 || day > 15) {
        ctx.addIssue({
          code: 'custom',
          path: ['day_of_quincena'],
          message: 'Elige un día del 1 al 15 de la quincena',
        })
      }
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.effective_on)) {
      ctx.addIssue({
        code: 'custom',
        path: ['effective_on'],
        message: 'Selecciona una fecha',
      })
    }
  })
const receiveIncomeSchema = z.object({
  net_amount: decimal,
  effective_on: z.string().min(1),
  account_id: z.string(),
})
const expenseSchema = z
  .object({
    category_id: z.string().min(1),
    scope: z.enum(['individual', 'shared']),
    classification: z.enum(['essential', 'discretionary']),
    amount: decimal,
    currency_code: z.string().length(3),
    occurred_on: z.string(),
    day_of_month: z.string(),
    weekday: z.string(),
    day_of_quincena: z.string(),
    status: z.enum(['planned', 'committed']),
    notes: z.string(),
    frequency: z.enum(['once', 'weekly', 'biweekly', 'monthly']),
    shares: z
      .array(
        z.object({
          membership_id: z.number(),
          percentage: decimal,
        }),
      )
      .min(1),
  })
  .superRefine((value, ctx) => {
    if (
      sumPercentages(value.shares.map((share) => share.percentage)) !==
      '100.0000'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['shares'],
        message: 'Los porcentajes deben sumar exactamente 100%',
      })
    }
    if (value.frequency === 'monthly') {
      const day = Number(value.day_of_month)
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        ctx.addIssue({
          code: 'custom',
          path: ['day_of_month'],
          message: 'Elige un día del 1 al 31',
        })
      }
      return
    }
    if (value.frequency === 'weekly') {
      const day = Number(value.weekday)
      if (!Number.isInteger(day) || day < 1 || day > 7) {
        ctx.addIssue({
          code: 'custom',
          path: ['weekday'],
          message: 'Elige un día de la semana',
        })
      }
      return
    }
    if (value.frequency === 'biweekly') {
      const day = Number(value.day_of_quincena)
      if (!Number.isInteger(day) || day < 1 || day > 15) {
        ctx.addIssue({
          code: 'custom',
          path: ['day_of_quincena'],
          message: 'Elige un día del 1 al 15 de la quincena',
        })
      }
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.occurred_on)) {
      ctx.addIssue({
        code: 'custom',
        path: ['occurred_on'],
        message: 'Selecciona una fecha',
      })
    }
  })
const commitExpenseSchema = z.object({
  amount: decimal,
  occurred_on: z.string().min(1),
})
const paymentSchema = z.object({
  payer_membership_id: z.string().min(1),
  account_id: z.string().min(1),
  amount: decimal,
  paid_on: z.string().min(1),
  notes: z.string(),
})

type Tab =
  | 'accounts'
  | 'categories'
  | 'incomes'
  | 'expenses'
  | 'balances'
  | 'recurrences'
  | 'debts'
  | 'savings'
  | 'budgets'
  | 'settlements'
  | 'reports'

type AccountForm = z.infer<typeof accountSchema>
type CategoryForm = z.infer<typeof categorySchema>
type IncomeForm = z.infer<typeof incomeSchema>
type ReceiveIncomeForm = z.infer<typeof receiveIncomeSchema>
type ExpenseForm = z.infer<typeof expenseSchema>
type CommitExpenseForm = z.infer<typeof commitExpenseSchema>
type PaymentForm = z.infer<typeof paymentSchema>

const TAB_KEYS: Tab[] = [
  'accounts',
  'categories',
  'incomes',
  'expenses',
  'balances',
  'recurrences',
  'debts',
  'savings',
  'budgets',
  'settlements',
  'reports',
]

function tabFromParam(value: string | null): Tab {
  return TAB_KEYS.includes(value as Tab) ? (value as Tab) : 'accounts'
}

export function FinancialWorkspacePage() {
  const { householdId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const id = Number(householdId)
  const { households, hasPermission, setCurrentHouseholdId } = useAuth()
  const household = households.find((item) => item.id === id)
  const queryClient = useQueryClient()
  const [tab, setTabState] = useState<Tab>(() => tabFromParam(searchParams.get('tab')))
  const setTab = (next: Tab) => {
    setTabState(next)
    setSearchParams(next === 'accounts' ? {} : { tab: next }, { replace: true })
  }
  const [dialog, setDialog] = useState<'account' | 'category' | 'income' | 'expense' | null>(null)
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null)
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [receivingIncome, setReceivingIncome] = useState<Income | null>(null)
  const [incomeView, setIncomeView] = useState<'planned' | 'received'>('planned')
  const [expenseView, setExpenseView] = useState<'planned' | 'committed'>('planned')
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [committingExpense, setCommittingExpense] = useState<Expense | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (Number.isFinite(id)) setCurrentHouseholdId(id)
  }, [id, setCurrentHouseholdId])

  const accountDefaults = (): AccountForm => ({
    name: '',
    type: 'checking',
    currency_code: household?.currency_code ?? 'COP',
    opening_balance: '0.0000',
    scope: 'individual',
    owner_membership_id: '',
  })

  const categoryDefaults = (): CategoryForm => ({
    name: '',
    type: 'expense',
    classification: 'essential',
  })

  const incomeDefaults = (): IncomeForm => ({
    owner_membership_id: '',
    account_id: '',
    category_id: '',
    kind: 'fixed',
    scope: 'individual',
    net_amount: '',
    currency_code: household?.currency_code ?? 'COP',
    effective_on: new Date().toISOString().slice(0, 10),
    day_of_month: '5',
    weekday: '1',
    day_of_quincena: '1',
    frequency: 'monthly',
    notes: '',
  })

  const enabled = Boolean(household)
  const accounts = useQuery({ queryKey: ['accounts', id], queryFn: () => api.accounts(id), enabled })
  const categories = useQuery({ queryKey: ['categories', id], queryFn: () => api.categories(id), enabled })
  const members = useQuery({ queryKey: ['members', id], queryFn: () => api.members(id), enabled })
  const incomes = useQuery({
    queryKey: ['incomes', id],
    queryFn: () => api.incomes(id),
    enabled: enabled && hasPermission('ingresos.ver_propios'),
  })
  const expenses = useQuery({
    queryKey: ['expenses', id],
    queryFn: () => api.expenses(id),
    enabled: enabled && hasPermission('gastos.ver_propios'),
  })
  const balances = useQuery({ queryKey: ['balances', id], queryFn: () => api.balances(id), enabled })
  const recurrences = useQuery({
    queryKey: ['recurrences', id],
    queryFn: () => api.recurrences(id),
    enabled: enabled && hasPermission('recurrencias.ver'),
  })

  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: accountDefaults(),
  })
  const categoryForm = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: categoryDefaults(),
  })
  const incomeForm = useForm<IncomeForm>({
    resolver: zodResolver(incomeSchema),
    defaultValues: incomeDefaults(),
  })
  const receiveIncomeForm = useForm<ReceiveIncomeForm>({
    resolver: zodResolver(receiveIncomeSchema),
    defaultValues: {
      net_amount: '',
      effective_on: new Date().toISOString().slice(0, 10),
      account_id: '',
    },
  })
  const expenseDefaults = (mode: 'planned' | 'committed' = 'planned'): ExpenseForm => ({
    category_id: '',
    scope: 'shared',
    classification: 'essential',
    amount: '',
    currency_code: household?.currency_code ?? 'COP',
    occurred_on: new Date().toISOString().slice(0, 10),
    day_of_month: '5',
    weekday: '1',
    day_of_quincena: '1',
    status: mode === 'planned' ? 'planned' : 'committed',
    notes: '',
    frequency: mode === 'planned' ? 'monthly' : 'once',
    shares: [],
  })
  const expenseForm = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: expenseDefaults('planned'),
  })
  const commitExpenseForm = useForm<CommitExpenseForm>({
    resolver: zodResolver(commitExpenseSchema),
    defaultValues: {
      amount: '',
      occurred_on: new Date().toISOString().slice(0, 10),
    },
  })
  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payer_membership_id: '',
      account_id: '',
      amount: '',
      paid_on: new Date().toISOString().slice(0, 10),
      notes: '',
    },
  })

  const fail = (reason: unknown) =>
    reason instanceof ApiError
      ? (Object.values(reason.body.errors ?? {})[0]?.[0] ?? reason.message)
      : 'No se pudo completar la operación'

  const refresh = async (keys: string[]) =>
    Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key, id] })))

  const closeAccountDialog = () => {
    setDialog(null)
    setEditingAccount(null)
    accountForm.reset(accountDefaults())
  }

  const openCreateAccount = () => {
    setEditingAccount(null)
    accountForm.reset(accountDefaults())
    setDialog('account')
  }

  const openEditAccount = (account: FinancialAccount) => {
    setEditingAccount(account)
    accountForm.reset({
      name: account.name,
      type: account.type,
      currency_code: account.currency_code,
      opening_balance: account.opening_balance,
      scope: account.scope,
      owner_membership_id: account.owner_membership_id
        ? String(account.owner_membership_id)
        : '',
    })
    setDialog('account')
  }

  const saveAccount = useMutation({
    mutationFn: async (values: AccountForm) => {
      const payload = {
        ...values,
        owner_membership_id: values.owner_membership_id
          ? Number(values.owner_membership_id)
          : null,
      }
      if (editingAccount) {
        return api.updateAccount(id, editingAccount.id, payload)
      }
      return api.createAccount(id, payload)
    },
    onSuccess: async (_data, values) => {
      const wasEdit = Boolean(editingAccount)
      await refresh(['accounts', 'balances'])
      closeAccountDialog()
      setError(null)
      toast.success(wasEdit ? 'Cuenta actualizada' : 'Cuenta guardada', {
        description: wasEdit
          ? `“${values.name}” se actualizó correctamente.`
          : `“${values.name}” se creó correctamente.`,
      })
    },
    onError: (reason) => {
      const message = fail(reason)
      setError(message)
      toast.error(
        editingAccount ? 'No se pudo actualizar la cuenta' : 'No se pudo guardar la cuenta',
        { description: message },
      )
    },
  })

  const toggleAccountActive = useMutation({
    mutationFn: (account: FinancialAccount) =>
      api.updateAccount(id, account.id, { is_active: !account.is_active }),
    onSuccess: async (_data, account) => {
      await refresh(['accounts'])
      setError(null)
      toast.success(account.is_active ? 'Cuenta desactivada' : 'Cuenta reactivada', {
        description: account.is_active
          ? `“${account.name}” ya no aparecerá como disponible para pagos.`
          : `“${account.name}” volvió a estar activa.`,
      })
    },
    onError: (reason) => {
      const message = fail(reason)
      setError(message)
      toast.error('No se pudo cambiar el estado de la cuenta', { description: message })
    },
  })

  const closeCategoryDialog = () => {
    setDialog(null)
    setEditingCategory(null)
    categoryForm.reset(categoryDefaults())
  }

  const openCreateCategory = () => {
    setEditingCategory(null)
    categoryForm.reset(categoryDefaults())
    setDialog('category')
  }

  const openEditCategory = (category: FinancialCategory) => {
    setEditingCategory(category)
    categoryForm.reset({
      name: category.name,
      type: category.type,
      classification: category.classification ?? 'essential',
    })
    setDialog('category')
  }

  const saveCategory = useMutation({
    mutationFn: async (values: CategoryForm) => {
      const payload = {
        ...values,
        classification: values.type === 'income' ? null : values.classification,
      }
      if (editingCategory) {
        return api.updateCategory(id, editingCategory.id, payload)
      }
      return api.createCategory(id, payload)
    },
    onSuccess: async (_data, values) => {
      const wasEdit = Boolean(editingCategory)
      await refresh(['categories'])
      closeCategoryDialog()
      setError(null)
      toast.success(wasEdit ? 'Categoría actualizada' : 'Categoría guardada', {
        description: wasEdit
          ? `“${values.name}” se actualizó correctamente.`
          : `“${values.name}” se creó correctamente.`,
      })
    },
    onError: (reason) => {
      const message = fail(reason)
      setError(message)
      toast.error(
        editingCategory
          ? 'No se pudo actualizar la categoría'
          : 'No se pudo guardar la categoría',
        { description: message },
      )
    },
  })

  const toggleCategoryActive = useMutation({
    mutationFn: (category: FinancialCategory) =>
      api.updateCategory(id, category.id, { is_active: !category.is_active }),
    onSuccess: async (_data, category) => {
      await refresh(['categories'])
      setError(null)
      toast.success(
        category.is_active ? 'Categoría desactivada' : 'Categoría reactivada',
        {
          description: category.is_active
            ? `“${category.name}” ya no estará disponible para nuevos movimientos.`
            : `“${category.name}” volvió a estar activa.`,
        },
      )
    },
    onError: (reason) => {
      const message = fail(reason)
      setError(message)
      toast.error('No se pudo cambiar el estado de la categoría', {
        description: message,
      })
    },
  })

  const closeIncomeDialog = () => {
    setDialog(null)
    setEditingIncome(null)
    incomeForm.reset(incomeDefaults())
  }

  const openCreateIncome = () => {
    setEditingIncome(null)
    incomeForm.reset(incomeDefaults())
    setDialog('income')
  }

  const openEditIncome = (income: Income) => {
    setEditingIncome(income)
    const sourceDate =
      income.expected_on ??
      income.effective_on ??
      new Date().toISOString().slice(0, 10)
    incomeForm.reset({
      owner_membership_id: String(income.owner_membership_id),
      account_id: income.account_id ? String(income.account_id) : '',
      category_id: String(income.category_id),
      kind: income.kind,
      scope: income.scope,
      net_amount: income.net_amount,
      currency_code: income.currency_code,
      effective_on: sourceDate.slice(0, 10),
      day_of_month: String(dayOfMonthFromDate(sourceDate)),
      weekday: String(weekdayFromDate(sourceDate)),
      day_of_quincena: String(quincenaDayFromDate(sourceDate)),
      frequency: income.frequency,
      notes: income.notes ?? '',
    })
    setDialog('income')
  }

  const openReceiveIncome = (income: Income) => {
    setReceivingIncome(income)
    receiveIncomeForm.reset({
      net_amount: income.net_amount,
      effective_on: new Date().toISOString().slice(0, 10),
      account_id: income.account_id ? String(income.account_id) : '',
    })
  }

  const resolveScheduleDate = (values: {
    frequency: string
    day_of_month: string
    weekday: string
    day_of_quincena: string
    date: string
  }) => {
    if (values.frequency === 'monthly') {
      return nextDateForDayOfMonth(Number(values.day_of_month))
    }
    if (values.frequency === 'weekly') {
      return nextDateForWeekday(Number(values.weekday))
    }
    if (values.frequency === 'biweekly') {
      return nextDateForQuincenaDay(Number(values.day_of_quincena))
    }
    return values.date
  }

  const incomePayload = (values: IncomeForm) => {
    const frequency = values.kind === 'extraordinary' ? 'once' : values.frequency
    const resolvedDate = resolveScheduleDate({
      frequency,
      day_of_month: values.day_of_month,
      weekday: values.weekday,
      day_of_quincena: values.day_of_quincena,
      date: values.effective_on,
    })
    const base = {
      owner_membership_id: Number(values.owner_membership_id),
      account_id: values.account_id ? Number(values.account_id) : null,
      category_id: Number(values.category_id),
      kind: values.kind,
      scope: values.scope,
      net_amount: values.net_amount,
      currency_code: values.currency_code,
      frequency,
      notes: values.notes || null,
    }
    if (!editingIncome || editingIncome.status === 'expected') {
      return {
        ...base,
        status: 'expected' as const,
        expected_on: resolvedDate,
        effective_on: resolvedDate,
      }
    }
    return {
      ...base,
      effective_on: values.effective_on,
    }
  }

  const saveIncome = useMutation({
    mutationFn: async (values: IncomeForm) => {
      const payload = incomePayload(values)
      if (editingIncome) {
        return api.updateIncome(id, editingIncome.id, payload)
      }
      return api.createIncome(id, payload)
    },
    onSuccess: async (_data, values) => {
      const wasEdit = Boolean(editingIncome)
      await refresh(['incomes', 'accounts', 'balances', 'recurrences'])
      closeIncomeDialog()
      setIncomeView('planned')
      setError(null)
      toast.success(wasEdit ? 'Ingreso programado actualizado' : 'Ingreso programado', {
        description: wasEdit
          ? 'Los cambios del ingreso esperado se guardaron.'
          : `Quedó programado ${formatMoney(values.net_amount, values.currency_code)} · ${scheduleAnchorLabel(
              values.kind === 'extraordinary' ? 'once' : values.frequency,
              resolveScheduleDate({
                frequency: values.kind === 'extraordinary' ? 'once' : values.frequency,
                day_of_month: values.day_of_month,
                weekday: values.weekday,
                day_of_quincena: values.day_of_quincena,
                date: values.effective_on,
              }),
            )}.`,
      })
    },
    onError: (reason) => {
      const message = fail(reason)
      setError(message)
      toast.error(
        editingIncome
          ? 'No se pudo actualizar el ingreso programado'
          : 'No se pudo programar el ingreso',
        { description: message },
      )
    },
  })

  const receiveIncome = useMutation({
    mutationFn: (values: ReceiveIncomeForm) =>
      api.receiveIncome(id, receivingIncome!.id, {
        net_amount: values.net_amount,
        effective_on: values.effective_on,
        account_id: values.account_id ? Number(values.account_id) : null,
      }),
    onSuccess: async (_data, values) => {
      await refresh(['incomes', 'accounts', 'balances', 'recurrences'])
      setReceivingIncome(null)
      setError(null)
      toast.success('Ingreso recibido registrado', {
        description: `Se creó el recibido por ${formatMoney(values.net_amount, household?.currency_code ?? 'COP')}. La programación sigue activa.`,
      })
    },
    onError: (reason) => {
      const message = fail(reason)
      setError(message)
      toast.error('No se pudo confirmar el ingreso', { description: message })
    },
  })

  const cancelIncome = useMutation({
    mutationFn: (income: Income) => api.cancelIncome(id, income.id),
    onSuccess: async (_data, income) => {
      await refresh(['incomes', 'accounts', 'balances', 'recurrences'])
      setError(null)
      toast.success('Programación desactivada', {
        description: `“${income.category?.name ?? incomeKindLabel(income.kind)}” ya no está programada.`,
      })
    },
    onError: (reason) => {
      const message = fail(reason)
      setError(message)
      toast.error('No se pudo desactivar la programación', { description: message })
    },
  })

  const mutation = useMutation({
    mutationFn: async ({ kind, values }: { kind: string; values: Record<string, unknown> }) => {
      if (kind === 'expense') {
        return api.createExpense(id, values)
      }
      throw new Error('Operación desconocida')
    },
    onSuccess: async (_data, variables) => {
      await refresh(['accounts', 'categories', 'incomes', 'expenses', 'balances', 'recurrences'])
      setDialog(null)
      setError(null)
      if (variables.kind === 'expense') {
        const amount = String(variables.values.amount ?? '')
        const currency = String(variables.values.currency_code ?? household?.currency_code ?? 'COP')
        const frequency = String(variables.values.frequency ?? 'once')
        const status = String(variables.values.status ?? 'committed')
        const occurredOn = String(variables.values.occurred_on ?? '')
        toast.success(
          status === 'planned' ? 'Gasto programado' : 'Gasto comprometido',
          {
            description: `Se registró ${formatMoney(amount || '0', currency)} · ${scheduleAnchorLabel(frequency, occurredOn)}.`,
          },
        )
        expenseForm.reset(expenseDefaults(expenseView))
        if (status === 'planned') setExpenseView('planned')
        else setExpenseView('committed')
      }
    },
    onError: (reason, variables) => {
      const message = fail(reason)
      setError(message)
      if (variables.kind === 'expense') {
        toast.error('No se pudo crear el gasto', { description: message })
      }
    },
  })
  const commitExpense = useMutation({
    mutationFn: (values: CommitExpenseForm) =>
      api.commitExpense(id, committingExpense!.id, {
        amount: values.amount,
        occurred_on: values.occurred_on,
      }),
    onSuccess: async (_data, values) => {
      await refresh(['expenses', 'accounts', 'balances', 'recurrences'])
      setCommittingExpense(null)
      setError(null)
      toast.success('Gasto comprometido', {
        description: `Se creó el comprometido por ${formatMoney(values.amount, household?.currency_code ?? 'COP')}. La programación sigue activa.`,
      })
    },
    onError: (reason) => {
      const message = fail(reason)
      setError(message)
      toast.error('No se pudo comprometer el gasto', { description: message })
    },
  })
  const cancelExpense = useMutation({
    mutationFn: (expense: Expense) => api.cancelExpense(id, expense.id),
    onSuccess: async (_data, expense) => {
      await refresh(['expenses', 'balances', 'recurrences'])
      setError(null)
      toast.success('Programación desactivada', {
        description: `“${expense.category?.name ?? 'Gasto'}” ya no está programada.`,
      })
    },
    onError: (reason) => {
      const message = fail(reason)
      setError(message)
      toast.error('No se pudo desactivar la programación', { description: message })
    },
  })
  const pay = useMutation({
    mutationFn: (values: PaymentForm) =>
      api.createPayment(id, selectedExpense!.id, {
        ...values,
        payer_membership_id: Number(values.payer_membership_id),
        account_id: Number(values.account_id),
        idempotency_key: crypto.randomUUID(),
      }),
    onSuccess: async (_data, values) => {
      await refresh(['expenses', 'accounts', 'balances'])
      setSelectedExpense(null)
      setError(null)
      toast.success('Pago registrado', {
        description: `Se registró un pago de ${formatMoney(values.amount, household?.currency_code ?? 'COP')}.`,
      })
    },
    onError: (reason) => {
      const message = fail(reason)
      setError(message)
      toast.error('No se pudo registrar el pago', { description: message })
    },
  })
  const generate = useMutation({
    mutationFn: (item: { id: number; date: string }) =>
      api.generateRecurrence(id, item.id, {
        occurrence_on: item.date,
        idempotency_key: crypto.randomUUID(),
      }),
    onSuccess: () => {
      refresh(['expenses', 'incomes', 'recurrences'])
      toast.success('Ocurrencia generada', {
        description: 'Se creó la siguiente ocurrencia de la recurrencia.',
      })
    },
    onError: (reason) => {
      const message = fail(reason)
      setError(message)
      toast.error('No se pudo generar la ocurrencia', { description: message })
    },
  })

  const openCreateExpense = (mode: 'planned' | 'committed') => {
    expenseForm.reset(expenseDefaults(mode))
    setDialog('expense')
  }

  const openCommitExpense = (expense: Expense) => {
    setCommittingExpense(expense)
    commitExpenseForm.reset({
      amount: expense.amount,
      occurred_on: new Date().toISOString().slice(0, 10),
    })
  }

  const expensePayload = (values: ExpenseForm) => {
    const occurredOn = resolveScheduleDate({
      frequency: values.frequency,
      day_of_month: values.day_of_month,
      weekday: values.weekday,
      day_of_quincena: values.day_of_quincena,
      date: values.occurred_on,
    })
    return {
      category_id: Number(values.category_id),
      scope: values.scope,
      classification: values.classification,
      amount: values.amount,
      currency_code: values.currency_code,
      occurred_on: occurredOn,
      frequency: values.frequency,
      status: values.frequency === 'once' ? values.status : 'planned',
      notes: values.notes || null,
      shares: values.shares,
      distribution_method:
        values.shares.length === 2 &&
        values.shares.every((s) => s.percentage === '50.0000')
          ? 'equal'
          : 'custom',
    }
  }

  const memberOptions = members.data?.data.filter((item) => item.status === 'active') ?? []
  const expenseCategories =
    categories.data?.data.filter((item) => item.type === 'expense' && item.is_active) ?? []
  const incomeCategories =
    categories.data?.data.filter((item) => item.type === 'income' && item.is_active) ?? []
  const incomeCategoryOptions = [
    ...incomeCategories,
    ...(editingIncome?.category &&
    !incomeCategories.some((item) => item.id === editingIncome.category_id)
      ? [editingIncome.category]
      : []),
  ]
  const activeAccounts = accounts.data?.data.filter((item) => item.is_active) ?? []
  const incomeAccountOptions = [
    ...activeAccounts,
    ...(editingIncome?.account &&
    !activeAccounts.some((item) => item.id === editingIncome.account_id)
      ? [editingIncome.account]
      : []),
  ]
  const myMembershipId = household?.membership?.id
  const canEditIncome = (income: Income) => {
    if (income.status === 'cancelled') return false
    if (hasPermission('ingresos.editar_ajenos')) return true
    return (
      hasPermission('ingresos.editar_propios') &&
      income.owner_membership_id === myMembershipId
    )
  }
  const canCancelIncome = (income: Income) => {
    if (income.status === 'cancelled') return false
    if (hasPermission('ingresos.editar_ajenos')) return true
    return (
      income.owner_membership_id === myMembershipId &&
      (hasPermission('ingresos.editar_propios') || hasPermission('ingresos.eliminar'))
    )
  }
  const watchedAmount = expenseForm.watch('amount')
  const watchedShares = expenseForm.watch('shares')
  let sharePreview: ReturnType<typeof allocateExpense> = []
  try {
    sharePreview = allocateExpense(
      watchedAmount || '0.0000',
      watchedShares.map((share) => ({
        membership_id: share.membership_id,
        percentage: share.percentage ?? '0.0000',
      })),
    )
  } catch {
    sharePreview = []
  }

  if (!household) return <Navigate to="/app" replace />

  const tabs: [Tab, string][] = [
    ['accounts', 'Cuentas'],
    ['categories', 'Categorías'],
    ['incomes', 'Ingresos'],
    ['expenses', 'Gastos'],
    ['balances', 'Saldos internos'],
    ['recurrences', 'Recurrencias'],
    ['debts', 'Deudas'],
    ['savings', 'Ahorros'],
    ['budgets', 'Presupuesto'],
    ['settlements', 'Compensaciones'],
    ['reports', 'Reportes'],
  ]

  return (
    <main className="min-h-screen bg-stone-100 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-3xl border-t-8 border-brand-500 bg-white p-5 shadow-panel">
          <Link
            to={`/app/households/${id}`}
            className="inline-flex items-center gap-1 text-sm font-black text-brand-600"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <WalletCards className="h-10 w-10 text-brand-600" />
            <div>
              <h1 className="text-3xl font-black text-slate-900">Núcleo financiero</h1>
              <p className="font-semibold text-slate-500">{household.name}</p>
            </div>
          </div>
          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {tabs.map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={tab === key ? 'primary' : 'secondary'}
                onClick={() => setTab(key)}
              >
                {label}
              </Button>
            ))}
          </nav>
        </header>
        {error ? <Alert tone="danger">{error}</Alert> : null}

        {tab === 'accounts' && (
          <Panel title="Cuentas financieras">
            <Toolbar
              allowed={hasPermission('cuentas.gestionar')}
              onAdd={openCreateAccount}
              label="Nueva cuenta"
            />
            <CardList empty="No hay cuentas">
              {accounts.data?.data.map((item) => (
                <Card
                  key={item.id}
                  title={item.name}
                  status={item.is_active ? 'activa' : 'inactiva'}
                  statusTone={activeStatusTone(item.is_active)}
                >
                  <p>
                    {accountTypeLabel(item.type)} · {scopeLabel(item.scope)}
                  </p>
                  <strong>{formatMoney(item.current_balance, item.currency_code)}</strong>
                  {hasPermission('cuentas.gestionar') ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEditAccount(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={toggleAccountActive.isPending}
                        onClick={() => toggleAccountActive.mutate(item)}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {item.is_active ? 'Desactivar' : 'Reactivar'}
                      </Button>
                    </div>
                  ) : null}
                </Card>
              ))}
            </CardList>
          </Panel>
        )}
        {tab === 'categories' && (
          <Panel title="Categorías del hogar">
            <Toolbar
              allowed={hasPermission('categorias.gestionar')}
              onAdd={openCreateCategory}
              label="Nueva categoría"
            />
            <CardList empty="No hay categorías">
              {categories.data?.data.map((item) => (
                <Card
                  key={item.id}
                  title={item.name}
                  status={item.is_active ? 'activa' : 'inactiva'}
                  statusTone={activeStatusTone(item.is_active)}
                >
                  <p>
                    {item.type === 'income' ? 'Ingreso' : 'Gasto'}
                    {item.classification
                      ? ` · ${classificationLabel(item.classification)}`
                      : ''}
                  </p>
                  {hasPermission('categorias.gestionar') ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEditCategory(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={toggleCategoryActive.isPending}
                        onClick={() => toggleCategoryActive.mutate(item)}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {item.is_active ? 'Desactivar' : 'Reactivar'}
                      </Button>
                    </div>
                  ) : null}
                </Card>
              ))}
            </CardList>
          </Panel>
        )}
        {tab === 'incomes' && (
          <Panel title="Ingresos">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={incomeView === 'planned' ? 'primary' : 'secondary'}
                  onClick={() => setIncomeView('planned')}
                >
                  Programados
                </Button>
                <Button
                  size="sm"
                  variant={incomeView === 'received' ? 'primary' : 'secondary'}
                  onClick={() => setIncomeView('received')}
                >
                  Recibidos
                </Button>
              </div>
              {incomeView === 'planned' && hasPermission('ingresos.crear') ? (
                <Button size="sm" onClick={openCreateIncome}>
                  <Plus className="h-4 w-4" />
                  Programar ingreso
                </Button>
              ) : null}
            </div>
            {incomeView === 'planned' ? (
              <>
                <Alert className="mb-4">
                  Aquí se planifican ingresos esperados y recurrentes (por ejemplo nómina el día 5).
                  Al marcarlos como recibidos se crea el ingreso real y la programación permanece
                  activa hasta que la desactives.
                </Alert>
                <CardList empty="No hay ingresos programados">
                  {incomes.data?.data
                    .filter((item) => item.status === 'expected')
                    .map((item) => (
                      <Card
                        key={item.id}
                        title={item.category?.name ?? incomeKindLabel(item.kind)}
                        status={incomeStatusLabel(item.status)}
                        statusTone={incomeStatusTone(item.status)}
                      >
                        <p>
                          {incomeKindLabel(item.kind)} · {frequencyLabel(item.frequency)} ·{' '}
                          {scopeLabel(item.scope)}
                        </p>
                        <p className="text-xs">
                          {scheduleAnchorLabel(
                            item.frequency,
                            item.expected_on ?? item.effective_on,
                          )}
                        </p>
                        <strong className="text-amber-700">
                          {formatMoney(item.net_amount, item.currency_code)}
                        </strong>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {canEditIncome(item) ? (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => openReceiveIncome(item)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Marcar recibido
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openEditIncome(item)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Editar
                              </Button>
                            </>
                          ) : null}
                          {canCancelIncome(item) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={cancelIncome.isPending}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `¿Desactivar la programación de ${formatMoney(item.net_amount, item.currency_code)}? Dejará de generar o confirmarse hasta que la reactives creando una nueva.`,
                                  )
                                ) {
                                  cancelIncome.mutate(item)
                                }
                              }}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Desactivar
                            </Button>
                          ) : null}
                        </div>
                      </Card>
                    ))}
                </CardList>
              </>
            ) : (
              <>
                <Alert className="mb-4">
                  Ingresos ya confirmados. Cada confirmación crea un registro recibido y la
                  programación original sigue en Programados hasta que la desactives.
                </Alert>
                <CardList empty="No hay ingresos recibidos">
                  {incomes.data?.data
                    .filter((item) => item.status === 'received')
                    .map((item) => (
                      <Card
                        key={item.id}
                        title={item.category?.name ?? incomeKindLabel(item.kind)}
                        status={incomeStatusLabel(item.status)}
                        statusTone={incomeStatusTone(item.status)}
                      >
                        <p>
                          {incomeKindLabel(item.kind)} · {frequencyLabel(item.frequency)} ·{' '}
                          {scopeLabel(item.scope)}
                        </p>
                        <p className="text-xs">
                          Recibido: {formatDateTime(item.effective_on)}
                          {item.expected_on
                            ? ` · Programado: ${scheduleAnchorLabel(item.frequency, item.expected_on)}`
                            : ''}
                        </p>
                        <p className="text-xs">
                          Cuenta destino:{' '}
                          {item.account?.name ??
                            activeAccounts.find((account) => account.id === item.account_id)
                              ?.name ??
                            'Sin cuenta'}
                        </p>
                        <strong className="text-emerald-700">
                          {formatMoney(item.net_amount, item.currency_code)}
                        </strong>
                        {canEditIncome(item) ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openEditIncome(item)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                          </div>
                        ) : null}
                      </Card>
                    ))}
                </CardList>
              </>
            )}
          </Panel>
        )}
        {tab === 'expenses' && (
          <Panel title="Gastos">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={expenseView === 'planned' ? 'primary' : 'secondary'}
                  onClick={() => setExpenseView('planned')}
                >
                  Programados
                </Button>
                <Button
                  size="sm"
                  variant={expenseView === 'committed' ? 'primary' : 'secondary'}
                  onClick={() => setExpenseView('committed')}
                >
                  Comprometidos
                </Button>
              </div>
              {hasPermission('gastos.crear') ? (
                <Button
                  size="sm"
                  onClick={() =>
                    openCreateExpense(expenseView === 'planned' ? 'planned' : 'committed')
                  }
                >
                  <Plus className="h-4 w-4" />
                  {expenseView === 'planned' ? 'Programar gasto' : 'Nuevo gasto'}
                </Button>
              ) : null}
            </div>
            {expenseView === 'planned' ? (
              <>
                <Alert className="mb-4">
                  Aquí se planifican gastos recurrentes (por ejemplo arriendo el día 1). Al marcarlos
                  como comprometidos se crea el gasto del período y la programación permanece activa
                  hasta que la desactives.
                </Alert>
                <CardList empty="No hay gastos programados">
                  {expenses.data?.data
                    .filter((item) => item.status === 'planned')
                    .map((item) => (
                      <Card
                        key={item.id}
                        title={item.category?.name ?? `Gasto #${item.id}`}
                        status={expenseStatusLabel(item.status)}
                        statusTone={expenseStatusTone(item.status)}
                      >
                        <p>
                          {scopeLabel(item.scope)} · {classificationLabel(item.classification)} ·{' '}
                          {frequencyLabel(item.frequency ?? 'once')}
                        </p>
                        <p className="text-xs">
                          {scheduleAnchorLabel(item.frequency ?? 'once', item.occurred_on)}
                        </p>
                        <strong className="text-amber-700">
                          {formatMoney(item.amount, item.currency_code)}
                        </strong>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {hasPermission('gastos.editar') ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => openCommitExpense(item)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Marcar comprometido
                            </Button>
                          ) : null}
                          {hasPermission('gastos.editar') ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={cancelExpense.isPending}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `¿Desactivar la programación de ${formatMoney(item.amount, item.currency_code)}? Dejará de generar ocurrencias hasta que programes una nueva.`,
                                  )
                                ) {
                                  cancelExpense.mutate(item)
                                }
                              }}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Desactivar
                            </Button>
                          ) : null}
                        </div>
                      </Card>
                    ))}
                </CardList>
              </>
            ) : (
              <>
                <Alert className="mb-4">
                  Gastos ya comprometidos del período. Aquí registras pagos. Los programados
                  recurrentes siguen en Programados hasta que los desactives.
                </Alert>
                <CardList empty="No hay gastos comprometidos">
                  {expenses.data?.data
                    .filter((item) =>
                      ['committed', 'partial', 'paid'].includes(item.status),
                    )
                    .map((item) => (
                      <button
                        key={item.id}
                        className="text-left"
                        onClick={() => {
                          setSelectedExpense(item)
                          paymentForm.setValue('amount', item.pending_amount)
                        }}
                      >
                        <Card
                          title={item.category?.name ?? `Gasto #${item.id}`}
                          status={expenseStatusLabel(item.status)}
                          statusTone={expenseStatusTone(item.status)}
                        >
                          <p>
                            {scopeLabel(item.scope)} · {classificationLabel(item.classification)}
                            {item.frequency && item.frequency !== 'once'
                              ? ` · ${frequencyLabel(item.frequency)}`
                              : ''}
                          </p>
                          <p className="text-xs">Fecha: {formatDate(item.occurred_on)}</p>
                          <strong>{formatMoney(item.amount, item.currency_code)}</strong>
                          <p className="text-xs">
                            Pendiente: {formatMoney(item.pending_amount, item.currency_code)}
                          </p>
                        </Card>
                      </button>
                    ))}
                </CardList>
              </>
            )}
          </Panel>
        )}
        {tab === 'balances' && (
          <Panel title="Saldos internos derivados">
            <Alert className="mb-4">
              <p className="font-bold">¿Qué es esto?</p>
              <p className="mt-1">
                Resume, entre integrantes del hogar, quién ha pagado de más o de menos en los gastos
                compartidos. No es el saldo de una cuenta ni una deuda bancaria: es un balance
                interno para empatar aportaciones.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>Responsabilidad:</strong> suma de lo que le toca a esa persona según sus
                  porcentajes en gastos comprometidos (no incluye programados ni cancelados).
                </li>
                <li>
                  <strong>Pagado:</strong> suma de los pagos que ha registrado desde sus cuentas.
                </li>
                <li>
                  <strong>Saldo interno:</strong> Pagado − Responsabilidad.
                </li>
              </ul>
              <p className="mt-2">
                <strong>Positivo / adelantó:</strong> cubrió más de su parte (alguien del hogar le
                “debe” ese exceso en el arreglo interno).{' '}
                <strong>Negativo / debe:</strong> aún no ha cubierto toda su participación.
              </p>
            </Alert>
            <CardList empty="No hay saldos">
              {balances.data?.data.map((item) => {
                const net = item.net_internal_balance
                const isAhead = item.meaning === 'adelantó'
                return (
                  <Card
                    key={item.membership_id}
                    title={item.name}
                    status={item.meaning}
                    statusTone={balanceMeaningTone(item.meaning)}
                  >
                    <p className="text-xs text-slate-500">
                      Lo que le corresponde vs lo que ya pagó en gastos del hogar
                    </p>
                    <p>Responsabilidad:{' '}
                      {formatMoney(item.responsibility, household.currency_code)}
                    </p>
                    <p>Pagado: {formatMoney(item.paid, household.currency_code)}</p>
                    {item.settled_paid && item.settled_paid !== '0.0000' ? (
                      <p className="text-xs">
                        Compensaciones pagadas:{' '}
                        {formatMoney(item.settled_paid, household.currency_code)}
                      </p>
                    ) : null}
                    {item.settled_received && item.settled_received !== '0.0000' ? (
                      <p className="text-xs">
                        Compensaciones recibidas:{' '}
                        {formatMoney(item.settled_received, household.currency_code)}
                      </p>
                    ) : null}
                    <strong className={isAhead ? 'text-emerald-700' : 'text-amber-700'}>
                      Saldo interno: {formatMoney(net, household.currency_code)}
                    </strong>
                    <p className="text-xs">
                      {net === '0.0000'
                        ? 'Está empatado: pagó exactamente lo que le correspondía.'
                        : isAhead
                          ? `Adelantó ${formatMoney(net, household.currency_code)} respecto a su parte.`
                          : `Le faltan ${formatMoney(net.replace(/^-/, ''), household.currency_code)} para cubrir su participación.`}
                    </p>
                  </Card>
                )
              })}
            </CardList>
          </Panel>
        )}
        {tab === 'recurrences' && (
          <Panel title="Recurrencias">
            <Alert className="mb-4">
              El scheduler diario (`php artisan recurrences:generate-due`, 01:15) genera
              automáticamente las ocurrencias vencidas. También puedes generar manualmente o
              disparar ahora el lote automático.
            </Alert>
            {hasPermission('recurrencias.gestionar') ? (
              <Button
                size="sm"
                variant="secondary"
                className="mb-4"
                disabled={generate.isPending}
                onClick={() => {
                  api
                    .generateDueRecurrences()
                    .then((res) => {
                      refresh(['expenses', 'incomes', 'recurrences'])
                      const ok = res.data.filter((r) => r.status === 'generated').length
                      toast.success('Lote de recurrencias', {
                        description: `${ok} generada(s) de ${res.data.length} plantilla(s).`,
                      })
                    })
                    .catch((reason) =>
                      toast.error('No se pudo generar el lote', { description: fail(reason) }),
                    )
                }}
              >
                Generar vencidas ahora
              </Button>
            ) : null}
            <CardList empty="No hay recurrencias">
              {recurrences.data?.data.map((item) => (
                <Card
                  key={item.id}
                  title={`${recurrenceKindLabel(item.kind)} · ${frequencyLabel(item.frequency)}`}
                  status={item.is_active ? 'activa' : 'inactiva'}
                  statusTone={activeStatusTone(item.is_active)}
                >
                  <p>Próxima: {formatDate(item.next_occurrence_on)}</p>
                  <Button
                    size="sm"
                    disabled={generate.isPending}
                    onClick={() =>
                      generate.mutate({ id: item.id, date: item.next_occurrence_on })
                    }
                  >
                    Generar ocurrencia
                  </Button>
                </Card>
              ))}
            </CardList>
          </Panel>
        )}
        {(tab === 'debts' ||
          tab === 'savings' ||
          tab === 'budgets' ||
          tab === 'settlements' ||
          tab === 'reports') && (
          <Phase3Panels
            householdId={id}
            currency={household.currency_code}
            tab={tab}
            members={memberOptions.map((m) => ({ id: m.id, user: { name: m.user.name } }))}
            accounts={activeAccounts.map((a) => ({ id: a.id, name: a.name }))}
            categories={(categories.data?.data ?? []).map((c) => ({
              id: c.id,
              name: c.name,
              type: c.type,
            }))}
            hasPermission={hasPermission}
          />
        )}
      </div>

      <Dialog
        open={dialog === 'account'}
        onOpenChange={(open) => !open && closeAccountDialog()}
        title={editingAccount ? 'Editar cuenta' : 'Nueva cuenta'}
        footer={
          <Button
            disabled={saveAccount.isPending}
            onClick={accountForm.handleSubmit((v) => saveAccount.mutate(v))}
          >
            {saveAccount.isPending
              ? 'Guardando…'
              : editingAccount
                ? 'Guardar cambios'
                : 'Guardar'}
          </Button>
        }
      >
        <TextField
          form={accountForm}
          name="name"
          label="Nombre"
          tooltip="Nombre con el que identificarás esta cuenta en el hogar (por ejemplo: Nequi Yeimy o Efectivo casa)."
        />
        <SelectField
          form={accountForm}
          name="type"
          label="Tipo"
          tooltip="Clasifica el medio de dinero: efectivo, ahorro, cuenta corriente o tarjeta de crédito."
          options={[
            ['cash', 'Efectivo'],
            ['savings', 'Ahorro'],
            ['checking', 'Corriente'],
            ['credit_card', 'Tarjeta'],
          ]}
        />
        <MoneyField
          form={accountForm}
          name="opening_balance"
          label="Saldo inicial exacto"
          tooltip="Saldo real con el que parte la cuenta. Si ya hay movimientos, al cambiarlo también cambia el saldo actual calculado."
        />
        <SelectField
          form={accountForm}
          name="scope"
          label="Alcance"
          tooltip="Individual: solo la usa su propietario. Compartida: puede usarse en gastos y pagos del hogar."
          options={[
            ['individual', 'Individual'],
            ['shared', 'Compartida'],
          ]}
        />
        <SelectField
          form={accountForm}
          name="owner_membership_id"
          label="Propietario"
          allowEmpty
          tooltip="Integrante dueño de la cuenta. Obligatorio si el alcance es individual; en compartida puedes dejarlo vacío."
          options={memberOptions.map((m) => [String(m.id), m.user.name])}
        />
      </Dialog>

      <Dialog
        open={dialog === 'category'}
        onOpenChange={(open) => !open && closeCategoryDialog()}
        title={editingCategory ? 'Editar categoría' : 'Nueva categoría'}
        footer={
          <Button
            disabled={saveCategory.isPending}
            onClick={categoryForm.handleSubmit((v) => saveCategory.mutate(v))}
          >
            {saveCategory.isPending
              ? 'Guardando…'
              : editingCategory
                ? 'Guardar cambios'
                : 'Guardar'}
          </Button>
        }
      >
        <TextField
          form={categoryForm}
          name="name"
          label="Nombre"
          tooltip="Nombre de la categoría para clasificar ingresos o gastos (por ejemplo: Arriendo, Nómina o Mercado)."
        />
        <SelectField
          form={categoryForm}
          name="type"
          label="Tipo"
          tooltip="Define si la categoría se usa para registrar ingresos o gastos. Solo las activas aparecen al crear movimientos."
          options={[
            ['income', 'Ingreso'],
            ['expense', 'Gasto'],
          ]}
        />
        {categoryForm.watch('type') === 'expense' ? (
          <SelectField
            form={categoryForm}
            name="classification"
            label="Clasificación"
            tooltip="Esencial: gasto necesario del hogar. Discrecional: gasto opcional o de estilo de vida."
            options={[
              ['essential', 'Esencial'],
              ['discretionary', 'Discrecional'],
            ]}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={dialog === 'income'}
        onOpenChange={(open) => !open && closeIncomeDialog()}
        title={
          editingIncome
            ? editingIncome.status === 'received'
              ? 'Editar ingreso recibido'
              : 'Editar ingreso programado'
            : 'Programar ingreso'
        }
        footer={
          <Button
            disabled={saveIncome.isPending}
            onClick={incomeForm.handleSubmit((v) => saveIncome.mutate(v))}
          >
            {saveIncome.isPending
              ? 'Guardando…'
              : editingIncome
                ? 'Guardar cambios'
                : 'Programar'}
          </Button>
        }
      >
        <SelectField
          form={incomeForm}
          name="owner_membership_id"
          label="Propietario"
          tooltip="Integrante al que pertenece este ingreso esperado."
          options={memberOptions.map((m) => [String(m.id), m.user.name])}
        />
        <SelectField
          form={incomeForm}
          name="category_id"
          label="Categoría"
          tooltip="Categoría de ingreso (por ejemplo Nómina) para clasificar lo programado."
          options={incomeCategoryOptions.map((c) => [String(c.id), c.name])}
        />
        <SelectField
          form={incomeForm}
          name="account_id"
          label="Cuenta destino (opcional)"
          allowEmpty
          tooltip="Cuenta donde se acreditará cuando marques el ingreso como recibido."
          options={incomeAccountOptions.map((a) => [String(a.id), a.name])}
        />
        <SelectField
          form={incomeForm}
          name="kind"
          label="Tipo"
          tooltip="Fijo: se repite de forma estable (nómina). Variable: monto cambia. Extraordinario: puntual."
          options={[
            ['fixed', 'Fijo'],
            ['variable', 'Variable'],
            ['extraordinary', 'Extraordinario'],
          ]}
        />
        {incomeForm.watch('kind') !== 'extraordinary' ? (
          <SelectField
            form={incomeForm}
            name="frequency"
            label="Frecuencia"
            tooltip="Si no es única, el sistema crea una recurrencia y las próximas fechas saldrán como esperadas."
            options={[
              ['once', 'Única'],
              ['weekly', 'Semanal'],
              ['biweekly', 'Quincenal'],
              ['monthly', 'Mensual'],
            ]}
          />
        ) : null}
        <MoneyField
          form={incomeForm}
          name="net_amount"
          label={
            editingIncome?.status === 'received' ? 'Importe recibido' : 'Importe esperado'
          }
          tooltip="Monto de la ocurrencia. En programados es lo esperado; al recibir podrás ajustarlo."
        />
        {editingIncome?.status === 'received' ? (
          <TextField
            form={incomeForm}
            name="effective_on"
            label="Fecha de recepción"
            type="date"
            tooltip="Fecha en la que efectivamente entró el dinero."
          />
        ) : (incomeForm.watch('kind') === 'extraordinary'
            ? 'once'
            : incomeForm.watch('frequency')) === 'monthly' ? (
          <SelectField
            form={incomeForm}
            name="day_of_month"
            label="Día del mes"
            tooltip="Día en que esperas recibir el ingreso cada mes (por ejemplo 5 para la nómina). No es una fecha exacta de un solo mes."
            options={Array.from({ length: 31 }, (_, index) => {
              const day = String(index + 1)
              return [day, `Día ${day}`] as [string, string]
            })}
          />
        ) : (incomeForm.watch('kind') === 'extraordinary'
            ? 'once'
            : incomeForm.watch('frequency')) === 'weekly' ? (
          <SelectField
            form={incomeForm}
            name="weekday"
            label="Día de la semana"
            tooltip="Día de la semana en que esperas el ingreso (por ejemplo cada viernes)."
            options={WEEKDAY_OPTIONS}
          />
        ) : (incomeForm.watch('kind') === 'extraordinary'
            ? 'once'
            : incomeForm.watch('frequency')) === 'biweekly' ? (
          <SelectField
            form={incomeForm}
            name="day_of_quincena"
            label="Día de la quincena"
            tooltip="Día 1–15 dentro de cada quincena. Ejemplo: día 5 → cae el 5 y el 20 de cada mes."
            options={Array.from({ length: 15 }, (_, index) => {
              const day = String(index + 1)
              return [day, `Día ${day} (${day} y ${Number(day) + 15})`] as [string, string]
            })}
          />
        ) : (
          <TextField
            form={incomeForm}
            name="effective_on"
            label="Fecha esperada"
            type="date"
            tooltip="Fecha concreta de esta ocurrencia única."
          />
        )}
      </Dialog>

      <Dialog
        open={Boolean(receivingIncome)}
        onOpenChange={(open) => !open && setReceivingIncome(null)}
        title="Confirmar ingreso recibido"
        description={
          receivingIncome
            ? `Programado: ${formatMoney(receivingIncome.net_amount, receivingIncome.currency_code)} · ${formatDate(receivingIncome.expected_on ?? receivingIncome.effective_on)}`
            : undefined
        }
        footer={
          <Button
            disabled={receiveIncome.isPending}
            onClick={receiveIncomeForm.handleSubmit((v) => receiveIncome.mutate(v))}
          >
            {receiveIncome.isPending ? 'Confirmando…' : 'Confirmar recibido'}
          </Button>
        }
      >
        <MoneyField
          form={receiveIncomeForm}
          name="net_amount"
          label="Importe recibido"
          tooltip="Monto real que entró. Si difiere de lo programado, usa el valor verdadero."
        />
        <TextField
          form={receiveIncomeForm}
          name="effective_on"
          label="Fecha de recepción"
          type="date"
          tooltip="Fecha en la que efectivamente recibiste el dinero."
        />
        <SelectField
          form={receiveIncomeForm}
          name="account_id"
          label="Cuenta destino"
          allowEmpty
          tooltip="Cuenta donde queda acreditado el ingreso recibido."
          options={activeAccounts.map((a) => [String(a.id), a.name])}
        />
      </Dialog>

      <Dialog
        open={dialog === 'expense'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={
          expenseForm.watch('status') === 'planned'
            ? 'Programar gasto y distribución'
            : 'Crear gasto y distribución'
        }
        className="max-w-2xl"
        footer={
          <Button
            disabled={mutation.isPending}
            onClick={expenseForm.handleSubmit((v) =>
              mutation.mutate({
                kind: 'expense',
                values: expensePayload(v),
              }),
            )}
          >
            {mutation.isPending
              ? 'Guardando…'
              : expenseForm.watch('status') === 'planned'
                ? 'Programar gasto'
                : 'Crear gasto'}
          </Button>
        }
      >
        <SelectField
          form={expenseForm}
          name="category_id"
          label="Categoría"
          tooltip="Categoría de gasto activa para clasificar este movimiento (por ejemplo Alimentación o Arriendo)."
          options={expenseCategories.map((c) => [String(c.id), c.name])}
        />
        <MoneyField
          form={expenseForm}
          name="amount"
          label="Importe exacto"
          tooltip="Monto total del gasto a repartir entre los integrantes seleccionados."
        />
        <SelectField
          form={expenseForm}
          name="classification"
          label="Clasificación"
          tooltip="Esencial: necesario para el hogar. Discrecional: opcional o de estilo de vida."
          options={[
            ['essential', 'Esencial'],
            ['discretionary', 'Discrecional'],
          ]}
        />
        {expenseForm.watch('status') === 'planned' ? (
          <SelectField
            form={expenseForm}
            name="frequency"
            label="Frecuencia"
            tooltip="Mensual: día del mes. Semanal: día de la semana. Quincenal: día 1–15 de cada quincena."
            options={[
              ['monthly', 'Mensual'],
              ['weekly', 'Semanal'],
              ['biweekly', 'Quincenal'],
              ['once', 'Única (solo programar)'],
            ]}
          />
        ) : (
          <SelectField
            form={expenseForm}
            name="frequency"
            label="Frecuencia"
            tooltip="En Comprometidos los gastos se registran como ocurrencia única. Para recurrentes usa Programados."
            options={[['once', 'Única']]}
          />
        )}
        {expenseForm.watch('frequency') === 'monthly' ? (
          <SelectField
            form={expenseForm}
            name="day_of_month"
            label="Día del mes"
            tooltip="Día en que esperas el gasto cada mes (por ejemplo 1 para el arriendo). No es una fecha exacta de un solo mes."
            options={Array.from({ length: 31 }, (_, index) => {
              const day = String(index + 1)
              return [day, `Día ${day}`] as [string, string]
            })}
          />
        ) : expenseForm.watch('frequency') === 'weekly' ? (
          <SelectField
            form={expenseForm}
            name="weekday"
            label="Día de la semana"
            tooltip="Día de la semana en que se presenta el gasto (por ejemplo cada lunes)."
            options={WEEKDAY_OPTIONS}
          />
        ) : expenseForm.watch('frequency') === 'biweekly' ? (
          <SelectField
            form={expenseForm}
            name="day_of_quincena"
            label="Día de la quincena"
            tooltip="Día 1–15 dentro de cada quincena. Ejemplo: día 5 → cae el 5 y el 20 de cada mes."
            options={Array.from({ length: 15 }, (_, index) => {
              const day = String(index + 1)
              return [day, `Día ${day} (${day} y ${Number(day) + 15})`] as [string, string]
            })}
          />
        ) : (
          <TextField
            form={expenseForm}
            name="occurred_on"
            label="Fecha"
            type="date"
            tooltip="Fecha en la que ocurrió o se compromete el gasto."
          />
        )}
        <FormField
          label="Integrantes y porcentajes"
          tooltip="Selecciona quién participa y con qué porcentaje. La suma debe ser exactamente 100%."
          error={expenseForm.formState.errors.shares?.message}
        >
          <div className="space-y-2 rounded-2xl border p-3">
            {memberOptions.map((member) => {
              const shares = expenseForm.watch('shares')
              const found = shares.find((s) => s.membership_id === member.id)
              return (
                <div key={member.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(found)}
                    onChange={(event) =>
                      expenseForm.setValue(
                        'shares',
                        event.target.checked
                          ? [
                              ...shares,
                              {
                                membership_id: member.id,
                                percentage: shares.length === 1 ? '50.0000' : '0.0000',
                              },
                            ]
                          : shares.filter((s) => s.membership_id !== member.id),
                        { shouldValidate: true },
                      )
                    }
                  />
                  <span className="min-w-28 text-sm font-bold">{member.user.name}</span>
                  {found ? (
                    <MoneyInput
                      aria-label={`Porcentaje ${member.user.name}`}
                      value={found.percentage}
                      scale={2}
                      apiScale={4}
                      placeholder="0,00"
                      onChange={(next) =>
                        expenseForm.setValue(
                          'shares',
                          shares.map((s) =>
                            s.membership_id === member.id
                              ? { ...s, percentage: next }
                              : s,
                          ),
                          { shouldValidate: true },
                        )
                      }
                    />
                  ) : null}
                  {found ? <span className="text-sm font-bold text-slate-500">%</span> : null}
                </div>
              )
            })}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const chosen = expenseForm.getValues('shares').slice(0, 2)
                if (chosen.length === 2) {
                  expenseForm.setValue(
                    'shares',
                    chosen.map((s) => ({ ...s, percentage: '50.0000' })),
                    { shouldValidate: true },
                  )
                }
              }}
            >
              Aplicar 50/50
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const ids = expenseForm.getValues('shares').map((s) => s.membership_id)
                if (!ids.length) return
                api
                  .distributionPreview(id, { membership_ids: ids, mode: 'income' })
                  .then((res) => {
                    expenseForm.setValue(
                      'shares',
                      res.data.map((s) => ({
                        membership_id: s.membership_id,
                        percentage: s.percentage,
                      })),
                      { shouldValidate: true },
                    )
                    toast.success('Distribución proporcional a ingresos aplicada')
                  })
                  .catch((reason) =>
                    toast.error('No se pudo calcular', { description: fail(reason) }),
                  )
              }}
            >
              Proporcional a ingresos
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const ids = expenseForm.getValues('shares').map((s) => s.membership_id)
                if (!ids.length) return
                api
                  .distributionPreview(id, { membership_ids: ids, mode: 'capacity' })
                  .then((res) => {
                    expenseForm.setValue(
                      'shares',
                      res.data.map((s) => ({
                        membership_id: s.membership_id,
                        percentage: s.percentage,
                      })),
                      { shouldValidate: true },
                    )
                    toast.success('Distribución por capacidad aplicada')
                  })
                  .catch((reason) =>
                    toast.error('No se pudo calcular', { description: fail(reason) }),
                  )
              }}
            >
              Por capacidad
            </Button>
            <p className="text-sm font-black">
              Total:{' '}
              {(() => {
                try {
                  const total = sumPercentages(
                    expenseForm.watch('shares').map((s) => s.percentage),
                  )
                  return `${formatDecimal(total, 'es-CO', 2)}%`
                } catch {
                  return '—'
                }
              })()}
            </p>
            {sharePreview.map((s) => (
              <p key={s.membership_id} className="text-xs font-semibold">
                {memberOptions.find((m) => m.id === s.membership_id)?.user.name}:{' '}
                {formatMoney(s.amount, expenseForm.watch('currency_code'))}
                {s.receives_rounding_residue ? ' · recibe residuo' : ''}
              </p>
            ))}
          </div>
        </FormField>
      </Dialog>

      <Dialog
        open={Boolean(committingExpense)}
        onOpenChange={(open) => !open && setCommittingExpense(null)}
        title="Marcar gasto como comprometido"
        footer={
          <Button
            disabled={commitExpense.isPending}
            onClick={commitExpenseForm.handleSubmit((v) => commitExpense.mutate(v))}
          >
            {commitExpense.isPending ? 'Confirmando…' : 'Confirmar comprometido'}
          </Button>
        }
      >
        <Alert className="mb-2">
          {committingExpense
            ? `Programado: ${formatMoney(committingExpense.amount, committingExpense.currency_code)} · ${scheduleAnchorLabel(committingExpense.frequency ?? 'once', committingExpense.occurred_on)}`
            : null}
        </Alert>
        <MoneyField
          form={commitExpenseForm}
          name="amount"
          label="Importe real"
          tooltip="Monto real del período. Si difiere de lo programado, usa el valor verdadero."
        />
        <TextField
          form={commitExpenseForm}
          name="occurred_on"
          label="Fecha del gasto"
          type="date"
          tooltip="Fecha en la que se compromete o ocurre este gasto del período."
        />
      </Dialog>

      <Dialog
        open={Boolean(selectedExpense)}
        onOpenChange={(open) => !open && setSelectedExpense(null)}
        title={`Detalle de gasto #${selectedExpense?.id ?? ''}`}
        description={selectedExpense?.rounding_explanation}
        footer={
          selectedExpense &&
          selectedExpense.pending_amount !== '0.0000' &&
          hasPermission('gastos.registrar_pago') ? (
            <Button onClick={paymentForm.handleSubmit((v) => pay.mutate(v))}>
              Registrar pago
            </Button>
          ) : undefined
        }
      >
        {selectedExpense ? (
          <>
            <p className="text-2xl font-black">
              {formatMoney(selectedExpense.amount, selectedExpense.currency_code)}
            </p>
            <Badge tone={expenseStatusTone(selectedExpense.status)}>
              {expenseStatusLabel(selectedExpense.status)}
            </Badge>
            <div>
              <h3 className="font-black">Participaciones</h3>
              {selectedExpense.shares.map((s) => (
                <p key={s.id} className="text-sm">
                  {s.membership?.user?.name ?? `Integrante ${s.membership_id}`}:{' '}
                  {formatDecimal(s.percentage, 'es-CO', 2)}% ·{' '}
                  {formatMoney(s.amount, selectedExpense.currency_code)}
                  {s.receives_rounding_residue ? ' · recibe residuo' : ''}
                </p>
              ))}
            </div>
            <div>
              <h3 className="font-black">Pagos</h3>
              {selectedExpense.payments.length ? (
                selectedExpense.payments.map((p) => (
                  <p key={p.id} className="text-sm">
                    {formatMoney(p.amount, p.currency_code)} · {formatDate(p.paid_on)}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-500">Sin pagos</p>
              )}
            </div>
            {selectedExpense.pending_amount !== '0.0000' ? (
              <>
                <SelectField
                  form={paymentForm}
                  name="payer_membership_id"
                  label="Pagador"
                  options={memberOptions.map((m) => [String(m.id), m.user.name])}
                />
                <SelectField
                  form={paymentForm}
                  name="account_id"
                  label="Desde cuenta"
                  options={activeAccounts.map((a) => [
                    String(a.id),
                    `${a.name} (${a.currency_code})`,
                  ])}
                />
                <MoneyField form={paymentForm} name="amount" label="Importe" />
                <TextField form={paymentForm} name="paid_on" label="Fecha" type="date" />
              </>
            ) : null}
          </>
        ) : null}
      </Dialog>
    </main>
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

function CardList({ children, empty }: { children: ReactNode; empty: string }) {
  const items = Array.isArray(children) ? children : [children]
  return items.filter(Boolean).length ? (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  ) : (
    <div className="rounded-2xl border border-dashed p-8 text-center font-semibold text-slate-500">
      <ReceiptText className="mx-auto mb-2 h-8 w-8" />
      {empty}
    </div>
  )
}

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

function TextField({
  form,
  name,
  label,
  type = 'text',
  tooltip,
}: {
  form: UseFormReturn<any>
  name: string
  label: string
  type?: string
  tooltip?: string
}) {
  return (
    <FormField
      label={label}
      tooltip={tooltip}
      error={form.formState.errors[name]?.message as string | undefined}
    >
      <Input type={type} {...form.register(name)} />
    </FormField>
  )
}

function MoneyField({
  form,
  name,
  label,
  tooltip,
}: {
  form: UseFormReturn<any>
  name: string
  label: string
  tooltip?: string
}) {
  return (
    <FormField
      label={label}
      tooltip={tooltip}
      error={form.formState.errors[name]?.message as string | undefined}
    >
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <MoneyInput
            name={field.name}
            value={field.value ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
          />
        )}
      />
    </FormField>
  )
}

const EMPTY_SELECT = '__empty__'

function SelectField({
  form,
  name,
  label,
  options,
  allowEmpty = false,
  tooltip,
}: {
  form: UseFormReturn<any>
  name: string
  label: string
  options: [string, string][]
  allowEmpty?: boolean
  tooltip?: string
}) {
  return (
    <FormField
      label={label}
      tooltip={tooltip}
      error={form.formState.errors[name]?.message as string | undefined}
    >
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select
            name={field.name}
            value={field.value || undefined}
            onBlur={field.onBlur}
            onValueChange={(next) =>
              field.onChange(next === EMPTY_SELECT ? '' : next)
            }
            placeholder="Selecciona…"
            options={[
              ...(allowEmpty
                ? [{ value: EMPTY_SELECT, label: 'Selecciona…' }]
                : []),
              ...options.map(([value, text]) => ({ value, label: text })),
            ]}
          />
        )}
      />
    </FormField>
  )
}
