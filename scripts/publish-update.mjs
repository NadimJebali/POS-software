#!/usr/bin/env node
/*
 * Publish a new POS build to the auto-update feed (issue #24).
 *
 * Runs the production build, then uploads the installer + update metadata
 * (latest.yml, which carries the SHA512 electron-updater verifies) to the droplet's
 * static /updates directory. Installed apps poll that feed and self-update on quit.
 *
 * Usage:
 *   node scripts/publish-update.mjs                     # build, then upload
 *   node scripts/publish-update.mjs --skip-build        # upload an existing release/ build
 *   node scripts/publish-update.mjs --dry-run           # build + list what WOULD upload
 *   node scripts/publish-update.mjs --notes "Split bills"  # release notes for the download page
 *
 * Besides the update feed (latest.yml), this maintains releases.json — the manifest
 * the platform's public download page renders as its version history.
 *
 * Config via env (all optional; shown with their defaults):
 *   DEPLOY_HOST=pos.nadimjebali.engineer      # droplet host/domain
 *   DEPLOY_USER=root                          # ssh user
 *   UPDATES_DIR=/root/pos-platform/updates    # served as https://<host>/updates (platform#11)
 *   SSH_KEY=<path>                            # -i key for scp/ssh (omit to use the agent/default)
 *
 * Rollback: see UPDATES.md — re-upload an older build's latest.yml (+ its installer),
 * and the next poll serves the older version to fresh installs.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, existsSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { upsertRelease } from './release-manifest.mjs'

const args = new Set(process.argv.slice(2))
const skipBuild = args.has('--skip-build')
const dryRun = args.has('--dry-run')
const allowDevKey = args.has('--allow-dev-key')

// Optional release notes shown on the public download page's version history:
//   npm run publish:update -- --notes "Split bills, faster receipts"
const argv = process.argv.slice(2)
const notes = argv.includes('--notes') ? String(argv[argv.indexOf('--notes') + 1] ?? '').trim() : ''

// Refuse to publish a build that would embed the DEV license key (electron.vite.config
// injects LICENSE_PUBLIC_KEY / license-public.pem at build time). Guards against
// shipping a release real production licenses can't activate. Override with
// --allow-dev-key for a throwaway/internal build.
function hasProductionKey() {
  const env = process.env.LICENSE_PUBLIC_KEY
  if (env && env.includes('BEGIN PUBLIC KEY')) return true
  return existsSync('license-public.pem')
}
if (!skipBuild && !allowDevKey && !hasProductionKey()) {
  console.error(
    '\n✖ No production license public key found. Set LICENSE_PUBLIC_KEY (the key printed' +
      '\n  by keygen on the droplet) or drop license-public.pem in the project root, so the' +
      '\n  build embeds it. Re-run, or pass --allow-dev-key for an internal build.'
  )
  process.exit(1)
}

const HOST = process.env.DEPLOY_HOST || 'pos.nadimjebali.engineer'
const USER = process.env.DEPLOY_USER || 'root'
const UPDATES_DIR = process.env.UPDATES_DIR || '/root/pos-platform/updates'
const SSH_KEY = process.env.SSH_KEY || ''
const RELEASE_DIR = 'release'

const sshKeyArgs = SSH_KEY ? ['-i', SSH_KEY] : []

function run(cmd, cmdArgs, opts = {}) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(' ')}`)
  const res = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: process.platform === 'win32', ...opts })
  if (res.status !== 0) {
    console.error(`\n✖ Command failed (exit ${res.status ?? 'signal'}): ${cmd}`)
    process.exit(res.status || 1)
  }
}

// 1) Production build (electron-vite + electron-builder). `--publish never` builds the
//    feed metadata (latest.yml with SHA512) locally without auto-pushing anywhere.
if (!skipBuild) {
  run('npx', ['electron-vite', 'build'])
  run('npx', ['electron-builder', '--publish', 'never'])
} else {
  console.log('Skipping build (--skip-build).')
}

if (!existsSync(RELEASE_DIR)) {
  console.error(`\n✖ No ${RELEASE_DIR}/ directory — run without --skip-build first.`)
  process.exit(1)
}

// 2) Collect the feed artifacts: the metadata (latest.yml), the installer(s), and the
//    blockmap that enables differential downloads. Anything else in release/ is ignored.
const wanted = readdirSync(RELEASE_DIR).filter(
  (f) => f === 'latest.yml' || f.endsWith('.exe') || f.endsWith('.blockmap')
)

if (!wanted.includes('latest.yml')) {
  console.error('\n✖ release/latest.yml not found — is `publish` configured in package.json build?')
  process.exit(1)
}

// 3) Build this version's entry for the release manifest (releases.json) — the public
//    download page's version history. The current manifest is fetched from the droplet
//    (it's the authoritative copy), this version's entry is added/replaced, and the
//    updated manifest ships with the artifacts.
const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const installer = wanted.find((f) => f.endsWith('.exe'))
const entry = {
  version,
  date: new Date().toISOString(),
  file: installer,
  size: installer ? statSync(join(RELEASE_DIR, installer)).size : 0,
  ...(notes ? { notes } : {})
}

console.log(`\nArtifacts to publish to ${USER}@${HOST}:${UPDATES_DIR}`)
for (const f of wanted) console.log(`  • ${f}`)
console.log(`  • releases.json ← ${JSON.stringify(entry)}`)

if (dryRun) {
  console.log('\n--dry-run: nothing uploaded.')
  process.exit(0)
}

// Fetch the current manifest from the droplet (missing file -> empty list).
const fetched = spawnSync(
  'ssh',
  [...sshKeyArgs, `${USER}@${HOST}`, `cat ${UPDATES_DIR}/releases.json 2>/dev/null || echo []`],
  { encoding: 'utf8', shell: process.platform === 'win32' }
)
if (fetched.status !== 0) {
  console.error('\n✖ Could not reach the server to read the release manifest.')
  process.exit(1)
}
let current
try {
  current = JSON.parse(fetched.stdout)
} catch {
  current = []
}
writeFileSync(join(RELEASE_DIR, 'releases.json'), JSON.stringify(upsertRelease(current, entry), null, 2))

// 4) Ensure the remote directory exists, then upload. The installer/blockmap go FIRST
//    and the metadata (releases.json, then latest.yml) LAST, so neither the download
//    page nor a client can ever read metadata pointing at a file still mid-transfer.
run('ssh', [...sshKeyArgs, `${USER}@${HOST}`, `mkdir -p ${UPDATES_DIR}`])

const ordered = [...wanted.filter((f) => f !== 'latest.yml'), 'releases.json', 'latest.yml']
for (const f of ordered) {
  run('scp', [...sshKeyArgs, join(RELEASE_DIR, f), `${USER}@${HOST}:${UPDATES_DIR}/${f}`])
}

console.log(`\n✓ Published. Feed live at https://${HOST}/updates/latest.yml`)
console.log(`  Download page updated: https://${HOST}/ now lists v${version}.`)
console.log('  Installed apps will download in the background and update on next quit.')
