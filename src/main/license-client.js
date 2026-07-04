// Talks to the cloud license server's POST /activate to exchange a typeable
// activation code for a signed, machine-bound license key. Kept free of Electron
// and filesystem concerns so it's unit-testable with `fetch` injected; the caller
// (license.js) still verifies the returned key OFFLINE before trusting it.

// Production license server. Overridable via deps.baseUrl for tests / staging.
const DEFAULT_BASE_URL = 'https://pos.nadimjebali.engineer'

// A failed activation, carrying the server's machine-readable `code` so callers can
// branch (e.g. 'machine_limit' -> offer a rebind) while showing `.message` to the user.
export class ActivationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ActivationError'
    this.code = code
  }
}

// POSTs { code, machineId, appVersion } to /activate and returns the license_key
// string on success. `deps` = { fetch, baseUrl, appVersion } — all optional.
// Throws an ActivationError (with the server's `code`) on any non-2xx response.
export async function requestActivation(code, machineId, deps = {}) {
  const doFetch = deps.fetch ?? globalThis.fetch
  const baseUrl = deps.baseUrl ?? DEFAULT_BASE_URL

  let res
  try {
    res = await doFetch(`${baseUrl}/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, machineId, appVersion: deps.appVersion })
    })
  } catch {
    // DNS failure, offline, TLS error, etc. — never surface a raw fetch error.
    throw new ActivationError(
      'network',
      "Couldn't reach the licensing server. Check your internet connection and try again."
    )
  }

  // Caddy or an upstream hiccup can return non-JSON (e.g. an HTML 502 page); don't
  // let that surface as a raw SyntaxError.
  let body
  try {
    body = await res.json()
  } catch {
    throw new ActivationError('server_error', 'The licensing server is temporarily unavailable. Please try again.')
  }

  if (res.status === 429) {
    // The rate limiter's body isn't a domain error — give our own friendly message.
    throw new ActivationError('rate_limited', 'Too many attempts. Please wait a moment and try again.')
  }

  if (!res.ok) {
    throw new ActivationError(body.error || 'server_error', body.message || 'Activation failed')
  }

  if (!body.license_key || typeof body.license_key !== 'string') {
    throw new ActivationError('server_error', 'The server returned an unexpected response. Please try again.')
  }

  return body.license_key
}
