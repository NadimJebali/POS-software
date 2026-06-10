import { describe, test, expect } from 'vitest'
import crypto from 'crypto'
import { hashPin, verifyPin, needsRehash } from '../src/main/auth-util'

describe('hashPin', () => {
  test('produces the self-describing scrypt format', () => {
    const stored = hashPin('1234')
    const parts = stored.split('$')
    expect(parts[0]).toBe('scrypt')
    expect(Number(parts[1])).toBe(32768) // N
    expect(Number(parts[2])).toBe(8) // r
    expect(Number(parts[3])).toBe(1) // p
    expect(parts[4]).toMatch(/^[0-9a-f]{32}$/) // 16-byte salt
    expect(parts[5]).toMatch(/^[0-9a-f]{128}$/) // 64-byte hash
  })

  test('salts hashes — same PIN never hashes the same twice', () => {
    expect(hashPin('1234')).not.toBe(hashPin('1234'))
  })
})

describe('verifyPin', () => {
  test('accepts the correct PIN and rejects a wrong one', () => {
    const stored = hashPin('4321')
    expect(verifyPin('4321', stored)).toBe(true)
    expect(verifyPin('4322', stored)).toBe(false)
    expect(verifyPin('', stored)).toBe(false)
  })

  test('still verifies legacy salt:hash entries (Node default scrypt)', () => {
    const salt = crypto.randomBytes(16).toString('hex')
    const legacy = `${salt}:${crypto.scryptSync('9999', salt, 64).toString('hex')}`
    expect(verifyPin('9999', legacy)).toBe(true)
    expect(verifyPin('9998', legacy)).toBe(false)
  })

  test('rejects malformed stored values without throwing', () => {
    expect(verifyPin('1234', '')).toBe(false)
    expect(verifyPin('1234', null)).toBe(false)
    expect(verifyPin('1234', 'garbage')).toBe(false)
    expect(verifyPin('1234', 'scrypt$bad')).toBe(false)
  })
})

describe('needsRehash', () => {
  test('flags legacy and weaker-parameter hashes, passes current ones', () => {
    const salt = crypto.randomBytes(16).toString('hex')
    const legacy = `${salt}:${crypto.scryptSync('1111', salt, 64).toString('hex')}`
    expect(needsRehash(legacy)).toBe(true)
    expect(needsRehash(`scrypt$16384$8$1$${salt}$deadbeef`)).toBe(true) // lower N
    expect(needsRehash(hashPin('1111'))).toBe(false)
  })
})
