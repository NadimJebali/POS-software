#!/usr/bin/env node
/*
 * POS Software — Publish an Update (interactive).
 * Double-click "Publish Update.bat", or run:  node tools/publish-tool.mjs
 *
 * A friendly wrapper around scripts/publish-update.mjs: it bumps the version, takes
 * one line of release notes, and runs the build + upload with the right flags. The
 * heavy lifting (build, key guard, upload, release manifest) stays in the script.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const PKG = 'package.json'

const readVersion = () => JSON.parse(readFileSync(PKG, 'utf8')).version

function writeVersion(v) {
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'))
  pkg.version = v
  writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n')
}

const isSemver = (v) => /^\d+\.\d+\.\d+$/.test(v)

// Compares two x.y.z strings; true when a is strictly higher than b.
function isHigher(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0)
  }
  return false
}

function bumpPatch(v) {
  const p = v.split('.').map(Number)
  p[2] = (p[2] || 0) + 1
  return p.join('.')
}

// The production build embeds this (public) key; without it the build uses the dev key.
const hasProdKey = () => {
  const env = process.env.LICENSE_PUBLIC_KEY
  return (env && env.includes('BEGIN PUBLIC KEY')) || existsSync('license-public.pem')
}

async function main() {
  const rl = readline.createInterface({ input, output })
  try {
    console.log('==========================================')
    console.log('   POS Software — Publish an Update')
    console.log('==========================================\n')

    const current = readVersion()
    console.log(`Current version: ${current}`)

    const suggested = bumpPatch(current)
    const next = ((await rl.question(`New version [${suggested}]: `)).trim() || suggested)
    if (!isSemver(next)) return console.log('\nVersion must look like 1.2.3 — cancelled.')
    if (!isHigher(next, current)) return console.log(`\nNew version must be higher than ${current} — cancelled.`)

    const notes = (await rl.question('Release notes (one line, shown on the download page): ')).trim()

    // Production vs test build. A test build is fine to see the pipeline work, but real
    // customers can't activate it (it carries the dev signing key).
    let allowDev = false
    if (!hasProdKey()) {
      console.log('\n⚠ No production license key found (LICENSE_PUBLIC_KEY or license-public.pem).')
      console.log('  A build without it uses the DEV key — good for testing, but customers')
      console.log('  will NOT be able to activate it.')
      const yn = (await rl.question('  Build a TEST version anyway? (y/N): ')).trim().toLowerCase()
      if (yn !== 'y') return console.log('\nCancelled. Add the production key next to this app, then run again.')
      allowDev = true
    }

    console.log('\n  [1] Publish  — build and upload to the server (customers get it)')
    console.log('  [2] Dry run  — build only, show what would upload (no server needed)')
    const dryRun = (await rl.question('\nChoose (1/2): ')).trim() === '2'

    console.log('\n------------------------------------------')
    console.log(`  Version : ${next}${allowDev ? '   (TEST build — dev key)' : ''}`)
    console.log(`  Notes   : ${notes || '(none)'}`)
    console.log(`  Action  : ${dryRun ? 'Dry run (nothing uploaded)' : 'Publish to the server'}`)
    console.log('------------------------------------------')
    if ((await rl.question('Proceed? (Y/n): ')).trim().toLowerCase() === 'n') return console.log('\nCancelled.')

    // Bump the version so the build and the download-page entry carry it. For a dry run
    // we restore package.json afterwards so a "just testing" run leaves nothing changed.
    const original = readFileSync(PKG, 'utf8')
    writeVersion(next)
    console.log(`\nSet version to ${next}. Building…\n`)

    const args = ['scripts/publish-update.mjs']
    if (notes) args.push('--notes', notes)
    if (allowDev) args.push('--allow-dev-key')
    if (dryRun) args.push('--dry-run')

    const res = spawnSync(process.execPath, args, { stdio: 'inherit' })

    if (dryRun) {
      writeFileSync(PKG, original)
      console.log('\n(Dry run — version left unchanged.)')
    } else if (res.status === 0) {
      console.log('\n✓ Done. Remember to commit the version bump in package.json.')
    } else {
      console.log('\n✖ Publish did not complete — see the messages above. Nothing was released.')
    }
  } catch (e) {
    console.log('\nError: ' + e.message)
  } finally {
    await rl.question('\nPress Enter to close…').catch(() => {})
    rl.close()
  }
}

main()
