#!/usr/bin/env node
/*
 * Publish a new POS build to the auto-update feed (issue #24).
 *
 * Runs the production build, then uploads the installer + update metadata
 * (latest.yml, which carries the SHA512 electron-updater verifies) to the droplet's
 * static /updates directory. Installed apps poll that feed and self-update on quit.
 *
 * Usage:
 *   node scripts/publish-update.mjs                # build, then upload
 *   node scripts/publish-update.mjs --skip-build   # upload an existing release/ build
 *   node scripts/publish-update.mjs --dry-run      # build + list what WOULD upload
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
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const args = new Set(process.argv.slice(2))
const skipBuild = args.has('--skip-build')
const dryRun = args.has('--dry-run')

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

console.log(`\nArtifacts to publish to ${USER}@${HOST}:${UPDATES_DIR}`)
for (const f of wanted) console.log(`  • ${f}`)

if (dryRun) {
  console.log('\n--dry-run: nothing uploaded.')
  process.exit(0)
}

// 3) Ensure the remote directory exists, then upload. Upload the installer/blockmap
//    FIRST and latest.yml LAST, so a client can never read metadata that points at a
//    file still mid-transfer.
run('ssh', [...sshKeyArgs, `${USER}@${HOST}`, `mkdir -p ${UPDATES_DIR}`])

const ordered = [...wanted.filter((f) => f !== 'latest.yml'), 'latest.yml']
for (const f of ordered) {
  run('scp', [...sshKeyArgs, join(RELEASE_DIR, f), `${USER}@${HOST}:${UPDATES_DIR}/${f}`])
}

console.log(`\n✓ Published. Feed live at https://${HOST}/updates/latest.yml`)
console.log('  Installed apps will download in the background and update on next quit.')
