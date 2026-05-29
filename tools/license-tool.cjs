#!/usr/bin/env node
/*
 * POS Software — License Generator (interactive).
 * Double-click the .bat/.exe, or run: node tools/license-tool.cjs
 *
 * Needs license-private.pem next to this tool (or in the project root).
 * That file is your SECRET signing key — keep it safe, never share it.
 */
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline/promises')
const { spawn } = require('node:child_process')

// Locate license-private.pem in likely places (next to the exe, cwd, project root).
function findKeyDir() {
  const candidates = [
    path.dirname(process.execPath),
    process.cwd(),
    __dirname,
    path.join(__dirname, '..')
  ]
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'license-private.pem'))) return dir
  }
  return null
}

function copyToClipboard(text) {
  return new Promise((resolve) => {
    try {
      const p = spawn(process.platform === 'win32' ? 'clip' : 'pbcopy')
      p.on('error', () => resolve(false))
      p.on('close', () => resolve(true))
      p.stdin.write(text)
      p.stdin.end()
    } catch {
      resolve(false)
    }
  })
}

function sign(privateKey, payload) {
  const pB64 = Buffer.from(JSON.stringify(payload)).toString('base64')
  const sig = crypto.sign(null, Buffer.from(pB64), privateKey).toString('base64')
  return pB64 + '.' + sig
}

async function generate(rl, keyDir) {
  const privateKey = crypto.createPrivateKey(fs.readFileSync(path.join(keyDir, 'license-private.pem')))

  const machineId = (await rl.question('\nMachine ID (from the customer\'s app): ')).trim().toUpperCase()
  if (!machineId) return console.log('No Machine ID — cancelled.')
  const name = (await rl.question('Customer name (optional): ')).trim()
  const daysStr = (await rl.question('Valid for how many days? (blank = never expires): ')).trim()
  const days = parseInt(daysStr || '0', 10)

  const payload = {
    v: 1,
    machineId,
    name,
    iat: Date.now(),
    exp: days > 0 ? Date.now() + days * 86400000 : null
  }
  const license = sign(privateKey, payload)

  console.log('\n──────────────── LICENSE ────────────────')
  console.log(`Machine : ${machineId}`)
  console.log(`Customer: ${name || '(none)'}`)
  console.log(`Expires : ${payload.exp ? new Date(payload.exp).toDateString() : 'never'}`)
  console.log('──────────────────────────────────────────\n')
  console.log(license + '\n')

  if ((await rl.question('Copy to clipboard? (Y/n): ')).trim().toLowerCase() !== 'n') {
    const ok = await copyToClipboard(license)
    console.log(ok ? '✓ Copied to clipboard.' : '(could not access clipboard)')
  }
  const savePath = (await rl.question('Save to a file? (path, or blank to skip): ')).trim()
  if (savePath) {
    try {
      fs.writeFileSync(savePath, license)
      console.log('✓ Saved to ' + savePath)
    } catch (e) {
      console.log('Could not save: ' + e.message)
    }
  }
}

async function createKeys(rl, keyDir) {
  const dir = keyDir || process.cwd()
  const priv = path.join(dir, 'license-private.pem')
  if (fs.existsSync(priv)) {
    const sure = (await rl.question('\n⚠ Keys already exist. Overwriting INVALIDATES every license you\'ve issued. Type YES to continue: ')).trim()
    if (sure !== 'YES') return console.log('Cancelled.')
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  fs.writeFileSync(priv, privateKey.export({ type: 'pkcs8', format: 'pem' }))
  const pub = publicKey.export({ type: 'spki', format: 'pem' })
  fs.writeFileSync(path.join(dir, 'license-public.pem'), pub)
  console.log('\n✓ Wrote license-private.pem (SECRET) and license-public.pem to:\n  ' + dir)
  console.log('\nEmbed this public key in src/main/license.js (PUBLIC_KEY):\n')
  console.log(pub)
}

// Non-interactive mode for scripting/testing: --machine <id> [--name "x"] [--days N]
function runArgs(args) {
  const get = (n) => {
    const i = args.indexOf('--' + n)
    return i !== -1 ? args[i + 1] : null
  }
  const keyDir = findKeyDir()
  if (!keyDir) {
    console.error('license-private.pem not found')
    process.exit(1)
  }
  const privateKey = crypto.createPrivateKey(fs.readFileSync(path.join(keyDir, 'license-private.pem')))
  const days = parseInt(get('days') || '0', 10)
  const payload = {
    v: 1,
    machineId: String(get('machine')).trim().toUpperCase(),
    name: get('name') || '',
    iat: Date.now(),
    exp: days > 0 ? Date.now() + days * 86400000 : null
  }
  console.log(sign(privateKey, payload))
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--machine')) return runArgs(argv)

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    console.log('==============================================')
    console.log('   POS Software — License Generator')
    console.log('==============================================')

    const keyDir = findKeyDir()
    if (!keyDir) {
      console.log('\n⚠ Could not find license-private.pem next to this tool.')
      console.log('  Put your license-private.pem in this folder, then run again,')
      console.log('  or choose option 2 to create a new key pair.\n')
    }

    console.log('  [1] Generate a license')
    console.log('  [2] Create new signing keys (advanced)')
    const choice = (await rl.question('\nChoose (1/2): ')).trim()

    if (choice === '2') {
      await createKeys(rl, keyDir)
    } else if (keyDir) {
      await generate(rl, keyDir)
    } else {
      console.log('No signing key available — nothing to do.')
    }
  } catch (e) {
    console.log('\nError: ' + e.message)
  } finally {
    await rl.question('\nPress Enter to close…').catch(() => {})
    rl.close()
  }
}

main()
