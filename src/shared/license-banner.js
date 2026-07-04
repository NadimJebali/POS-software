// Pure translation of a license `status` into which (if any) renewal banner to show.
// Shared by the renderer (Layout) and unit-tested in isolation. All thresholds come
// from the signed payload the status carries (exp, warnDays, graceUntil) — nothing
// about 30/7 days is hardcoded here.
//
// Returns one of:
//   { kind: 'grace',   until }  — subscription lapsed into paid-grace; "please renew"
//   { kind: 'warning', until }  — exp is near (renewals aren't getting through); works until {until}
//   { kind: 'none' }
const DAY = 86400000

export function deriveBanner(status, now) {
  if (!status || status.state !== 'licensed') return { kind: 'none' }

  if (status.graceUntil != null) return { kind: 'grace', until: status.graceUntil }

  if (status.exp != null && status.warnDays != null && status.exp - now <= status.warnDays * DAY) {
    return { kind: 'warning', until: status.exp }
  }

  return { kind: 'none' }
}
