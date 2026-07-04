// Orchestration tests for silent background renewal. `fetch` is stubbed and the I/O
// boundaries (reading the stored key, persisting a new one, the machine id) are
// injected, so these exercise the real branching logic with no network, filesystem,
// or registry access. Electron is mocked only so importing license.js succeeds.
import { describe, test, expect, vi } from 'vitest'

vi.mock('electron', () => {
  const app = { getPath: () => 'C:/tmp/pos-test', getVersion: () => '0.2.0' }
  return { app, default: { app } }
})

import { renewLicense } from '../src/main/license'

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body
})

const okRenew = (body) => vi.fn(async () => jsonResponse(200, body))

describe('renewLicense', () => {
  const base = { machineId: 'MID-1', baseUrl: 'https://example.test' }

  test('on success it persists the refreshed key and reports renewed', async () => {
    const persist = vi.fn()
    const fetch = okRenew({ license_key: 'NEW.KEY', exp: 555, graceUntil: null })

    const res = await renewLicense({ ...base, fetch, persist, readKey: () => 'OLD.KEY' })

    expect(persist).toHaveBeenCalledWith('NEW.KEY')
    expect(res).toMatchObject({ renewed: true, exp: 555, graceUntil: null })
  })

  test('an unreachable server leaves the stored key untouched and stays silent', async () => {
    const persist = vi.fn()
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })

    const res = await renewLicense({ ...base, fetch, persist, readKey: () => 'OLD.KEY' })

    expect(persist).not.toHaveBeenCalled()
    expect(res).toEqual({ renewed: false, reason: 'network' })
  })

  test('a server refusal (revoked) leaves the key untouched — it will expire at exp', async () => {
    const persist = vi.fn()
    const fetch = vi.fn(async () => jsonResponse(403, { error: 'revoked', message: 'This license has been revoked' }))

    const res = await renewLicense({ ...base, fetch, persist, readKey: () => 'OLD.KEY' })

    expect(persist).not.toHaveBeenCalled()
    expect(res).toEqual({ renewed: false, reason: 'revoked' })
  })

  test('with no stored license it is a no-op and never calls the server', async () => {
    const fetch = vi.fn()

    const res = await renewLicense({ ...base, fetch, persist: vi.fn(), readKey: () => null })

    expect(fetch).not.toHaveBeenCalled()
    expect(res).toEqual({ renewed: false, reason: 'no_license' })
  })

  test('a malformed/foreign renewed key never clobbers the working license', async () => {
    const persist = vi.fn(() => {
      throw new Error('This license belongs to a different machine')
    })
    const fetch = okRenew({ license_key: 'FOREIGN.KEY', exp: 1, graceUntil: null })

    const res = await renewLicense({ ...base, fetch, persist, readKey: () => 'OLD.KEY' })

    expect(res).toEqual({ renewed: false, reason: 'verify_failed' })
  })
})
