// Unit tests for the shared translation engine. Pure: takes a dictionary, a lang,
// a dotted key and vars; resolves with English fallback and {placeholder} interpolation.
import { describe, test, expect } from 'vitest'
import { translate } from '../src/shared/i18n'

const dict = {
  en: { common: { save: 'Save' }, order: { total: 'Total', eachPrice: '{price} each', greet: 'Hi {name}, {name}!' } },
  fr: { common: { save: 'Enregistrer' }, order: { total: 'Total' } }
}

describe('translate', () => {
  test('resolves a dotted key in the requested language', () => {
    expect(translate(dict, 'fr', 'common.save')).toBe('Enregistrer')
  })

  test('falls back to English when the language lacks the key', () => {
    expect(translate(dict, 'fr', 'order.eachPrice', { price: '2.500' })).toBe('2.500 each')
  })

  test('falls back to English for an unknown language entirely', () => {
    expect(translate(dict, 'de', 'common.save')).toBe('Save')
  })

  test('returns the key itself when no language has it', () => {
    expect(translate(dict, 'fr', 'order.missing')).toBe('order.missing')
  })

  test('interpolates every occurrence of a placeholder', () => {
    expect(translate(dict, 'en', 'order.greet', { name: 'Sam' })).toBe('Hi Sam, Sam!')
  })

  test('leaves unsupplied placeholders untouched', () => {
    expect(translate(dict, 'en', 'order.eachPrice')).toBe('{price} each')
  })
})
