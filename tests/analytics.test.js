// Tests for the Analytics module: the pure period->SQL mapping + bucketing, and
// the query methods exercised against a real in-memory db (no Electron, no IPC).
import { describe, test, expect, beforeAll } from 'vitest'
import initSqlJs from 'sql.js'
import { readFileSync } from 'node:fs'
import { resolveWasm, buildDatabase } from '../src/main/db'
import { createAnalytics, periodWhere, buildSeries } from '../src/main/analytics'
import { createOrders } from '../src/main/orders'

let db
let analytics
let orders

beforeAll(async () => {
  const SQL = await initSqlJs({ wasmBinary: readFileSync(resolveWasm()) })
  db = buildDatabase(new SQL.Database(), () => {})
  analytics = createAnalytics(db)
  orders = createOrders(db)
})

// Sell one unit of the first product on the first table, completing the sale today.
function sellOne() {
  const table = db.prepare('SELECT * FROM tables ORDER BY id LIMIT 1').get()
  const product = db.prepare('SELECT * FROM products ORDER BY id LIMIT 1').get()
  db.prepare('UPDATE products SET stock = 50 WHERE id = ?').run(product.id)
  const o = orders.openForTable({ tableId: table.id, user: { id: 1, name: 'Boss' } })
  orders.addItem({ orderId: o.id, productId: product.id })
  const total = orders.get(o.id).total
  orders.addPayment({ orderId: o.id, method: 'cash', amount: total })
  orders.complete({ orderId: o.id })
  return { total, productName: product.name }
}

describe('periodWhere — one mapping, alias-parameterised', () => {
  test('defaults to the o.paid_at alias used by joined queries', () => {
    expect(periodWhere('today')).toContain("date(o.paid_at,'localtime')")
    expect(periodWhere('week')).toContain('%Y-%W')
  })

  test('accepts an unaliased column for the plain orders table', () => {
    const sql = periodWhere('today', 'paid_at')
    expect(sql).toContain("date(paid_at,'localtime')")
    expect(sql).not.toContain('o.paid_at')
  })

  test('an unknown period matches everything', () => {
    expect(periodWhere('whenever')).toBe('1=1')
  })
})

describe('analytics queries reflect completed sales', () => {
  test('overview today counts a completed sale', () => {
    const { total } = sellOne()
    const ov = analytics.overview('1=1')
    expect(ov.today.count).toBeGreaterThanOrEqual(1)
    expect(ov.today.total).toBeGreaterThanOrEqual(total)
  })

  test('top products lists the sold product for the period', () => {
    const { productName } = sellOne()
    const top = analytics.topProducts('today', '1=1')
    const row = top.find((r) => r.name === productName)
    expect(row).toBeTruthy()
    expect(row.qty).toBeGreaterThanOrEqual(1)
  })

  test('daily series puts today total in the last bucket, using the injected clock', () => {
    const series = analytics.series('daily', '1=1', new Date())
    expect(series).toHaveLength(14)
    expect(series[13].total).toBeGreaterThan(0)
  })
})

describe('buildSeries is clock-injectable', () => {
  test('buckets a same-day row just after midnight', () => {
    const now = new Date(2026, 5, 10, 0, 30)
    const series = buildSeries([{ d: '2026-06-10', total: 5000 }], 'daily', now)
    expect(series[13].total).toBe(5000)
  })
})
