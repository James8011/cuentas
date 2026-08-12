type Tone = 'neutral' | 'success' | 'warning' | 'danger'

const accountTypes = {
  cash: 'Efectivo',
  savings: 'Ahorro',
  checking: 'Corriente',
  credit_card: 'Tarjeta',
} as const

const scopes = {
  individual: 'Individual',
  shared: 'Compartida',
} as const

const classifications = {
  essential: 'Esencial',
  discretionary: 'Discrecional',
} as const

const incomeKinds = {
  fixed: 'Fijo',
  variable: 'Variable',
  extraordinary: 'Extraordinario',
} as const

const incomeStatuses = {
  expected: 'Esperado',
  received: 'Recibido',
  cancelled: 'Cancelado',
} as const

const expenseStatuses = {
  planned: 'Programado',
  committed: 'Comprometido',
  partial: 'Parcial',
  paid: 'Pagado',
  cancelled: 'Cancelado',
} as const

const debtStatuses = {
  active: 'Activa',
  paid: 'Pagada',
  cancelled: 'Cancelada',
} as const

const savingsStatuses = {
  active: 'Activo',
  completed: 'Completado',
  cancelled: 'Cancelado',
} as const

const budgetStatuses = {
  open: 'Abierto',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
} as const

const frequencies = {
  once: 'Única',
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
} as const

const recurrenceKinds = {
  expense: 'Gasto',
  income: 'Ingreso',
} as const

function labelOf<T extends Record<string, string>>(map: T, value: string): string {
  return map[value as keyof T] ?? value
}

export function accountTypeLabel(value: string) {
  return labelOf(accountTypes, value)
}

export function scopeLabel(value: string) {
  return labelOf(scopes, value)
}

export function classificationLabel(value: string) {
  return labelOf(classifications, value)
}

export function incomeKindLabel(value: string) {
  return labelOf(incomeKinds, value)
}

export function incomeStatusLabel(value: string) {
  return labelOf(incomeStatuses, value)
}

export function expenseStatusLabel(value: string) {
  return labelOf(expenseStatuses, value)
}

export function debtStatusLabel(value: string) {
  return labelOf(debtStatuses, value)
}

export function savingsStatusLabel(value: string) {
  return labelOf(savingsStatuses, value)
}

export function budgetStatusLabel(value: string) {
  return labelOf(budgetStatuses, value)
}

export function frequencyLabel(value: string) {
  return labelOf(frequencies, value)
}

export function recurrenceKindLabel(value: string) {
  return labelOf(recurrenceKinds, value)
}

export function activeStatusTone(isActive: boolean): Tone {
  return isActive ? 'success' : 'neutral'
}

export function expenseStatusTone(status: string): Tone {
  if (status === 'paid') return 'success'
  if (status === 'cancelled') return 'danger'
  if (status === 'partial' || status === 'committed') return 'warning'
  return 'neutral'
}

export function incomeStatusTone(status: string): Tone {
  if (status === 'received') return 'success'
  if (status === 'cancelled') return 'danger'
  return 'warning'
}

export function balanceMeaningTone(meaning: string): Tone {
  return meaning === 'adelantó' ? 'success' : 'warning'
}
