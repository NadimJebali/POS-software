// The app's verifying keyring (#28). makeKeyring builds the { keys, legacyKid } shape the
// shared verifyLicense expects: the current key is the legacy key pre-kid licences verify
// against, and an optional next key (with its kid) rides along during a rotation window so
// a new signing key can ship in an app update before the server cuts over. Tested end to
// end against the vendored verifier with generated keypairs.
import { test, expect } from 'vitest'
import crypto from 'crypto'
import { makeKeyring } from '../src/main/keyring'
import { signLicense, verifyLicense, buildPayload } from '../src/shared/license-format'

function keypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  return { pub: publicKey.export({ type: 'spki', format: 'pem' }).toString(), priv: privateKey }
}
const base = { machineId: 'M', now: 1000, renewalWindowDays: 30, warnDays: 7 }

test('a keyring with only the current key uses it as the legacy key', () => {
  const cur = keypair()
  const kr = makeKeyring({ current: cur.pub })
  expect(kr.legacyKid).toBe('legacy')
  expect(kr.keys.legacy).toBe(cur.pub)
})

test('a keyring carries a next key under its kid', () => {
  const cur = keypair()
  const next = keypair()
  const kr = makeKeyring({ current: cur.pub, next: { kid: 'k2', key: next.pub } })
  expect(kr.keys.legacy).toBe(cur.pub)
  expect(kr.keys.k2).toBe(next.pub)
})

test('a legacy (no-kid) licence verifies against the current key', () => {
  const cur = keypair()
  const kr = makeKeyring({ current: cur.pub })
  const lic = signLicense(buildPayload({ ...base }), cur.priv)
  expect(verifyLicense(lic, kr).machineId).toBe('M')
})

test('a licence signed under the next key verifies once its kid is in the keyring', () => {
  const cur = keypair()
  const next = keypair()
  const kr = makeKeyring({ current: cur.pub, next: { kid: 'k2', key: next.pub } })
  const lic = signLicense(buildPayload({ ...base, kid: 'k2' }), next.priv)
  expect(verifyLicense(lic, kr).machineId).toBe('M')
})

test('an unknown kid fails closed', () => {
  const cur = keypair()
  const rogue = keypair()
  const kr = makeKeyring({ current: cur.pub })
  const lic = signLicense(buildPayload({ ...base, kid: 'k9' }), rogue.priv)
  expect(() => verifyLicense(lic, kr)).toThrow(/signature is invalid/)
})
