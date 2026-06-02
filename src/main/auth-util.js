import crypto from 'crypto'

// PINs are stored hashed with scrypt — never in plain text. A 4-digit PIN has a
// tiny key space (10k combos), so if pos.db is ever copied the only thing standing
// between an attacker and every PIN is the per-hash work factor. We therefore use a
// deliberately heavy cost and a self-describing format so the parameters can be
// raised again later without locking anyone out.
//
// New format:  scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>
// Legacy format (still verified):  <saltHex>:<hashHex>  (scrypt with Node defaults)
const SCRYPT_N = 1 << 15 // 32768 — ~100ms/guess, ~50x the cost of the old default
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEYLEN = 64
// N*r*128 bytes exceeds scrypt's 32MB default ceiling at N=32768, so lift maxmem.
const MAXMEM = 128 * SCRYPT_N * SCRYPT_R * 2

function derive(pin, salt, n, r, p) {
  return crypto.scryptSync(String(pin), salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM }).toString('hex')
}

export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = derive(pin, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P)
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`
}

export function verifyPin(pin, stored) {
  if (!stored) return false
  let salt, hash, test
  if (stored.startsWith('scrypt$')) {
    const [, n, r, p, s, h] = stored.split('$')
    if (!s || !h) return false
    salt = s
    hash = h
    test = derive(pin, salt, Number(n), Number(r), Number(p))
  } else if (stored.includes(':')) {
    // Legacy entry written before the work-factor bump: scrypt with Node defaults.
    ;[salt, hash] = stored.split(':')
    test = crypto.scryptSync(String(pin), salt, KEYLEN).toString('hex')
  } else {
    return false
  }
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(test, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// True when a stored hash predates the current cost parameters, so the caller can
// transparently re-hash it after a successful login (opportunistic upgrade).
export function needsRehash(stored) {
  if (!stored || !stored.startsWith('scrypt$')) return true
  const [, n, r, p] = stored.split('$')
  return Number(n) < SCRYPT_N || Number(r) < SCRYPT_R || Number(p) < SCRYPT_P
}
