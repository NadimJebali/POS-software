// Drift guard for the vendored licence-protocol files (POS-platform#13). Each file was
// copied from POS-platform (the source of truth) by scripts/vendor-protocol.mjs, which
// recorded its sha256 in protocol-manifest.json. This test recomputes those hashes and
// fails if a vendored copy has been hand-edited in this repo — so the mirror can't be
// silently patched out of sync with its source.
import { test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(repoRoot, 'tests/protocol-manifest.json'), 'utf8'))

// Hash on LF-normalised content, matching the vendor script — so git's autocrlf can't
// register as false drift.
const hash = (path) => createHash('sha256').update(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'), 'utf8').digest('hex')

test('every vendored protocol file matches its recorded checksum', () => {
  for (const [dest, expected] of Object.entries(manifest)) {
    expect(hash(join(repoRoot, dest)), `${dest} has drifted from the vendored source`).toBe(expected)
  }
})
