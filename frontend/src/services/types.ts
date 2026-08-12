export type User = {
  id: number
  name: string
  phone: string
  email: string | null
  status: 'active' | 'suspended'
}

export type Permission = {
  id: number
  key: string
  name: string
  description: string | null
  group: string
}

export type Role = {
  id: number
  household_id: number
  name: string
  description: string | null
  is_system: boolean
  status: 'active' | 'inactive'
  permission_keys?: string[]
  permissions?: Permission[]
}

export type Household = {
  id: number
  name: string
  country_code: string
  locale: string
  currency_code: string
  timezone: string
  membership?: { id: number; status: string } | null
  effective_permissions: string[]
}

export type Membership = {
  id: number
  household_id: number
  status: 'active' | 'suspended'
  joined_at: string | null
  suspended_at: string | null
  user: User
  roles: Role[]
  effective_permissions: string[]
}

export type AuthPayload = {
  user: User
  households: Household[]
}

export type ApiErrorBody = {
  message?: string
  errors?: Record<string, string[]>
}

export type FinancialAccount = {
  id: number
  household_id: number
  owner_membership_id: number | null
  name: string
  type: 'cash' | 'savings' | 'checking' | 'credit_card'
  currency_code: string
  opening_balance: string
  current_balance: string
  scope: 'individual' | 'shared'
  is_active: boolean
}

export type FinancialCategory = {
  id: number
  household_id: number
  name: string
  type: 'income' | 'expense'
  classification: 'essential' | 'discretionary' | null
  is_active: boolean
}

export type ExpenseShare = {
  id: number
  membership_id: number
  percentage: string
  amount: string
  receives_rounding_residue: boolean
  membership?: Membership
}

export type Payment = {
  id: number
  payer_membership_id: number
  account_id: number
  amount: string
  currency_code: string
  paid_on: string
  payer?: Membership
  account?: FinancialAccount
}

export type Expense = {
  id: number
  household_id: number
  category_id: number
  recurrence_template_id?: number | null
  scope: 'individual' | 'shared'
  classification: 'essential' | 'discretionary'
  amount: string
  paid_amount: string
  pending_amount: string
  currency_code: string
  occurred_on: string
  frequency: 'once' | 'weekly' | 'biweekly' | 'monthly'
  status: 'planned' | 'committed' | 'partial' | 'paid' | 'cancelled'
  notes: string | null
  shares: ExpenseShare[]
  payments: Payment[]
  category?: FinancialCategory
  rounding_explanation: string
}

export type Income = {
  id: number
  owner_membership_id: number
  account_id: number | null
  category_id: number
  recurrence_template_id?: number | null
  kind: 'fixed' | 'variable' | 'extraordinary'
  scope: 'individual' | 'shared'
  gross_amount: string | null
  net_amount: string
  currency_code: string
  expected_on: string | null
  effective_on: string | null
  frequency: 'once' | 'weekly' | 'biweekly' | 'monthly'
  status: 'expected' | 'received' | 'cancelled'
  notes: string | null
  category?: FinancialCategory
  account?: FinancialAccount
}

export type InternalBalance = {
  membership_id: number
  name: string
  responsibility: string
  paid: string
  settled_paid?: string
  settled_received?: string
  net_internal_balance: string
  meaning: 'adelantó' | 'debe'
}

export type Recurrence = {
  id: number
  kind: 'income' | 'expense'
  frequency: 'weekly' | 'biweekly' | 'monthly'
  starts_on: string
  ends_on: string | null
  next_occurrence_on: string
  is_active: boolean
}

export type Debt = {
  id: number
  name: string
  creditor_name: string
  current_balance: string
  minimum_payment: string
  currency_code: string
  status: string
  next_payment_on: string | null
  owner?: { user?: { name: string } }
}

export type SavingsGoal = {
  id: number
  name: string
  kind: 'goal' | 'emergency'
  scope: string
  target_amount: string
  current_amount: string
  remaining_amount?: string
  progress_percent?: string
  currency_code: string
  emergency_months: number | null
  status: string
}

export type Budget = {
  id: number
  name: string
  period: string
  scope: string
  currency_code: string
  status: string
  lines: { id: number; category_id: number; planned_amount: string; category?: { name: string } }[]
}

export type CashFlow = {
  period: string
  income_total: string
  expense_total: string
  net: string
  timeline: { date: string; inflow: string; outflow: string; running_balance: string }[]
  warnings: { date: string; message: string }[]
}

export type Settlement = {
  id: number
  amount: string
  currency_code: string
  settled_on: string
  from_membership?: { user?: { name: string } }
  to_membership?: { user?: { name: string } }
}

export type AuditLogItem = {
  id: number
  action: string
  created_at: string
  actor?: { name: string } | null
}

export type MarketUnit = 'unit' | 'kg' | 'g' | 'lb' | 'l' | 'ml' | 'pack'

export type MarketProduct = {
  id: number
  household_id: number
  name: string
  unit: MarketUnit | string
  last_unit_price: string | null
  photo_path: string | null
  photo_url: string | null
  notes: string | null
  is_active: boolean
}

export type MarketListItem = {
  id: number
  market_list_id: number
  market_product_id: number | null
  name: string
  unit: MarketUnit | string
  quantity_planned: string
  quantity_bought: string | null
  estimated_unit_price: string
  actual_unit_price: string | null
  estimated_total: string
  bought_total: string
  is_checked: boolean
  notes: string | null
  photo_path: string | null
  photo_url: string | null
  sort_order: number
  product?: MarketProduct | null
}

export type MarketListTotals = {
  estimated_total: string
  bought_total: string
  pending_estimated_total: string
  projection_total: string
  items_count: number
  checked_count: number
}

export type MarketBudgetSnapshot = {
  period: string
  category: { id: number; name: string; system_key?: string | null }
  budget_id: number | null
  planned_amount: string
  spent_amount: string
  available_amount: string
  has_budget_line: boolean
}

export type MarketList = {
  id: number
  household_id: number
  name: string
  status: 'active' | 'shopping' | 'closed' | 'cancelled' | string
  period: string
  notes: string | null
  expense_id: number | null
  closed_at: string | null
  created_by?: string | null
  items: MarketListItem[]
  totals: MarketListTotals
  budget?: MarketBudgetSnapshot | null
}
