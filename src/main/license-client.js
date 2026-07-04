// Talks to the cloud license server (POST /activate, POST /renew) to exchange a
// typeable activation code for a signed machine-bound key, and to refresh that key.
// Kept free of Electron and filesystem concerns so it's unit-testable with `fetch`
// injected; the caller (license.js) still verifies returned keys OFFLINE before trust.

// Production license server. Overridable via deps.baseUrl for tests / staging.
const DEFAULT_BASE_URL = 'https://pos.nadimjebali.engineer'

// A failed request, carrying the server's machine-readable `code` so callers can
// branch (e.g. 'machine_limit' -> offer a rebind, 'network' -> stay silent) while
// showing `.message` to the user.
export class ActivationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ActivationError'
    this.code = code
  }
}

// POSTs `payload` as JSON and returns the parsed response body, mapping every
// failure mode to an ActivationError: unreachable server ('network'), non-JSON
// gateway pages ('server_error'), rate limiting ('rate_limited'), and domain
// refusals (the server's own `error` code). Never surfaces a raw fetch/parse error.
async function postJson(url, payload, deps) {
  const doFetch = deps.fetch ?? globalThis.fetch

  let res
  try {
    res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch {
    throw new ActivationError(
      'network',
      "Couldn't reach the licensing server. Check your internet connection and try again."
    )
  }

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
    throw new ActivationError(body.error || 'server_error', body.message || 'Request failed')
  }
  return body
}

// Exchanges a typeable activation code for a signed license key. `deps` =
// { fetch, baseUrl, appVersion } — all optional. Throws ActivationError on failure.
export async function requestActivation(code, machineId, deps = {}) {
  const baseUrl = deps.baseUrl ?? DEFAULT_BASE_URL
  const body = await postJson(`${baseUrl}/activate`, { code, machineId, appVersion: deps.appVersion }, deps)

  if (!body.license_key || typeof body.license_key !== 'string') {
    throw new ActivationError('server_error', 'The server returned an unexpected response. Please try again.')
  }
  return body.license_key
}

// POSTs the CURRENT signed key to /renew and returns { license_key, exp, graceUntil }
// with a refreshed key. Self-authenticating (the server verifies the presented key),
// so no secret is sent. Throws an ActivationError with the server's `code` on refusal
// (invalid_key / suspended / revoked / lapsed / unbound / machine_mismatch) or 'network'.
export async function requestRenewal(licenseKey, machineId, deps = {}) {
  const baseUrl = deps.baseUrl ?? DEFAULT_BASE_URL
  const body = await postJson(
    `${baseUrl}/renew`,
    { license_key: licenseKey, machineId, appVersion: deps.appVersion },
    deps
  )

  if (!body.license_key || typeof body.license_key !== 'string') {
    throw new ActivationError('server_error', 'The server returned an unexpected response.')
  }
  return { license_key: body.license_key, exp: body.exp, graceUntil: body.graceUntil ?? null }
}
