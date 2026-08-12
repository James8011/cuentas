import { describe, expect, it } from 'vitest'
import {
  nextDateForQuincenaDay,
  nextDateForWeekday,
  quincenaDayFromDate,
  weekdayFromDate,
} from './dates'

describe('recurrence date helpers', () => {
  it('resuelve el próximo día de la semana', () => {
    // Wednesday 2026-08-12 → next Monday = 2026-08-17
    expect(nextDateForWeekday(1, new Date(2026, 7, 12))).toBe('2026-08-17')
    // Wednesday → Wednesday same day
    expect(nextDateForWeekday(3, new Date(2026, 7, 12))).toBe('2026-08-12')
  })

  it('resuelve el próximo día de quincena', () => {
    // Aug 12, day 5 → already past 5, next is 20
    expect(nextDateForQuincenaDay(5, new Date(2026, 7, 12))).toBe('2026-08-20')
    // Aug 12, day 15 → 15 already past? 15 > 12 so first half 15 is next
    expect(nextDateForQuincenaDay(15, new Date(2026, 7, 12))).toBe('2026-08-15')
    // Aug 25, day 5 → next month 5
    expect(nextDateForQuincenaDay(5, new Date(2026, 7, 25))).toBe('2026-09-05')
  })

  it('extrae anclas desde fechas guardadas', () => {
    expect(weekdayFromDate('2026-08-17')).toBe(1)
    expect(quincenaDayFromDate('2026-08-20')).toBe(5)
    expect(quincenaDayFromDate('2026-08-05')).toBe(5)
  })
})
