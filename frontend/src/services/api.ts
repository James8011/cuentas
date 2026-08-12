import type { ApiErrorBody } from './types'

export class ApiError extends Error {
  status: number
  body: ApiErrorBody

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? 'Error de la API')
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))

  if (!match) {
    return null
  }

  return decodeURIComponent(match.split('=').slice(1).join('='))
}

async function ensureCsrfCookie(): Promise<void> {
  await fetch('/sanctum/csrf-cookie', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
}

type RequestOptions = {
  method?: string
  body?: unknown
  skipCsrf?: boolean
}

async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method)

  if (needsCsrf && !options.skipCsrf) {
    await ensureCsrfCookie()
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const xsrf = readCookie('XSRF-TOKEN')
  if (xsrf) {
    headers['X-XSRF-TOKEN'] = xsrf
  }

  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const payload = (await response.json().catch(() => ({}))) as ApiErrorBody & T

  if (!response.ok) {
    throw new ApiError(response.status, payload)
  }

  return payload
}

async function apiFormRequest<T>(path: string, form: FormData, method = 'POST'): Promise<T> {
  await ensureCsrfCookie()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
  const xsrf = readCookie('XSRF-TOKEN')
  if (xsrf) {
    headers['X-XSRF-TOKEN'] = xsrf
  }

  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers,
    body: form,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const payload = (await response.json().catch(() => ({}))) as ApiErrorBody & T
  if (!response.ok) {
    throw new ApiError(response.status, payload)
  }
  return payload
}

function appendForm(form: FormData, body: Record<string, unknown>, file?: File | null) {
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'boolean') {
      form.append(key, value ? '1' : '0')
    } else {
      form.append(key, String(value))
    }
  }
  if (file) form.append('photo', file)
  return form
}

export { apiRequest }

export const api = {
  login: (phone: string, password: string) =>
    apiRequest<import('./types').AuthPayload>('/api/v1/login', {
      method: 'POST',
      body: { phone, password },
    }),
  logout: () =>
    apiRequest<{ message: string }>('/api/v1/logout', { method: 'POST' }),
  me: () => apiRequest<import('./types').AuthPayload>('/api/v1/me'),
  households: () =>
    apiRequest<{ data: import('./types').Household[] }>('/api/v1/households'),
  permissions: () =>
    apiRequest<{ data: import('./types').Permission[] }>('/api/v1/permissions'),
  members: (householdId: number) =>
    apiRequest<{ data: import('./types').Membership[] }>(
      `/api/v1/households/${householdId}/members`,
    ),
  createMember: (
    householdId: number,
    body: {
      name: string
      phone: string
      email?: string
      password: string
      role_ids: number[]
    },
  ) =>
    apiRequest<{ data: import('./types').Membership }>(
      `/api/v1/households/${householdId}/members`,
      { method: 'POST', body },
    ),
  updateMember: (
    householdId: number,
    membershipId: number,
    body: { status?: string; role_ids?: number[] },
  ) =>
    apiRequest<{ data: import('./types').Membership }>(
      `/api/v1/households/${householdId}/members/${membershipId}`,
      { method: 'PATCH', body },
    ),
  roles: (householdId: number) =>
    apiRequest<{ data: import('./types').Role[] }>(
      `/api/v1/households/${householdId}/roles`,
    ),
  createRole: (
    householdId: number,
    body: {
      name: string
      description?: string
      permission_keys: string[]
    },
  ) =>
    apiRequest<{ data: import('./types').Role }>(
      `/api/v1/households/${householdId}/roles`,
      { method: 'POST', body },
    ),
  updateRole: (
    householdId: number,
    roleId: number,
    body: {
      name?: string
      description?: string | null
      permission_keys?: string[]
      status?: string
    },
  ) =>
    apiRequest<{ data: import('./types').Role }>(
      `/api/v1/households/${householdId}/roles/${roleId}`,
      { method: 'PATCH', body },
    ),
  accounts: (householdId: number) =>
    apiRequest<{ data: import('./types').FinancialAccount[] }>(
      `/api/v1/households/${householdId}/accounts`,
    ),
  createAccount: (householdId: number, body: Record<string, unknown>) =>
    apiRequest<{ data: import('./types').FinancialAccount }>(
      `/api/v1/households/${householdId}/accounts`,
      { method: 'POST', body },
    ),
  updateAccount: (
    householdId: number,
    accountId: number,
    body: Record<string, unknown>,
  ) =>
    apiRequest<{ data: import('./types').FinancialAccount }>(
      `/api/v1/households/${householdId}/accounts/${accountId}`,
      { method: 'PATCH', body },
    ),
  categories: (householdId: number) =>
    apiRequest<{ data: import('./types').FinancialCategory[] }>(
      `/api/v1/households/${householdId}/categories`,
    ),
  createCategory: (householdId: number, body: Record<string, unknown>) =>
    apiRequest<{ data: import('./types').FinancialCategory }>(
      `/api/v1/households/${householdId}/categories`,
      { method: 'POST', body },
    ),
  updateCategory: (
    householdId: number,
    categoryId: number,
    body: Record<string, unknown>,
  ) =>
    apiRequest<{ data: import('./types').FinancialCategory }>(
      `/api/v1/households/${householdId}/categories/${categoryId}`,
      { method: 'PATCH', body },
    ),
  incomes: (householdId: number) =>
    apiRequest<{ data: import('./types').Income[] }>(
      `/api/v1/households/${householdId}/incomes`,
    ),
  createIncome: (householdId: number, body: Record<string, unknown>) =>
    apiRequest<{ data: import('./types').Income }>(
      `/api/v1/households/${householdId}/incomes`,
      { method: 'POST', body },
    ),
  updateIncome: (
    householdId: number,
    incomeId: number,
    body: Record<string, unknown>,
  ) =>
    apiRequest<{ data: import('./types').Income }>(
      `/api/v1/households/${householdId}/incomes/${incomeId}`,
      { method: 'PATCH', body },
    ),
  cancelIncome: (householdId: number, incomeId: number) =>
    apiRequest<{ data: import('./types').Income }>(
      `/api/v1/households/${householdId}/incomes/${incomeId}/cancel`,
      { method: 'POST', body: {} },
    ),
  receiveIncome: (
    householdId: number,
    incomeId: number,
    body: Record<string, unknown> = {},
  ) =>
    apiRequest<{ data: import('./types').Income }>(
      `/api/v1/households/${householdId}/incomes/${incomeId}/receive`,
      { method: 'POST', body },
    ),
  expenses: (householdId: number) =>
    apiRequest<{ data: import('./types').Expense[] }>(
      `/api/v1/households/${householdId}/expenses`,
    ),
  expense: (householdId: number, expenseId: number) =>
    apiRequest<{ data: import('./types').Expense }>(
      `/api/v1/households/${householdId}/expenses/${expenseId}`,
    ),
  createExpense: (householdId: number, body: Record<string, unknown>) =>
    apiRequest<{ data: import('./types').Expense }>(
      `/api/v1/households/${householdId}/expenses`,
      { method: 'POST', body },
    ),
  commitExpense: (
    householdId: number,
    expenseId: number,
    body: Record<string, unknown> = {},
  ) =>
    apiRequest<{ data: import('./types').Expense }>(
      `/api/v1/households/${householdId}/expenses/${expenseId}/commit`,
      { method: 'POST', body },
    ),
  cancelExpense: (householdId: number, expenseId: number) =>
    apiRequest<{ data: import('./types').Expense }>(
      `/api/v1/households/${householdId}/expenses/${expenseId}/cancel`,
      { method: 'POST', body: {} },
    ),
  createPayment: (
    householdId: number,
    expenseId: number,
    body: Record<string, unknown>,
  ) =>
    apiRequest<{ data: import('./types').Payment }>(
      `/api/v1/households/${householdId}/expenses/${expenseId}/payments`,
      { method: 'POST', body },
    ),
  balances: (householdId: number) =>
    apiRequest<{ data: import('./types').InternalBalance[] }>(
      `/api/v1/households/${householdId}/internal-balances`,
    ),
  recurrences: (householdId: number) =>
    apiRequest<{ data: import('./types').Recurrence[] }>(
      `/api/v1/households/${householdId}/recurrences`,
    ),
  createRecurrence: (householdId: number, body: Record<string, unknown>) =>
    apiRequest<{ data: import('./types').Recurrence }>(
      `/api/v1/households/${householdId}/recurrences`,
      { method: 'POST', body },
    ),
  generateRecurrence: (
    householdId: number,
    recurrenceId: number,
    body: Record<string, unknown>,
  ) =>
    apiRequest<{ data: import('./types').Expense | import('./types').Income }>(
      `/api/v1/households/${householdId}/recurrences/${recurrenceId}/generate`,
      { method: 'POST', body },
    ),
  generateDueRecurrences: () =>
    apiRequest<{ data: { template_id: number; status: string; message: string }[] }>(
      `/api/v1/recurrences/generate-due`,
      { method: 'POST', body: {} },
    ),
  debts: (householdId: number) =>
    apiRequest<{ data: import('./types').Debt[] }>(
      `/api/v1/households/${householdId}/debts`,
    ),
  createDebt: (householdId: number, body: Record<string, unknown>) =>
    apiRequest<{ data: import('./types').Debt }>(
      `/api/v1/households/${householdId}/debts`,
      { method: 'POST', body },
    ),
  updateDebt: (
    householdId: number,
    debtId: number,
    body: Record<string, unknown>,
  ) =>
    apiRequest<{ data: import('./types').Debt }>(
      `/api/v1/households/${householdId}/debts/${debtId}`,
      { method: 'PATCH', body },
    ),
  cancelDebt: (householdId: number, debtId: number) =>
    apiRequest<{ data: import('./types').Debt }>(
      `/api/v1/households/${householdId}/debts/${debtId}/cancel`,
      { method: 'POST', body: {} },
    ),
  createDebtPayment: (
    householdId: number,
    debtId: number,
    body: Record<string, unknown>,
  ) =>
    apiRequest<{ data: unknown }>(
      `/api/v1/households/${householdId}/debts/${debtId}/payments`,
      { method: 'POST', body },
    ),
  savingsGoals: (householdId: number) =>
    apiRequest<{ data: import('./types').SavingsGoal[] }>(
      `/api/v1/households/${householdId}/savings-goals`,
    ),
  createSavingsGoal: (householdId: number, body: Record<string, unknown>) =>
    apiRequest<{ data: import('./types').SavingsGoal }>(
      `/api/v1/households/${householdId}/savings-goals`,
      { method: 'POST', body },
    ),
  updateSavingsGoal: (
    householdId: number,
    goalId: number,
    body: Record<string, unknown>,
  ) =>
    apiRequest<{ data: import('./types').SavingsGoal }>(
      `/api/v1/households/${householdId}/savings-goals/${goalId}`,
      { method: 'PATCH', body },
    ),
  cancelSavingsGoal: (householdId: number, goalId: number) =>
    apiRequest<{ data: import('./types').SavingsGoal }>(
      `/api/v1/households/${householdId}/savings-goals/${goalId}/cancel`,
      { method: 'POST', body: {} },
    ),
  moveSavings: (
    householdId: number,
    goalId: number,
    body: Record<string, unknown>,
  ) =>
    apiRequest<{ data: unknown }>(
      `/api/v1/households/${householdId}/savings-goals/${goalId}/movements`,
      { method: 'POST', body },
    ),
  budgets: (householdId: number) =>
    apiRequest<{ data: import('./types').Budget[] }>(
      `/api/v1/households/${householdId}/budgets`,
    ),
  createBudget: (householdId: number, body: Record<string, unknown>) =>
    apiRequest<{ data: import('./types').Budget }>(
      `/api/v1/households/${householdId}/budgets`,
      { method: 'POST', body },
    ),
  updateBudget: (
    householdId: number,
    budgetId: number,
    body: Record<string, unknown>,
  ) =>
    apiRequest<{ data: import('./types').Budget }>(
      `/api/v1/households/${householdId}/budgets/${budgetId}`,
      { method: 'PATCH', body },
    ),
  cancelBudget: (householdId: number, budgetId: number) =>
    apiRequest<{ data: import('./types').Budget }>(
      `/api/v1/households/${householdId}/budgets/${budgetId}/cancel`,
      { method: 'POST', body: {} },
    ),
  cashFlow: (householdId: number, period: string) =>
    apiRequest<{ data: import('./types').CashFlow }>(
      `/api/v1/households/${householdId}/cash-flow?period=${encodeURIComponent(period)}`,
    ),
  closePeriod: (householdId: number, period: string) =>
    apiRequest<{ data: unknown }>(
      `/api/v1/households/${householdId}/period-closes`,
      { method: 'POST', body: { period } },
    ),
  distributionPreview: (
    householdId: number,
    body: { membership_ids: number[]; mode: 'income' | 'capacity' },
  ) =>
    apiRequest<{ data: { membership_id: number; percentage: string }[] }>(
      `/api/v1/households/${householdId}/distribution-preview`,
      { method: 'POST', body },
    ),
  settlements: (householdId: number) =>
    apiRequest<{ data: import('./types').Settlement[] }>(
      `/api/v1/households/${householdId}/settlements`,
    ),
  createSettlement: (householdId: number, body: Record<string, unknown>) =>
    apiRequest<{ data: import('./types').Settlement }>(
      `/api/v1/households/${householdId}/settlements`,
      { method: 'POST', body },
    ),
  auditLogs: (householdId: number) =>
    apiRequest<{ data: import('./types').AuditLogItem[] }>(
      `/api/v1/households/${householdId}/audit-logs`,
    ),
  exportUrl: (householdId: number, period: string) =>
    `/api/v1/households/${householdId}/export?period=${encodeURIComponent(period)}`,

  marketProducts: (householdId: number) =>
    apiRequest<{ data: import('./types').MarketProduct[] }>(
      `/api/v1/households/${householdId}/market/products`,
    ),
  createMarketProduct: (
    householdId: number,
    body: Record<string, unknown>,
    photo?: File | null,
  ) =>
    apiFormRequest<{ data: import('./types').MarketProduct }>(
      `/api/v1/households/${householdId}/market/products`,
      appendForm(new FormData(), body, photo),
    ),
  updateMarketProduct: (
    householdId: number,
    productId: number,
    body: Record<string, unknown>,
    photo?: File | null,
  ) =>
    apiFormRequest<{ data: import('./types').MarketProduct }>(
      `/api/v1/households/${householdId}/market/products/${productId}`,
      appendForm(new FormData(), body, photo),
    ),
  marketLists: (householdId: number) =>
    apiRequest<{ data: import('./types').MarketList[] }>(
      `/api/v1/households/${householdId}/market/lists`,
    ),
  marketList: (householdId: number, listId: number) =>
    apiRequest<{ data: import('./types').MarketList }>(
      `/api/v1/households/${householdId}/market/lists/${listId}`,
    ),
  createMarketList: (householdId: number, body: Record<string, unknown>) =>
    apiRequest<{ data: import('./types').MarketList }>(
      `/api/v1/households/${householdId}/market/lists`,
      { method: 'POST', body },
    ),
  updateMarketList: (
    householdId: number,
    listId: number,
    body: Record<string, unknown>,
  ) =>
    apiRequest<{ data: import('./types').MarketList }>(
      `/api/v1/households/${householdId}/market/lists/${listId}`,
      { method: 'PATCH', body },
    ),
  closeMarketList: (
    householdId: number,
    listId: number,
    body: Record<string, unknown> = {},
  ) =>
    apiRequest<{
      data: {
        list: import('./types').MarketList
        expense: unknown
        totals: import('./types').MarketListTotals
      }
    }>(`/api/v1/households/${householdId}/market/lists/${listId}/close`, {
      method: 'POST',
      body,
    }),
  cancelMarketList: (householdId: number, listId: number) =>
    apiRequest<{ data: import('./types').MarketList }>(
      `/api/v1/households/${householdId}/market/lists/${listId}/cancel`,
      { method: 'POST', body: {} },
    ),
  addMarketItem: (
    householdId: number,
    listId: number,
    body: Record<string, unknown>,
    photo?: File | null,
  ) =>
    apiFormRequest<{ data: import('./types').MarketListItem }>(
      `/api/v1/households/${householdId}/market/lists/${listId}/items`,
      appendForm(new FormData(), body, photo),
    ),
  updateMarketItem: (
    householdId: number,
    listId: number,
    itemId: number,
    body: Record<string, unknown>,
    photo?: File | null,
  ) =>
    apiFormRequest<{ data: import('./types').MarketListItem }>(
      `/api/v1/households/${householdId}/market/lists/${listId}/items/${itemId}`,
      appendForm(new FormData(), body, photo),
    ),
  deleteMarketItem: (householdId: number, listId: number, itemId: number) =>
    apiRequest<void>(
      `/api/v1/households/${householdId}/market/lists/${listId}/items/${itemId}`,
      { method: 'DELETE' },
    ),
  marketBudget: (householdId: number, period: string) =>
    apiRequest<{ data: import('./types').MarketBudgetSnapshot }>(
      `/api/v1/households/${householdId}/market/budget?period=${encodeURIComponent(period)}`,
    ),
}
