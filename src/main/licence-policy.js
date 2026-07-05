// App-side licence policy, applied AFTER the shared crypto verify (verifyLicense) has
// confirmed the signature and decoded the payload. These are the checks that are the
// app's responsibility, not the format's: the licence must be bound to THIS machine, and
// it must not be past its expiry when measured against the monotonic high-water clock
// (`nowMs`) so winding the system clock back can't revive it.
//
// Pure and electron-free by design, so it's unit-testable without keys or a real machine.
export function applyLicencePolicy(payload, machineId, nowMs) {
  if (payload.machineId !== machineId) {
    return { valid: false, reason: 'This license belongs to a different machine' }
  }
  if (payload.exp && nowMs > payload.exp) {
    return { valid: false, reason: 'This license has expired' }
  }
  return { valid: true, payload }
}
