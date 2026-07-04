// Unit tests for the activation network client: the app exchanging a typeable
// activation code for a signed license key via the server's POST /activate.
// `fetch` and the base URL are injected so these tests make no real network calls.
import { describe, test, expect, vi } from 'vitest'
import { requestActivation } from '../src/main/license-client'

// Builds a stub fetch that returns one canned Response and records the last request.
function stubFetch(response) {
  const calls = []
  const fetch = vi.fn(async (url, init) => {
    calls.push({ url, init })
    return response
  })
  return { fetch, calls }
}

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body
})

describe('requestActivation', () => {
  test('posts the code and machine id, and returns the signed license key', async () => {
    const { fetch, calls } = stubFetch(jsonResponse(200, { license_key: 'PAYLOAD.SIG', exp: 123 }))

    const key = await requestActivation('POSK-ABCD-EFGH', 'MID-1234', {
      fetch,
      baseUrl: 'https://example.test',
      appVersion: '0.2.0'
    })

    expect(key).toBe('PAYLOAD.SIG')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://example.test/activate')
    expect(calls[0].init.method).toBe('POST')
    const sent = JSON.parse(calls[0].init.body)
    expect(sent).toMatchObject({ code: 'POSK-ABCD-EFGH', machineId: 'MID-1234', appVersion: '0.2.0' })
  })

  test('an unknown code fails with a friendly message and preserves the server code', async () => {
    const { fetch } = stubFetch(
      jsonResponse(404, { error: 'invalid_code', message: 'That activation code is not valid' })
    )

    const err = await requestActivation('WRONG', 'MID-1234', { fetch, baseUrl: 'https://example.test' }).then(
      () => null,
      (e) => e
    )

    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('invalid_code')
    expect(err.message).toMatch(/not valid/i)
  })

  test('machine_limit is surfaced with its code so the UI can offer a rebind', async () => {
    const { fetch } = stubFetch(
      jsonResponse(409, { error: 'machine_limit', message: 'This license is already active on another machine' })
    )

    const err = await requestActivation('POSK', 'MID-NEW', { fetch, baseUrl: 'https://example.test' }).then(
      () => null,
      (e) => e
    )

    expect(err.code).toBe('machine_limit')
    expect(err.message).toMatch(/another machine/i)
  })

  test('a suspended license reports the reason from the server', async () => {
    const { fetch } = stubFetch(
      jsonResponse(403, { error: 'suspended', message: 'This license is suspended — please contact the vendor' })
    )

    const err = await requestActivation('POSK', 'MID-1', { fetch, baseUrl: 'https://example.test' }).then(
      () => null,
      (e) => e
    )

    expect(err.code).toBe('suspended')
    expect(err.message).toMatch(/suspended/i)
  })

  test('an unreachable server yields a friendly offline message, not a raw fetch error', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })

    const err = await requestActivation('POSK', 'MID-1', { fetch, baseUrl: 'https://example.test' }).then(
      () => null,
      (e) => e
    )

    expect(err.code).toBe('network')
    expect(err.message).toMatch(/could\s?n.?t reach|internet|connection/i)
  })

  test('rate limiting (429) maps to a friendly "slow down" message regardless of body', async () => {
    // @fastify/rate-limit returns { statusCode, error: 'Too Many Requests', message }.
    const { fetch } = stubFetch(
      jsonResponse(429, { statusCode: 429, error: 'Too Many Requests', message: 'Rate limit exceeded, retry in 1 minute' })
    )

    const err = await requestActivation('POSK', 'MID-1', { fetch, baseUrl: 'https://example.test' }).then(
      () => null,
      (e) => e
    )

    expect(err.code).toBe('rate_limited')
    expect(err.message).toMatch(/too many|wait|moment|try again/i)
  })

  test('a 2xx response missing a license key is treated as a failure, not a bad activation', async () => {
    const { fetch } = stubFetch(jsonResponse(200, { exp: 123 })) // no license_key

    const err = await requestActivation('POSK', 'MID-1', { fetch, baseUrl: 'https://example.test' }).then(
      () => null,
      (e) => e
    )

    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('server_error')
  })

  test('a non-JSON gateway error (e.g. Caddy 502 HTML) fails gracefully', async () => {
    const fetch = vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON')
      }
    }))

    const err = await requestActivation('POSK', 'MID-1', { fetch, baseUrl: 'https://example.test' }).then(
      () => null,
      (e) => e
    )

    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('server_error')
    expect(err.message).toMatch(/server|try again|unavailable/i)
  })
})
