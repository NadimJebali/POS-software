// Unit tests for the shared settings schema: defaults + coercion of the raw
// key/value row into typed values. Pure — no db, no Electron, no React.
import { describe, test, expect } from 'vitest'
import { parseSettings, DEFAULT_SETTINGS } from '../src/shared/settings'

describe('parseSettings', () => {
  test('falls back to typed defaults for an empty row', () => {
    const s = parseSettings({})
    expect(s.lowStockThreshold).toBe(5)
    expect(s.autoLockMinutes).toBe(0)
    expect(s.printSilent).toBe(false)
    expect(s.currency).toEqual({ symbol: 'DT', decimals: 3, position: 'after' })
  })

  test('coerces stored strings to numbers and booleans', () => {
    const s = parseSettings({ low_stock_threshold: '8', auto_lock_minutes: '15', print_silent: '1', currency_decimals: '2' })
    expect(s.lowStockThreshold).toBe(8)
    expect(s.autoLockMinutes).toBe(15)
    expect(s.printSilent).toBe(true)
    expect(s.currency.decimals).toBe(2)
  })

  test('clamps currency decimals to 0..3', () => {
    expect(parseSettings({ currency_decimals: '9' }).currency.decimals).toBe(3)
    expect(parseSettings({ currency_decimals: '0' }).currency.decimals).toBe(0)
  })

  test('a non-numeric or missing value resolves to its default, never NaN', () => {
    expect(parseSettings({ low_stock_threshold: 'abc' }).lowStockThreshold).toBe(5)
    expect(parseSettings({ auto_lock_minutes: '' }).autoLockMinutes).toBe(0)
  })

  test('passes string-typed fields through (symbol, position, paper width)', () => {
    const s = parseSettings({ currency_symbol: '$', currency_position: 'before', paper_width: '58' })
    expect(s.currency.symbol).toBe('$')
    expect(s.currency.position).toBe('before')
    expect(s.paperWidth).toBe('58')
  })

  test('exposes the storage-form defaults for the DB seed', () => {
    expect(DEFAULT_SETTINGS.currency_decimals).toBe('3')
    expect(DEFAULT_SETTINGS.language).toBe('en')
  })

  test('parses the fullscreen flag, defaulting to windowed (off)', () => {
    expect(parseSettings({}).fullscreen).toBe(false)
    expect(parseSettings({ fullscreen: '1' }).fullscreen).toBe(true)
    expect(DEFAULT_SETTINGS.fullscreen).toBe('0')
  })

  test('parses the selected theme, defaulting to ember', () => {
    expect(parseSettings({}).theme).toBe('ember')
    expect(parseSettings({ theme: 'midnight' }).theme).toBe('midnight')
    expect(DEFAULT_SETTINGS.theme).toBe('ember')
  })

  test('parses customer-display settings, defaulting to off with no chosen monitor', () => {
    expect(parseSettings({}).customerDisplay).toBe(false)
    expect(parseSettings({}).customerDisplayMonitor).toBe('')
    expect(parseSettings({ customer_display: '1', customer_display_monitor: '42' })).toMatchObject({
      customerDisplay: true,
      customerDisplayMonitor: '42'
    })
    expect(DEFAULT_SETTINGS.customer_display).toBe('0')
  })
})
