// Cross-repo drift tripwire (POS-platform#13, client side). POS-software carries a
// VENDORED copy of the licence-protocol module + the shared golden fixture. This test
// proves the vendored verifier recovers the exact same golden payload the server locks
// in its own golden test — so if the copy ever diverges from the source, this fails in
// POS-software's CI rather than a customer's activation.
import { test, expect } from 'vitest'
import crypto from 'crypto'
import { verifyLicense } from '../src/shared/license-format.js'
import { GOLDEN_PUBLIC_KEY_PEM, GOLDEN_PAYLOAD, GOLDEN_LICENCE } from './golden-licence.js'

test('the vendored verifier recovers the shared golden payload', () => {
  const pub = crypto.createPublicKey(GOLDEN_PUBLIC_KEY_PEM)
  expect(verifyLicense(GOLDEN_LICENCE, pub)).toEqual(GOLDEN_PAYLOAD)
})
