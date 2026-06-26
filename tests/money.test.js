// Unit tests for the shared, pure currency module. No db, no Electron, no React —
// it takes millimes + an explicit currency config and returns a display string.
import { describe, test, expect } from 'vitest'
import { formatMoney, unitsToMillis } from '../src/shared/money'

const TND = { symbol: 'DT', decimals: 3, position: 'after' }

describe('formatMoney', () => {
  test('formats millimes with the configured decimals and trailing symbol', () => {
    expect(formatMoney(12500, TND)).toBe('12.500 DT')
  })

  test('places the symbol before the number when configured', () => {
    expect(formatMoney(12500, { symbol: '$', decimals: 2, position: 'before' })).toBe('$12.50')
  })

  test('keeps the sign outside the symbol for negatives', () => {
    expect(formatMoney(-12500, TND)).toBe('-12.500 DT')
    expect(formatMoney(-12500, { symbol: '$', decimals: 2, position: 'before' })).toBe('-$12.50')
  })

  test('clamps decimals to 0..3', () => {
    expect(formatMoney(12500, { symbol: 'DT', decimals: 9, position: 'after' })).toBe('12.500 DT')
    expect(formatMoney(12000, { symbol: 'DT', decimals: 0, position: 'after' })).toBe('12 DT')
  })

  test('trims when the symbol is empty', () => {
    expect(formatMoney(1000, { symbol: '', decimals: 3, position: 'after' })).toBe('1.000')
  })

  test('treats nullish millis as zero', () => {
    expect(formatMoney(null, TND)).toBe('0.000 DT')
  })
})

describe('unitsToMillis', () => {
  test('parses a decimal string to integer millimes', () => {
    expect(unitsToMillis('12.5')).toBe(12500)
  })

  test('accepts a comma decimal separator', () => {
    expect(unitsToMillis('12,5')).toBe(12500)
  })

  test('returns 0 for non-numeric input', () => {
    expect(unitsToMillis('abc')).toBe(0)
  })
})
