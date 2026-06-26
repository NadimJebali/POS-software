// Unit tests for the Order domain module (src/main/orders.js), exercised at its
// interface against a real in-memory sql.js database — NO Electron, NO IPC mock.
// The module is constructed with `db`; session/attribution is passed in per call.
import { describe, test, expect, beforeAll } from 'vitest'
import initSqlJs from 'sql.js'
import { readFileSync } from 'node:fs'
import { resolveWasm, buildDatabase } from '../src/main/db'
import { createOrders } from '../src/main/orders'

const BOSS = { id: 1, name: 'Boss', username: 'boss' }

let db
let orders

// A real, seeded database with no disk persistence and no Electron dependency.
async function freshDb() {
  const SQL = await initSqlJs({ wasmBinary: readFileSync(resolveWasm()) })
  return buildDatabase(new SQL.Database(), () => {})
}

const firstTable = () => db.prepare('SELECT * FROM tables ORDER BY id LIMIT 1').get()
const firstProduct = () => db.prepare('SELECT * FROM products ORDER BY id LIMIT 1').get()
const tableAt = (n) => db.prepare('SELECT * FROM tables ORDER BY id LIMIT 1 OFFSET ?').get(n)
const stockOf = (id) => db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock

beforeAll(async () => {
  db = await freshDb()
  orders = createOrders(db)
})

describe('opening a table', () => {
  test('creates an open order, attributes it, and occupies the table', () => {
    const table = firstTable()
    const order = orders.openForTable({ tableId: table.id, user: BOSS })
    expect(order.status).toBe('open')
    expect(order.items).toEqual([])
    expect(order.user_name).toBe('Boss')
    expect(db.prepare('SELECT status FROM tables WHERE id = ?').get(table.id).status).toBe('occupied')
  })

  test('returns the same open order on re-open (no duplicate)', () => {
    const table = firstTable()
    const a = orders.openForTable({ tableId: table.id, user: BOSS })
    const b = orders.openForTable({ tableId: table.id, user: BOSS })
    expect(b.id).toBe(a.id)
  })
})

describe('adding items reserves stock', () => {
  test('adding a product adds a line and reserves one unit immediately', () => {
    const order = orders.openForTable({ tableId: tableAt(1).id, user: BOSS })
    const product = firstProduct()
    const before = stockOf(product.id)
    const updated = orders.addItem({ orderId: order.id, productId: product.id })
    expect(updated.items).toHaveLength(1)
    expect(updated.total).toBe(product.price)
    expect(stockOf(product.id)).toBe(before - 1)
  })

  test('adding the same product again increments qty, not a new line', () => {
    const order = orders.openForTable({ tableId: tableAt(1).id, user: BOSS })
    const product = firstProduct()
    const before = stockOf(product.id)
    const updated = orders.addItem({ orderId: order.id, productId: product.id })
    expect(updated.items).toHaveLength(1)
    expect(updated.items[0].qty).toBe(2)
    expect(updated.total).toBe(product.price * 2)
    expect(stockOf(product.id)).toBe(before - 1)
  })

  test('refuses to add a product with no stock left', () => {
    const order = orders.openForTable({ tableId: tableAt(2).id, user: BOSS })
    const product = db.prepare('SELECT * FROM products ORDER BY id LIMIT 1 OFFSET 1').get()
    db.prepare('UPDATE products SET stock = 0 WHERE id = ?').run(product.id)
    expect(() => orders.addItem({ orderId: order.id, productId: product.id })).toThrow(/stock/i)
  })
})

describe('discount clamps to 0..subtotal', () => {
  // One fresh order on table 4 with a single known line; reused across the block.
  let orderId, subtotal
  beforeAll(() => {
    const order = orders.openForTable({ tableId: tableAt(3).id, user: BOSS })
    const product = firstProduct()
    const updated = orders.addItem({ orderId: order.id, productId: product.id })
    orderId = order.id
    subtotal = updated.subtotal
  })

  test('percent discount recomputes total', () => {
    const d = orders.setDiscount({ orderId, type: 'percent', value: 10 })
    expect(d.subtotal).toBe(subtotal)
    expect(d.discount).toBe(Math.round((subtotal * 10) / 100))
    expect(d.total).toBe(subtotal - Math.round((subtotal * 10) / 100))
  })

  test('fixed-amount discount is applied as-is', () => {
    const d = orders.setDiscount({ orderId, type: 'amount', value: 300 })
    expect(d.discount).toBe(300)
    expect(d.total).toBe(subtotal - 300)
  })

  test('a discount larger than the subtotal is clamped to the subtotal', () => {
    const d = orders.setDiscount({ orderId, type: 'amount', value: 9_999_999 })
    expect(d.discount).toBe(subtotal)
    expect(d.total).toBe(0)
  })

  test('a negative discount is rejected', () => {
    expect(() => orders.setDiscount({ orderId, type: 'amount', value: -1 })).toThrow(/positive/i)
  })
})

describe('payments and completion', () => {
  test('completion refuses until payments cover the total', () => {
    const order = orders.openForTable({ tableId: tableAt(4).id, user: BOSS })
    const product = firstProduct()
    const total = orders.addItem({ orderId: order.id, productId: product.id }).total
    const part = orders.addPayment({ orderId: order.id, method: 'cash', amount: total - 1 })
    expect(part.paid).toBe(total - 1)
    expect(part.remaining).toBe(1)
    expect(() => orders.complete({ orderId: order.id })).toThrow(/cover the total/i)
  })

  test('cash overpayment returns change capped at cash tendered and frees the table', () => {
    const table = tableAt(5)
    const order = orders.openForTable({ tableId: table.id, user: BOSS })
    const product = firstProduct()
    const total = orders.addItem({ orderId: order.id, productId: product.id }).total
    orders.addPayment({ orderId: order.id, method: 'cash', amount: total + 500 })
    const done = orders.complete({ orderId: order.id })
    expect(done.status).toBe('paid')
    expect(done.cash_received).toBe(total + 500)
    expect(done.change_due).toBe(500)
    expect(db.prepare('SELECT status FROM tables WHERE id = ?').get(table.id).status).toBe('open')
  })

  test('card overpayment earns no change', () => {
    const order = orders.openForTable({ tableId: tableAt(6).id, user: BOSS })
    const product = firstProduct()
    const total = orders.addItem({ orderId: order.id, productId: product.id }).total
    orders.addPayment({ orderId: order.id, method: 'card', amount: total + 1000 })
    const done = orders.complete({ orderId: order.id })
    expect(done.cash_received).toBe(0)
    expect(done.change_due).toBe(0)
  })

  test('a settled order refuses new/removed payments and double completion', () => {
    const order = orders.openForTable({ tableId: tableAt(7).id, user: BOSS })
    const product = firstProduct()
    const total = orders.addItem({ orderId: order.id, productId: product.id }).total
    const paid = orders.addPayment({ orderId: order.id, method: 'cash', amount: total })
    orders.complete({ orderId: order.id })
    expect(() => orders.addPayment({ orderId: order.id, method: 'cash', amount: 100 })).toThrow(/settled/i)
    expect(() => orders.removePayment({ paymentId: paid.payments[0].id })).toThrow(/settled/i)
    expect(() => orders.complete({ orderId: order.id })).toThrow(/settled/i)
  })
})

describe('quantity, removal, voiding and modifiers move stock', () => {
  const newTable = (label) => db.prepare('INSERT INTO tables (label, seats) VALUES (?, 4)').run(label).lastInsertRowid

  test('raising quantity reserves more stock; lowering returns it', () => {
    const order = orders.openForTable({ tableId: newTable('T-qty'), user: BOSS })
    const product = firstProduct()
    const before = stockOf(product.id)
    orders.addItem({ orderId: order.id, productId: product.id })
    const item = orders.get(order.id).items[0]
    orders.setItemQty({ itemId: item.id, qty: 3 })
    expect(stockOf(product.id)).toBe(before - 3)
    orders.setItemQty({ itemId: item.id, qty: 1 })
    expect(stockOf(product.id)).toBe(before - 1)
  })

  test('raising quantity beyond stock is refused and leaves stock untouched', () => {
    const order = orders.openForTable({ tableId: newTable('T-qmax'), user: BOSS })
    const product = firstProduct()
    db.prepare('UPDATE products SET stock = 2 WHERE id = ?').run(product.id)
    orders.addItem({ orderId: order.id, productId: product.id }) // stock now 1, qty 1
    const item = orders.get(order.id).items[0]
    expect(() => orders.setItemQty({ itemId: item.id, qty: 5 })).toThrow(/stock/i)
    expect(stockOf(product.id)).toBe(1)
  })

  test('setting quantity to zero removes the line and returns its stock', () => {
    const order = orders.openForTable({ tableId: newTable('T-zero'), user: BOSS })
    const product = firstProduct()
    db.prepare('UPDATE products SET stock = 10 WHERE id = ?').run(product.id)
    orders.addItem({ orderId: order.id, productId: product.id })
    const item = orders.get(order.id).items[0]
    const updated = orders.setItemQty({ itemId: item.id, qty: 0 })
    expect(updated.items).toHaveLength(0)
    expect(stockOf(product.id)).toBe(10)
  })

  test('removing an item returns its reserved stock', () => {
    const order = orders.openForTable({ tableId: newTable('T-rm'), user: BOSS })
    const product = firstProduct()
    db.prepare('UPDATE products SET stock = 10 WHERE id = ?').run(product.id)
    orders.addItem({ orderId: order.id, productId: product.id })
    const item = orders.get(order.id).items[0]
    orders.removeItem({ itemId: item.id })
    expect(stockOf(product.id)).toBe(10)
  })

  test('voiding an open order returns all reserved stock, frees the table, deletes the order', () => {
    const tid = newTable('T-void')
    const order = orders.openForTable({ tableId: tid, user: BOSS })
    const product = firstProduct()
    db.prepare('UPDATE products SET stock = 10 WHERE id = ?').run(product.id)
    orders.addItem({ orderId: order.id, productId: product.id })
    orders.void({ orderId: order.id })
    expect(stockOf(product.id)).toBe(10)
    expect(db.prepare('SELECT status FROM tables WHERE id = ?').get(tid).status).toBe('open')
    expect(orders.get(order.id)).toBeNull()
  })

  test('adding with modifiers makes a new line priced base+delta with a label', () => {
    const order = orders.openForTable({ tableId: newTable('T-mods'), user: BOSS })
    const product = firstProduct()
    db.prepare('UPDATE products SET stock = 10 WHERE id = ?').run(product.id)
    const before = stockOf(product.id)
    const gid = db.prepare('INSERT INTO modifier_groups (product_id, name, required, multi) VALUES (?, ?, 0, 0)').run(product.id, 'Size').lastInsertRowid
    const oid = db.prepare('INSERT INTO modifier_options (group_id, name, price_delta) VALUES (?, ?, ?)').run(gid, 'Large', 250).lastInsertRowid
    const updated = orders.addItemWithMods({ orderId: order.id, productId: product.id, optionIds: [oid] })
    const line = updated.items[updated.items.length - 1]
    expect(line.unit_price).toBe(product.price + 250)
    expect(line.modifiers).toBe('Large')
    expect(stockOf(product.id)).toBe(before - 1)
  })
})

describe('history admin paths', () => {
  const newTable = (label) => db.prepare('INSERT INTO tables (label, seats) VALUES (?, 4)').run(label).lastInsertRowid

  // Build a paid order with one line of `qty` on a fresh table; returns its id.
  const paidOrder = (label, qty = 1) => {
    const order = orders.openForTable({ tableId: newTable(label), user: BOSS })
    const product = firstProduct()
    db.prepare('UPDATE products SET stock = 20 WHERE id = ?').run(product.id)
    orders.addItem({ orderId: order.id, productId: product.id })
    if (qty > 1) orders.setItemQty({ itemId: orders.get(order.id).items[0].id, qty })
    const total = orders.get(order.id).total
    orders.addPayment({ orderId: order.id, method: 'cash', amount: total })
    orders.complete({ orderId: order.id })
    return { orderId: order.id, productId: product.id }
  }

  test('cancelling a paid order restores its stock and tags who deleted it', () => {
    const { orderId, productId } = paidOrder('T-cancel', 2)
    const before = stockOf(productId)
    orders.cancelPaid({ orderId, by: 'Boss' })
    expect(stockOf(productId)).toBe(before + 2)
    const row = db.prepare('SELECT status, deleted_by FROM orders WHERE id = ?').get(orderId)
    expect(row.status).toBe('cancelled')
    expect(row.deleted_by).toBe('Boss')
  })

  test('only paid orders can be cancelled', () => {
    const order = orders.openForTable({ tableId: newTable('T-open'), user: BOSS })
    expect(() => orders.cancelPaid({ orderId: order.id, by: 'Boss' })).toThrow(/only paid/i)
  })

  test('editing a paid order revalidates stock, refreshes total and change', () => {
    const { orderId, productId } = paidOrder('T-edit', 1) // paid exactly P, change 0
    const item = orders.get(orderId).items[0]
    const unit = item.unit_price
    const before = stockOf(productId)
    const updated = orders.updatePaid({ orderId, items: [{ id: item.id, qty: 3 }] })
    expect(updated.total).toBe(unit * 3)
    expect(stockOf(productId)).toBe(before - 2) // two more units consumed
    expect(updated.change_due).toBe(0) // paid P, new total 3P -> no change
  })

  test('editing a paid order beyond available stock is refused', () => {
    const { orderId } = paidOrder('T-editmax', 1)
    const item = orders.get(orderId).items[0]
    db.prepare('UPDATE products SET stock = 1 WHERE id = ?').run(item.product_id)
    expect(() => orders.updatePaid({ orderId, items: [{ id: item.id, qty: 50 }] })).toThrow(/stock/i)
  })
})
