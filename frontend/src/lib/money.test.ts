import { describe, expect, it } from 'vitest'
import {
  allocateExpense,
  formatDecimal,
  formatDecimalLive,
  normalizeDecimal,
  parseDecimalInput,
  sumPercentages,
} from './money'

describe('distribución exacta de gastos', () => {
  it('aplica un flujo 50/50 sin usar coma flotante', () => {
    const result = allocateExpense('100000.0000', [
      { membership_id: 1, percentage: '50.0000' },
      { membership_id: 2, percentage: '50.0000' },
    ])

    expect(result.map((share) => share.amount)).toEqual([
      '50000.0000',
      '50000.0000',
    ])
    expect(sumPercentages(result.map((share) => share.percentage))).toBe(
      '100.0000',
    )
  })

  it('asigna el residuo al último share y rechaza una suma distinta de 100', () => {
    const result = allocateExpense('10.0000', [
      { membership_id: 1, percentage: '33.3333' },
      { membership_id: 2, percentage: '33.3333' },
      { membership_id: 3, percentage: '33.3334' },
    ])

    expect(result.map((share) => share.amount)).toEqual([
      '3.3333',
      '3.3333',
      '3.3334',
    ])
    expect(result[2].receives_rounding_residue).toBe(true)
    expect(() =>
      allocateExpense('10.0000', [
        { membership_id: 1, percentage: '99.9999' },
      ]),
    ).toThrow(/100/)
  })
})

describe('formato decimal de entrada', () => {
  it('normaliza y muestra solo 2 decimales en UI', () => {
    expect(normalizeDecimal('1250', 2)).toBe('1250.00')
    expect(formatDecimal('1250', 'es-CO', 2)).toBe('1.250,00')
    expect(formatDecimal('1500000.5', 'es-CO', 2)).toBe('1.500.000,50')
  })

  it('formatea en vivo mientras se escribe', () => {
    expect(formatDecimalLive('1500000', 'es-CO', 2)).toBe('1.500.000')
    expect(formatDecimalLive('1500000,', 'es-CO', 2)).toBe('1.500.000,')
    expect(formatDecimalLive('1500000,5', 'es-CO', 2)).toBe('1.500.000,5')
    expect(formatDecimalLive('1500000,56', 'es-CO', 2)).toBe('1.500.000,56')
    expect(formatDecimalLive('1500000,567', 'es-CO', 2)).toBe('1.500.000,56')
  })

  it('acepta coma y punto como separador decimal', () => {
    expect(parseDecimalInput('1.250,5', 2)).toBe('1250.50')
    expect(parseDecimalInput('12,34', 2)).toBe('12.34')
    expect(parseDecimalInput('12.34', 2)).toBe('12.34')
    expect(parseDecimalInput('abc')).toBeNull()
  })

  it('trata el punto como miles en es-CO (no como decimal)', () => {
    expect(parseDecimalInput('1.500', 2)).toBe('1500.00')
    expect(parseDecimalInput('150.000', 2)).toBe('150000.00')
    expect(parseDecimalInput('1.500.000', 2)).toBe('1500000.00')
    expect(parseDecimalInput('1.500.000,50', 2)).toBe('1500000.50')
  })

  it('no reinterpreta valores canónicos de API con .0000', () => {
    expect(parseDecimalInput('1500000.0000', 2)).toBe('1500000.00')
    expect(formatDecimal('1500000.0000', 'es-CO', 2)).toBe('1.500.000,00')
    expect(parseDecimalInput('1500000.00', 2)).toBe('1500000.00')
  })
})
