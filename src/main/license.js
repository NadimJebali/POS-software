import crypto from 'crypto'
import os from 'os'
import { execSync } from 'child_process'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

// Public half of the offline signing key. The private key (license-private.pem)
// stays with the vendor and is used by scripts/license-gen.mjs to issue licenses.
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAMyaX0qTD4ii0CHKaWj55jR2lPQFChsPPscvOvk18lY8=
-----END PUBLIC KEY-----`

const TRIAL_DAYS = 14

// Secret used to HMAC the trial meta so it can't be hand-edited. This lives in the
// app bundle (asar), so it's obfuscation, not true secrecy — but combined with the
// machine-bound signature and the clock high-water mark it stops casual tampering.
const META_SECRET = 'pos-trial-v1::a7f3c9e1d2b48650f1ac9e7740b3266d'

// Where the trial meta is mirrored in the Windows registry (HKCU = no admin needed).
const REG_KEY = 'HKCU\\Software\\PosSoftware\\Trial'

// ---- machine fingerprint (stable per Windows install) ----
function rawMachineId() {
  try {
    if (process.platform === 'win32') {
      const out = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { encoding: 'utf8' })
      const m = out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i)
      if (m) return 'win:' + m[1]
    } else if (process.platform === 'darwin') {
      const out = execSync('ioreg -rd1 -c IOPlatformExpertDevice', { encoding: 'utf8' })
      const m = out.match(/IOPlatformUUID"\s*=\s*"([^"]+)"/)
      if (m) return 'mac:' + m[1]
    } else if (existsSync('/etc/machine-id')) {
      return 'linux:' + readFileSync('/etc/machine-id', 'utf8').trim()
    }
  } catch {
    // fall through to a best-effort fingerprint
  }
  const nets = os.networkInterfaces()
  let mac = ''
  for (const k of Object.keys(nets)) {
    for (const n of nets[k] || []) {
      if (!n.internal && n.mac && n.mac !== '00:00:00:00:00:00') {
        mac = n.mac
        break
      }
    }
    if (mac) break
  }
  return `${os.hostname()}|${mac}|${os.cpus()[0]?.model || ''}`
}

export function getMachineId() {
  const hash = crypto.createHash('sha256').update(rawMachineId()).digest('hex').slice(0, 24).toUpperCase()
  return hash.match(/.{1,4}/g).join('-') // e.g. ABCD-1234-EF56-...
}

// ---- storage ----
function paths() {
  const dir = app.getPath('userData')
  return { lic: join(dir, 'license.key'), meta: join(dir, 'license-meta.json') }
}

// ---- license verification ----
function verify(licenseString, machineId) {
  try {
    const [pB64, sB64] = String(licenseString).trim().split('.')
    if (!pB64 || !sB64) return { valid: false, reason: 'License is malformed' }
    if (!crypto.verify(null, Buffer.from(pB64), PUBLIC_KEY, Buffer.from(sB64, 'base64'))) {
      return { valid: false, reason: 'License signature is invalid' }
    }
    const payload = JSON.parse(Buffer.from(pB64, 'base64').toString('utf8'))
    if (payload.machineId !== machineId) return { valid: false, reason: 'This license belongs to a different machine' }
    if (payload.exp && Date.now() > payload.exp) return { valid: false, reason: 'This license has expired' }
    return { valid: true, payload }
  } catch {
    return { valid: false, reason: 'License could not be read' }
  }
}

// ---- tamper-proof trial meta (HMAC bound to this machine) ----
function metaSig(dataString, machineId) {
  return crypto.createHmac('sha256', META_SECRET).update(dataString + '|' + machineId).digest('base64')
}

// Returns { existed, data? }. `existed` is true when a store was present at all —
// even if its signature is bad — so we can tell "first run" apart from "tampered".
function parseStore(signedJson, machineId) {
  try {
    const { d, sig } = JSON.parse(signedJson)
    if (d && sig === metaSig(d, machineId)) return { existed: true, data: JSON.parse(d) }
  } catch {
    // fall through
  }
  return { existed: true }
}

function readFileStore(machineId) {
  const { meta } = paths()
  if (!existsSync(meta)) return { existed: false }
  try {
    const raw = readFileSync(meta, 'utf8')
    const parsed = parseStore(raw, machineId)
    if (parsed.data) return parsed
    // Migrate the pre-signature format: { "firstRun": <ms> } written by older builds.
    const legacy = JSON.parse(raw)
    if (legacy && typeof legacy.firstRun === 'number') {
      return { existed: true, data: { firstRun: legacy.firstRun, lastSeen: legacy.firstRun } }
    }
    return parsed
  } catch {
    return { existed: true }
  }
}

function readRegStore(machineId) {
  if (process.platform !== 'win32') return { existed: false }
  try {
    const out = execSync(`reg query "${REG_KEY}" /v meta`, { encoding: 'utf8' })
    const m = out.match(/meta\s+REG_SZ\s+([A-Za-z0-9+/=]+)/i)
    if (!m) return { existed: true }
    return parseStore(Buffer.from(m[1].trim(), 'base64').toString('utf8'), machineId)
  } catch {
    // Non-zero exit means the key/value is absent → genuinely no record.
    return { existed: false }
  }
}

function writeStores(data, machineId) {
  const d = JSON.stringify(data)
  const signed = JSON.stringify({ d, sig: metaSig(d, machineId) })
  try {
    writeFileSync(paths().meta, signed)
  } catch {
    // ignore — registry mirror may still persist it
  }
  if (process.platform === 'win32') {
    try {
      const b64 = Buffer.from(signed, 'utf8').toString('base64')
      execSync(`reg add "${REG_KEY}" /v meta /t REG_SZ /d ${b64} /f`, { stdio: 'ignore' })
    } catch {
      // ignore — file copy may still persist it
    }
  }
}

export function getStatus() {
  const machineId = getMachineId()
  const { lic } = paths()

  if (existsSync(lic)) {
    const res = verify(readFileSync(lic, 'utf8'), machineId)
    if (res.valid) {
      return { state: 'licensed', machineId, name: res.payload.name || null, exp: res.payload.exp || null }
    }
    // stored license no longer valid (expired / wrong machine) → treat as needing activation
    return { state: 'expired', machineId, reason: res.reason }
  }

  // ---- trial window ----
  const now = Date.now()
  const file = readFileStore(machineId)
  const reg = readRegStore(machineId)
  const stores = [file.data, reg.data].filter(Boolean)

  let data
  if (stores.length) {
    // Pessimistic union: keep the earliest start and the latest time ever seen,
    // and never let "now" run backward (defeats clock-rollback for free days).
    const firstRun = Math.min(...stores.map((s) => s.firstRun))
    const lastSeen = Math.max(now, ...stores.map((s) => s.lastSeen || s.firstRun))
    data = { firstRun, lastSeen }
  } else if (file.existed || reg.existed) {
    // A store was present but failed its signature (hand-edited / corrupted), and
    // no valid copy survives anywhere → fail closed rather than granting a fresh trial.
    return { state: 'unlicensed', machineId, reason: 'Trial data was modified' }
  } else {
    // Genuine first run on this machine.
    data = { firstRun: now, lastSeen: now }
  }

  writeStores(data, machineId)

  // Count down against the monotonic clock, so rolling the system time back only
  // ever freezes the trial — it can never extend it.
  const effectiveNow = Math.max(now, data.lastSeen)
  const daysLeft = Math.ceil((data.firstRun + TRIAL_DAYS * 86400000 - effectiveNow) / 86400000)
  if (daysLeft > 0) return { state: 'trial', machineId, daysLeft }
  return { state: 'unlicensed', machineId }
}

export function activate(licenseString) {
  const machineId = getMachineId()
  const res = verify(licenseString, machineId)
  if (!res.valid) throw new Error(res.reason)
  writeFileSync(paths().lic, String(licenseString).trim())
  return { state: 'licensed', machineId, name: res.payload.name || null, exp: res.payload.exp || null }
}
