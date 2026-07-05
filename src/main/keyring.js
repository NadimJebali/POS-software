// Builds the app's verifying keyring for the shared verifyLicense ({ keys, legacyKid }).
// The current key is the legacy key that pre-kid (no-kid) licences verify against; an
// optional `next` key (with its kid) is carried during a rotation window so licences
// signed by either the current or the next key verify — letting a new signing key ship in
// an app update before the server cuts over (no flag day).
//
// Pure and electron-free by design, so it's unit-testable without a build.
export function makeKeyring({ current, legacyKid = 'legacy', next }) {
  const keys = { [legacyKid]: current }
  if (next && next.kid && next.key) keys[next.kid] = next.key
  return { keys, legacyKid }
}
