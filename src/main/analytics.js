// Analytics queries and time-bucketing for the main process. One period->SQL
// mapping (alias-parameterised), the live-chart bucketing (clock injected), and
// the data builder behind the PDF export. Session scope is passed in by the caller
// (a SQL fragment), so this module never reads the signed-in user.

// One period -> WHERE-clause mapping. `col` is the timestamp column expression:
// 'o.paid_at' for joined queries, 'paid_at' for the plain orders table.
export function periodWhere(period, col = 'o.paid_at') {
  switch (period) {
    case 'today':
      return `date(${col},'localtime') = date('now','localtime')`
    case 'week':
      return `strftime('%Y-%W', ${col},'localtime') = strftime('%Y-%W','now','localtime')`
    case 'month':
      return `strftime('%Y-%m', ${col},'localtime') = strftime('%Y-%m','now','localtime')`
    case 'year':
      return `strftime('%Y', ${col},'localtime') = strftime('%Y','now','localtime')`
    default:
      return '1=1'
  }
}

// Week-of-year matching SQLite's strftime('%W'): Monday-based, 00–53, where days
// before the year's first Monday fall in week 00. Buckets built here must line up
// with the '%Y-%W' keys coming out of SQL, or the weekly chart reads zero.
export function weekNumber(date) {
  const jan1 = new Date(date.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((date - jan1) / 86400000) // 0-based
  const mondayDow = (date.getDay() + 6) % 7 // Monday = 0
  return Math.floor((dayOfYear + 7 - mondayDow) / 7)
}

// Turn paid-order rows into fixed-length chart buckets ending "now". `now` is
// injected so the production path and tests bucket against the same clock.
export function buildSeries(rows, period, now = new Date()) {
  const buckets = []
  // Local-date key, matching the SQL side's date(paid_at,'localtime'). Using
  // toISOString here would shift the date for any local time before UTC+offset.
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  if (period === 'daily') {
    const map = {}
    rows.forEach((r) => (map[r.d] = (map[r.d] || 0) + r.total))
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      buckets.push({ label: d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }), total: map[fmt(d)] || 0 })
    }
  } else if (period === 'weekly') {
    const map = {}
    rows.forEach((r) => (map[r.w] = (map[r.w] || 0) + r.total))
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i * 7)
      const week = String(weekNumber(d)).padStart(2, '0')
      buckets.push({ label: `W${week}`, total: map[`${d.getFullYear()}-${week}`] || 0 })
    }
  } else if (period === 'monthly') {
    const map = {}
    rows.forEach((r) => (map[r.m] = (map[r.m] || 0) + r.total))
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      buckets.push({ label: d.toLocaleDateString(undefined, { month: 'short' }), total: map[key] || 0 })
    }
  } else if (period === 'yearly') {
    const map = {}
    rows.forEach((r) => (map[r.y] = (map[r.y] || 0) + r.total))
    for (let i = 4; i >= 0; i--) {
      const year = String(now.getFullYear() - i)
      buckets.push({ label: year, total: map[year] || 0 })
    }
  }
  return buckets
}

/**
 * Analytics queries over `db`. Every method takes a `scope` SQL fragment
 * (e.g. '1=1' for everyone, or 'o.user_id = 5') so the session stays in the caller.
 */
export function createAnalytics(db) {
  // today/week/month/year revenue+count over the plain orders table.
  const overview = (scope) => {
    const q = (period) =>
      db
        .prepare(
          `SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count FROM orders
           WHERE status = 'paid' AND ${scope} AND ${periodWhere(period, 'paid_at')}`
        )
        .get()
    return { today: q('today'), week: q('week'), month: q('month'), year: q('year') }
  }

  // Fixed-length chart series for the period; `now` drives the bucket window.
  const series = (period, scope, now = new Date()) => {
    const rows = db
      .prepare(
        `SELECT date(paid_at,'localtime') AS d, strftime('%Y-%W', paid_at,'localtime') AS w,
                strftime('%Y-%m', paid_at,'localtime') AS m, strftime('%Y', paid_at,'localtime') AS y, total
         FROM orders WHERE status = 'paid' AND ${scope}`
      )
      .all()
    return buildSeries(rows, period, now)
  }

  const topProducts = (period, scope) =>
    db
      .prepare(
        `SELECT oi.name AS name, SUM(oi.qty) AS qty, SUM(oi.qty * oi.unit_price) AS revenue
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'paid' AND ${scope} AND ${periodWhere(period)}
         GROUP BY oi.name ORDER BY revenue DESC LIMIT 10`
      )
      .all()

  const byServer = (period, scope) =>
    db
      .prepare(
        `SELECT COALESCE(o.user_name, 'Unknown') AS name, COUNT(*) AS orders, COALESCE(SUM(o.total),0) AS revenue
         FROM orders o WHERE o.status = 'paid' AND ${scope} AND ${periodWhere(period)}
         GROUP BY COALESCE(o.user_name, 'Unknown') ORDER BY revenue DESC`
      )
      .all()

  const recentOrders = (scope) =>
    db
      .prepare(
        `SELECT id, table_label, total, cash_received, change_due, paid_at
         FROM orders WHERE status = 'paid' AND ${scope} ORDER BY paid_at DESC LIMIT 25`
      )
      .all()

  // Build the data block for a PDF export over a date range, optionally scoped to
  // one user. Returns the queried sections; the caller adds labels/shop/lang.
  const report = ({ from, to, scopedUserId }) => {
    const conds = ["o.status = 'paid'"]
    const params = []
    if (from) {
      conds.push("date(o.paid_at,'localtime') >= ?")
      params.push(from)
    }
    if (to) {
      conds.push("date(o.paid_at,'localtime') <= ?")
      params.push(to)
    }
    if (scopedUserId != null) {
      conds.push('o.user_id = ?')
      params.push(scopedUserId)
    }
    const whereO = conds.join(' AND ')

    const summary = db.prepare(`SELECT COALESCE(SUM(o.total),0) AS total, COUNT(*) AS count FROM orders o WHERE ${whereO}`).get(...params)
    summary.avg = summary.count ? Math.round(summary.total / summary.count) : 0

    // Day buckets for short ranges, month buckets for long/open-ended ones.
    const daySpan = from && to ? Math.round((new Date(to) - new Date(from)) / 86400000) : Infinity
    const byDay = !!from && daySpan <= 62
    const bucket = byDay ? "date(o.paid_at,'localtime')" : "strftime('%Y-%m', o.paid_at,'localtime')"
    const trend = db
      .prepare(`SELECT ${bucket} AS label, COUNT(*) AS count, COALESCE(SUM(o.total),0) AS total FROM orders o WHERE ${whereO} GROUP BY label ORDER BY label`)
      .all(...params)

    const top = db
      .prepare(
        `SELECT oi.name AS name, SUM(oi.qty) AS qty, SUM(oi.qty * oi.unit_price) AS revenue
         FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE ${whereO}
         GROUP BY oi.name ORDER BY revenue DESC LIMIT 10`
      )
      .all(...params)

    const serverRows = db
      .prepare(
        `SELECT COALESCE(o.user_name,'Unknown') AS name, COUNT(*) AS orders, COALESCE(SUM(o.total),0) AS revenue
         FROM orders o WHERE ${whereO} GROUP BY COALESCE(o.user_name,'Unknown') ORDER BY revenue DESC`
      )
      .all(...params)

    const methods = db
      .prepare(`SELECT p.method AS method, COALESCE(SUM(p.amount),0) AS amount FROM payments p JOIN orders o ON o.id = p.order_id WHERE ${whereO} GROUP BY p.method ORDER BY amount DESC`)
      .all(...params)
    const change = db.prepare(`SELECT COALESCE(SUM(o.change_due),0) AS c FROM orders o WHERE ${whereO}`).get(...params).c

    return { summary, trend, trendBy: byDay ? 'day' : 'month', top, byServer: serverRows, payments: { methods, change } }
  }

  return { overview, series, topProducts, byServer, recentOrders, report }
}
