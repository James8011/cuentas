const SCALE = 4
const SCALE_FACTOR = 10n ** BigInt(SCALE)
export const MONEY_DISPLAY_SCALE = 2

function toScaled(value: string, scale = SCALE): bigint {
  if (!/^\d+(?:\.\d+)?$/.test(value.trim())) {
    throw new Error('Decimal inválido')
  }
  const [whole, fraction = ''] = value.trim().split('.')
  const padded = `${fraction}${'0'.repeat(scale)}`.slice(0, scale)
  return BigInt(whole) * 10n ** BigInt(scale) + BigInt(padded)
}

function fromScaled(value: bigint, scale = SCALE): string {
  const negative = value < 0n
  const absolute = negative ? -value : value
  const factor = 10n ** BigInt(scale)
  const whole = absolute / factor
  const fraction = (absolute % factor).toString().padStart(scale, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

export function sumPercentages(values: string[]): string {
  return fromScaled(values.reduce((sum, value) => sum + toScaled(value), 0n))
}

export function allocateExpense(
  amount: string,
  shares: { membership_id: number; percentage: string }[],
) {
  if (sumPercentages(shares.map((share) => share.percentage)) !== '100.0000') {
    throw new Error('Los porcentajes deben sumar 100.0000')
  }
  const amountScaled = toScaled(amount)
  let allocated = 0n
  return shares.map((share, index) => {
    const isLast = index === shares.length - 1
    const shareAmount = isLast
      ? amountScaled - allocated
      : (amountScaled * toScaled(share.percentage)) / (100n * SCALE_FACTOR)
    allocated += shareAmount
    return {
      ...share,
      amount: fromScaled(shareAmount),
      receives_rounding_residue: isLast,
    }
  })
}

/** Pad/truncate to exact scale decimals using string math (no float). */
export function normalizeDecimal(value: string, scale = SCALE): string {
  return fromScaled(toScaled(value, scale), scale)
}

export function getLocaleSeparators(locale = 'es-CO') {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6)
  return {
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? ',',
    group: parts.find((part) => part.type === 'group')?.value ?? '.',
  }
}

/**
 * Accepts locale-formatted amounts (`1.500.000`, `1.500.000,50`, `12,34`)
 * and canonical API values (`1500000.0000`), and returns `digits.scale`.
 *
 * In es-CO, `.` is thousands and `,` is decimal — so `150.000` is 150000,
 * not 150. Plain `1500000.0000` stays 1500000 (API canonical).
 */
export function parseDecimalInput(
  raw: string,
  scale = SCALE,
  locale = 'es-CO',
): string | null {
  const trimmed = raw.trim().replace(/\s/g, '')
  if (!trimmed) return null

  const { decimal, group } = getLocaleSeparators(locale)
  let normalized = trimmed.replace(
    new RegExp(`[${escapeRegExp(decimal)}${escapeRegExp(group)}]+$`),
    '',
  )
  if (!normalized) return null

  // Plain integer or canonical decimal from the API / form state.
  // A single `.` with exactly 3 fraction digits is ambiguous with es-CO
  // thousands (`1.500`), so that case falls through to locale rules.
  if (/^\d+$/.test(normalized)) {
    return normalizeDecimal(normalized, scale)
  }
  if (/^\d+\.\d+$/.test(normalized)) {
    const fraction = normalized.split('.')[1] ?? ''
    if (fraction.length !== 3) {
      const whole = normalized.split('.')[0] ?? ''
      if (whole.length > 15) return null
      return normalizeDecimal(normalized, scale)
    }
  }

  const escapedGroup = escapeRegExp(group)
  const groupRe = new RegExp(escapedGroup, 'g')

  if (normalized.includes(decimal)) {
    const [intPart, ...rest] = normalized.split(decimal)
    const whole = intPart.replace(groupRe, '').replace(/\D/g, '')
    const fraction = rest.join('').replace(groupRe, '').replace(/\D/g, '')
    if (!whole || whole.length > 15) return null
    normalized = fraction ? `${whole}.${fraction}` : whole
  } else if (normalized.includes(group)) {
    // Thousand grouping: 1.500 / 150.000 / 1.500.000
    const whole = normalized.replace(groupRe, '').replace(/\D/g, '')
    if (!whole || whole.length > 15) return null
    normalized = whole
  } else if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return null
  }

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null

  const [whole] = normalized.split('.')
  if (whole.length > 15) return null

  return normalizeDecimal(normalized, scale)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Live mask while typing: thousands separators + up to `scale` decimals.
 * Does not force trailing zeros until blur (`formatDecimal`).
 */
export function formatDecimalLive(raw: string, locale = 'es-CO', scale = MONEY_DISPLAY_SCALE): string {
  const { decimal } = getLocaleSeparators(locale)
  if (!raw.trim()) return ''

  const decimalParts = raw.split(decimal)
  const hasDecimal = decimalParts.length > 1
  const intDigits = (decimalParts[0] ?? '').replace(/\D/g, '').slice(0, 15)
  const fracDigits = hasDecimal
    ? decimalParts.slice(1).join('').replace(/\D/g, '').slice(0, scale)
    : ''

  if (!intDigits && !hasDecimal) return ''

  const whole = intDigits === '' ? '0' : intDigits
  const wholeFormatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(BigInt(whole))

  if (!hasDecimal) return wholeFormatted
  return `${wholeFormatted}${decimal}${fracDigits}`
}

/** Locale display with fixed fraction digits (never a bare integer). */
export function formatDecimal(
  value: string,
  locale = 'es-CO',
  scale = MONEY_DISPLAY_SCALE,
): string {
  const canonical = parseDecimalInput(value, scale) ?? normalizeDecimal('0', scale)
  const [whole, fraction = ''] = canonical.split('.')
  const wholeFormatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(BigInt(whole))
  const { decimal } = getLocaleSeparators(locale)
  return `${wholeFormatted}${decimal}${fraction.padEnd(scale, '0').slice(0, scale)}`
}

export function countDigitsBefore(value: string, caret: number): number {
  let count = 0
  const end = Math.max(0, Math.min(caret, value.length))
  for (let i = 0; i < end; i += 1) {
    if (value[i] >= '0' && value[i] <= '9') count += 1
  }
  return count
}

export function caretFromDigitCount(value: string, digitCount: number): number {
  if (digitCount <= 0) return 0
  let count = 0
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] >= '0' && value[i] <= '9') {
      count += 1
      if (count >= digitCount) return i + 1
    }
  }
  return value.length
}

export function formatMoney(value: string, currency: string, locale = 'es-CO') {
  const canonical = /^\d+(?:\.\d+)?$/.test(value.trim())
    ? normalizeDecimal(value.trim())
    : value
  const [whole, fraction = '00'] = canonical.split('.')
  const amount = Number(`${whole}.${fraction.slice(0, 4)}`)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
