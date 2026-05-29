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

export function getStatus() {
  const machineId = getMachineId()
  const { lic, meta } = paths()

  if (existsSync(lic)) {
    const res = verify(readFileSync(lic, 'utf8'), machineId)
    if (res.valid) {
      return { state: 'licensed', machineId, name: res.payload.name || null, exp: res.payload.exp || null }
    }
    // stored license no longer valid (expired / wrong machine) → treat as needing activation
    return { state: 'expired', machineId, reason: res.reason }
  }

  // trial window, tracked from first run
  let firstRun
  try {
    firstRun = JSON.parse(readFileSync(meta, 'utf8')).firstRun
  } catch {
    firstRun = Date.now()
    try {
      writeFileSync(meta, JSON.stringify({ firstRun }))
    } catch {
      // ignore
    }
  }
  const daysLeft = Math.ceil((firstRun + TRIAL_DAYS * 86400000 - Date.now()) / 86400000)
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
