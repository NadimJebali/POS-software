// Integration tests for the IPC layer: the real handlers from ipc.js running
// against a real (in-memory, temp-dir-backed) sql.js database, with Electron
// itself mocked. Tests in this file share one database and run in order.
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('electron', async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const handlers = new Map()
  const userData = mkdtempSync(join(tmpdir(), 'pos-vitest-'))
  const mocked = {
    app: { getPath: () => userData, relaunch: () => {}, exit: () => {} },
    ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
    BrowserWindow: { getAllWindows: () => [] },
    dialog: {
      showSaveDialog: async () => ({ canceled: true }),
      showOpenDialog: async () => ({ canceled: true })
    },
    Menu: { setApplicationMenu: () => {} },
    __handlers: handlers
  }
  return { ...mocked, default: mocked }
})

import { initDatabase } from '../src/main/db'
import { registerIpc } from '../src/main/ipc'
import { buildSeries, weekNumber } from '../src/main/analytics'

let db
let invoke

beforeAll(async () => {
  db = await initDatabase()
  registerIpc(db)
  const { __handlers } = await import('electron')
  invoke = (channel, payload) => __handlers.get(channel)(null, payload)
}, 30000)

afterAll(() => {
  if (db) db.close()
})

describe('auth & session enforcement', () => {
  test('fresh database needs first-run setup', async () => {
    await expect(invoke('auth:needsSetup')).resolves.toBe(true)
  })

  test('non-public channels are blocked before sign-in', async () => {
    await expect(invoke('products:list')).rejects.toThrow('Please sign in first')
  })

  test('setup creates the first admin and signs them in; second setup is refused', async () => {
    const user = await invoke('auth:setup', { username: 'boss', name: 'Boss', pin: '1234' })
    expect(user.role).toBe('admin')
    expect(user.pin_hash).toBeUndefined() // never leaks hashes to the renderer
    await expect(invoke('auth:setup', { username: 'x', pin: '9999' })).rejects.toThrow('already been completed')
  })

  test('wrong PIN is rejected', async () => {
    await expect(invoke('auth:login', { username: 'boss', pin: '0000' })).rejects.toThrow('Invalid username or PIN')
  })

  test('five failed attempts lock the account name', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(invoke('auth:login', { username: 'ghost', pin: '0000' })).rejects.toThrow('Invalid username or PIN')
    }
    await expect(invoke('auth:login', { username: 'ghost', pin: '0000' })).rejects.toThrow('Too many attempts')
  })

  test('correct PIN signs in (and clears the fail counter)', async () => {
    const user = await invoke('auth:login', { username: 'boss', pin: '1234' })
    expect(user.username).toBe('boss')
  })

  test('admin-only channels reject a non-admin session', async () => {
    await invoke('users:create', { username: 'staff', name: 'Staff', pin: '5678', role: 'user' })
    await invoke('auth:login', { username: 'staff', pin: '5678' })
    await expect(invoke('users:list')).rejects.toThrow('Administrator access required')
    await invoke('auth:login', { username: 'boss', pin: '1234' }) // back to admin
  })
})

describe('input validation', () => {
  test('blank names are rejected with a friendly message', async () => {
    await expect(invoke('categories:create', { name: '   ' })).rejects.toThrow('Category name is required')
    await expect(invoke('products:create', { name: '', price: 1000 })).rejects.toThrow('Product name is required')
    await expect(invoke('modoptions:create', { group_id: 1, name: '' })).rejects.toThrow('Option name is required')
  })

  test('short PINs and non-numeric money are rejected', async () => {
    await expect(invoke('users:create', { username: 'shorty', pin: '12' })).rejects.toThrow('at least 4 digits')
    await expect(invoke('products:create', { name: 'X', price: 'abc' })).rejects.toThrow('Price must be a number')
  })
})

describe('order lifecycle, stock reservation & payments', () => {
  let category, product, table, order

  const stockOf = async (id) => {
    const rows = await invoke('products:stock')
    return rows.find((r) => r.id === id).stock
  }

  beforeAll(async () => {
    category = await invoke('categories:create', { name: 'Test Cat' })
    product = await invoke('products:create', { category_id: category.id, name: 'Widget', price: 2000, stock: 5 })
    table = await invoke('tables:create', { label: '99', seats: 2 })
    order = await invoke('orders:openForTable', { tableId: table.id })
  })

  test('opening a table creates an open order and occupies the table', async () => {
    expect(order.status).toBe('open')
    const tables = await invoke('tables:list')
    expect(tables.find((t) => t.id === table.id).status).toBe('occupied')
  })

  test('adding an item reserves a unit of stock immediately', async () => {
    order = await invoke('orders:addItem', { orderId: order.id, productId: product.id })
    expect(order.total).toBe(2000)
    expect(await stockOf(product.id)).toBe(4)
  })

  test('quantity changes adjust the reservation and respect remaining stock', async () => {
    const item = order.items[0]
    order = await invoke('orders:setItemQty', { itemId: item.id, qty: 5 })
    expect(await stockOf(product.id)).toBe(0)
    await expect(invoke('orders:setItemQty', { itemId: item.id, qty: 6 })).rejects.toThrow('Not enough stock for Widget')
    expect(await stockOf(product.id)).toBe(0) // failed raise must not touch stock
  })

  test('a non-numeric quantity is rejected at the boundary', async () => {
    await expect(invoke('orders:setItemQty', { itemId: order.items[0].id, qty: 'NaN-ish' })).rejects.toThrow('Quantity must be a number')
  })

  test('percent discount recomputes the total', async () => {
    order = await invoke('orders:setDiscount', { orderId: order.id, type: 'percent', value: 10 })
    expect(order.subtotal).toBe(10000)
    expect(order.discount).toBe(1000)
    expect(order.total).toBe(9000)
  })

  test('card overpayment completes with zero change (change comes only from cash)', async () => {
    order = await invoke('orders:addPayment', { orderId: order.id, method: 'card', amount: 20000 })
    expect(order.paid).toBe(20000)
    order = await invoke('orders:complete', { orderId: order.id })
    expect(order.status).toBe('paid')
    expect(order.cash_received).toBe(0)
    expect(order.change_due).toBe(0)
  })

  test('settled orders refuse new or removed payments and double completion', async () => {
    await expect(invoke('orders:addPayment', { orderId: order.id, method: 'cash', amount: 1000 })).rejects.toThrow('already been settled')
    await expect(invoke('orders:removePayment', { paymentId: order.payments[0].id })).rejects.toThrow('already been settled')
    await expect(invoke('orders:complete', { orderId: order.id })).rejects.toThrow('already been settled')
  })

  test('deleting a paid order restores its stock and keeps it in history as cancelled', async () => {
    await invoke('orders:cancelPaid', { orderId: order.id })
    expect(await stockOf(product.id)).toBe(5)
    const history = await invoke('orders:history', {})
    const row = history.find((h) => h.id === order.id)
    expect(row.status).toBe('cancelled')
    expect(row.deleted_by).toBe('Boss')
  })

  test('cash overpayment returns change capped at the cash tendered', async () => {
    order = await invoke('orders:openForTable', { tableId: table.id })
    order = await invoke('orders:addItem', { orderId: order.id, productId: product.id })
    order = await invoke('orders:addPayment', { orderId: order.id, method: 'cash', amount: 5000 })
    order = await invoke('orders:complete', { orderId: order.id })
    expect(order.total).toBe(2000)
    expect(order.cash_received).toBe(5000)
    expect(order.change_due).toBe(3000)
  })

  test('editing a paid order validates stock and refreshes totals and change', async () => {
    const item = order.items[0]
    await expect(
      invoke('orders:updatePaid', { orderId: order.id, items: [{ id: item.id, qty: 100 }] })
    ).rejects.toThrow('Not enough stock for Widget')
    order = await invoke('orders:updatePaid', { orderId: order.id, items: [{ id: item.id, qty: 2 }] })
    expect(order.total).toBe(4000)
    expect(order.change_due).toBe(1000) // 5000 paid - 4000 new total
    expect(await stockOf(product.id)).toBe(3)
  })

  test('voiding an open order returns reserved stock and frees the table', async () => {
    let o = await invoke('orders:openForTable', { tableId: table.id })
    o = await invoke('orders:addItem', { orderId: o.id, productId: product.id })
    expect(await stockOf(product.id)).toBe(2)
    await invoke('orders:void', { orderId: o.id })
    expect(await stockOf(product.id)).toBe(3)
    const tables = await invoke('tables:list')
    expect(tables.find((t) => t.id === table.id).status).toBe('open')
  })

  test('removing a table discards its open order and returns the stock', async () => {
    let o = await invoke('orders:openForTable', { tableId: table.id })
    await invoke('orders:addItem', { orderId: o.id, productId: product.id })
    expect(await stockOf(product.id)).toBe(2)
    await invoke('tables:remove', { id: table.id })
    expect(await stockOf(product.id)).toBe(3)
    await expect(invoke('orders:get', { orderId: o.id })).resolves.toBeNull()
  })
})

describe('analytics time bucketing', () => {
  test('weekNumber matches SQLite strftime(%W) across several years', () => {
    const sql = db.prepare("SELECT CAST(strftime('%W', ?) AS INTEGER) AS w")
    for (let t = Date.UTC(2023, 0, 1); t <= Date.UTC(2027, 11, 31); t += 13 * 86400000) {
      const d = new Date(t)
      const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      const iso = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`
      expect(weekNumber(local), `week of ${iso}`).toBe(sql.get(iso).w)
    }
  })

  test('daily series buckets by local date — including just after midnight', () => {
    // 00:30 local on June 10: with the old UTC-based keys this whole chart shifted a day.
    const now = new Date(2026, 5, 10, 0, 30)
    const rows = [
      { d: '2026-06-10', total: 5000 },
      { d: '2026-06-09', total: 1000 },
      { d: '2026-06-09', total: 500 }
    ]
    const series = buildSeries(rows, 'daily', now)
    expect(series).toHaveLength(14)
    expect(series[13].total).toBe(5000) // today
    expect(series[12].total).toBe(1500) // yesterday, summed
  })

  test('weekly series keys line up with SQLite %Y-%W keys', () => {
    const now = new Date(2026, 5, 10, 12, 0)
    const key = db.prepare("SELECT strftime('%Y-%W', '2026-06-10') AS k").get().k
    const series = buildSeries([{ w: key, total: 7000 }], 'weekly', now)
    expect(series[series.length - 1].total).toBe(7000)
  })

  test('yearly series sums by year', () => {
    const now = new Date(2026, 5, 10)
    const series = buildSeries(
      [
        { y: '2026', total: 100 },
        { y: '2026', total: 200 },
        { y: '2024', total: 50 }
      ],
      'yearly',
      now
    )
    expect(series[series.length - 1]).toEqual({ label: '2026', total: 300 })
    expect(series[series.length - 3]).toEqual({ label: '2024', total: 50 })
  })
})
