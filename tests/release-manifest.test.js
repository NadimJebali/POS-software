// The release manifest (releases.json) the publish script maintains on the update
// feed: one entry per published version, consumed by the platform's download page.
import { describe, test, expect } from 'vitest'
import { upsertRelease, parseLatestYml } from '../scripts/release-manifest.mjs'

describe('upsertRelease', () => {
  test('appends a new version without touching existing entries', () => {
    const existing = [{ version: '0.2.0', date: '2026-06-01', file: 'a.exe', size: 1 }]
    const entry = { version: '0.3.0', date: '2026-07-04', file: 'b.exe', size: 2, notes: 'Split bills' }

    const out = upsertRelease(existing, entry)

    expect(out).toHaveLength(2)
    expect(out).toContainEqual(existing[0])
    expect(out).toContainEqual(entry)
    expect(existing).toHaveLength(1) // input not mutated
  })

  test('re-publishing the same version replaces its entry instead of duplicating', () => {
    const existing = [{ version: '0.3.0', date: '2026-07-01', file: 'old.exe', size: 1 }]

    const out = upsertRelease(existing, { version: '0.3.0', date: '2026-07-04', file: 'new.exe', size: 2 })

    expect(out).toHaveLength(1)
    expect(out[0].file).toBe('new.exe')
  })

  test('tolerates a corrupt existing manifest (non-array) by starting fresh', () => {
    const out = upsertRelease('garbage', { version: '0.1.0', date: '2026-01-01', file: 'a.exe', size: 1 })
    expect(out).toEqual([{ version: '0.1.0', date: '2026-01-01', file: 'a.exe', size: 1 }])
  })
})

describe('parseLatestYml', () => {
  test('reads the version and the top-level installer path, not the indented files url', () => {
    const yml = `version: 0.2.2
files:
  - url: POS-Software-0.2.1-setup.exe
    sha512: STALE==
    size: 111
path: POS-Software-0.2.2-setup.exe
sha512: REAL==
releaseDate: '2026-07-04T23:40:42.271Z'`
    expect(parseLatestYml(yml)).toEqual({ version: '0.2.2', file: 'POS-Software-0.2.2-setup.exe' })
  })
})
