import { ipcMain, BrowserWindow } from 'electron'
import { printReceipt } from './receipt'

/**
 * Registers every IPC handler. Channels are namespaced "entity:action".
 * Each handler receives a single plain payload object from the renderer.
 */
export function registerIpc(db) {
  // ---- settings (key/value store) ----
  const getSettings = () => {
    const rows = db.prepare('SELECT key, value FROM settings').all()
    const out = {}
    for (const r of rows) out[r.key] = r.value
    return out
  }

  // ---- order math ----
  // Recomputes subtotal from items, then total = subtotal - discount (never below 0).
  const recalcOrder = (orderId) => {
    const { subtotal } = db
      .prepare('SELECT COALESCE(SUM(unit_price * qty), 0) AS subtotal FROM order_items WHERE order_id = ?')
      .get(orderId)
    const order = db.prepare('SELECT discount FROM orders WHERE id = ?').get(orderId)
    const discount = Math.min(order ? order.discount : 0, subtotal)
    const total = subtotal - discount
    db.prepare('UPDATE orders SET subtotal = ?, total = ? WHERE id = ?').run(subtotal, total, orderId)
    return total
  }

  const getOrderWithItems = (orderId) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
    if (!order) return null
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(orderId)
    order.payments = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id').all(orderId)
    order.paid = order.payments.reduce((s, p) => s + p.amount, 0)
    order.remaining = Math.max(0, order.total - order.paid)
    return order
  }

  const handlers = {
    // ---------------- Settings ----------------
    'settings:get': () => getSettings(),

    'settings:set': ({ patch }) => {
      const set = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      for (const [key, value] of Object.entries(patch || {})) set.run(key, String(value))
      return getSettings()
    },

    'printers:list': async () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) return []
      const printers = await win.webContents.getPrintersAsync()
      return printers.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: p.isDefault }))
    },

    // ---------------- Categories ----------------
    'categories:list': () => db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all(),

    'categories:create': ({ name, color, sort_order }) => {
      const info = db
        .prepare('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)')
        .run(name, color || '#64748b', sort_order || 0)
      return db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid)
    },

    'categories:update': ({ id, name, color, sort_order }) => {
      db.prepare('UPDATE categories SET name = ?, color = ?, sort_order = ? WHERE id = ?').run(name, color, sort_order || 0, id)
      return db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
    },

    'categories:remove': ({ id }) => {
      db.prepare('DELETE FROM categories WHERE id = ?').run(id)
      return { ok: true }
    },

    // ---------------- Products ----------------
    'products:list': () =>
      db
        .prepare(
          `SELECT p.*, c.name AS category_name, c.color AS category_color
           FROM products p LEFT JOIN categories c ON c.id = p.category_id
           ORDER BY c.sort_order, p.name`
        )
        .all(),

    'products:byCategory': ({ categoryId }) =>
      db.prepare('SELECT * FROM products WHERE category_id = ? AND active = 1 ORDER BY name').all(categoryId),

    'products:create': ({ category_id, name, price, color }) => {
      const info = db
        .prepare('INSERT INTO products (category_id, name, price, color) VALUES (?, ?, ?, ?)')
        .run(category_id, name, price, color || null)
      return db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid)
    },

    'products:update': ({ id, category_id, name, price, color, active }) => {
      db.prepare('UPDATE products SET category_id = ?, name = ?, price = ?, color = ?, active = ? WHERE id = ?').run(
        category_id,
        name,
        price,
        color || null,
        active ? 1 : 0,
        id
      )
      return db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    },

    'products:remove': ({ id }) => {
      db.prepare('DELETE FROM products WHERE id = ?').run(id)
      return { ok: true }
    },

    // ---------------- Tables ----------------
    'tables:list': () => {
      const tables = db.prepare('SELECT * FROM tables ORDER BY CAST(label AS INTEGER), label').all()
      const openOrder = db.prepare(
        "SELECT id, total, (SELECT COALESCE(SUM(qty),0) FROM order_items WHERE order_id = orders.id) AS item_count FROM orders WHERE table_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1"
      )
      return tables.map((t) => ({ ...t, order: openOrder.get(t.id) || null }))
    },

    'tables:create': ({ label, seats }) => {
      const info = db.prepare('INSERT INTO tables (label, seats) VALUES (?, ?)').run(label, seats || 4)
      return db.prepare('SELECT * FROM tables WHERE id = ?').get(info.lastInsertRowid)
    },

    'tables:update': ({ id, label, seats }) => {
      db.prepare('UPDATE tables SET label = ?, seats = ? WHERE id = ?').run(label, seats || 4, id)
      return db.prepare('SELECT * FROM tables WHERE id = ?').get(id)
    },

    'tables:remove': ({ id }) => {
      // Discard any unpaid order on this table so it can always be removed.
      // (Paid orders keep their table_label for history via ON DELETE SET NULL.)
      db.prepare("DELETE FROM orders WHERE table_id = ? AND status = 'open'").run(id)
      db.prepare('DELETE FROM tables WHERE id = ?').run(id)
      return { ok: true }
    },

    // ---------------- Orders ----------------
    'orders:openForTable': ({ tableId }) => {
      let order = db
        .prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1")
        .get(tableId)
      if (!order) {
        const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId)
        const info = db
          .prepare("INSERT INTO orders (table_id, table_label, status) VALUES (?, ?, 'open')")
          .run(tableId, table ? table.label : null)
        db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(tableId)
        order = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid)
      }
      return getOrderWithItems(order.id)
    },

    'orders:get': ({ orderId }) => getOrderWithItems(orderId),

    'orders:addItem': ({ orderId, productId }) => {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId)
      if (!product) throw new Error('Product not found')
      const existing = db.prepare('SELECT * FROM order_items WHERE order_id = ? AND product_id = ?').get(orderId, productId)
      if (existing) {
        db.prepare('UPDATE order_items SET qty = qty + 1 WHERE id = ?').run(existing.id)
      } else {
        db.prepare('INSERT INTO order_items (order_id, product_id, name, unit_price, qty) VALUES (?, ?, ?, ?, 1)').run(
          orderId,
          productId,
          product.name,
          product.price
        )
      }
      recalcOrder(orderId)
      return getOrderWithItems(orderId)
    },

    'orders:setItemQty': ({ itemId, qty }) => {
      const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId)
      if (!item) throw new Error('Item not found')
      if (qty <= 0) db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId)
      else db.prepare('UPDATE order_items SET qty = ? WHERE id = ?').run(qty, itemId)
      recalcOrder(item.order_id)
      return getOrderWithItems(item.order_id)
    },

    'orders:removeItem': ({ itemId }) => {
      const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId)
      if (!item) return null
      db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId)
      recalcOrder(item.order_id)
      return getOrderWithItems(item.order_id)
    },

    // Set a discount as a fixed amount (millis) or a percentage of the subtotal.
    'orders:setDiscount': ({ orderId, type, value }) => {
      const { subtotal } = db
        .prepare('SELECT COALESCE(SUM(unit_price * qty),0) AS subtotal FROM order_items WHERE order_id = ?')
        .get(orderId)
      let discount = 0
      if (type === 'percent') discount = Math.round((subtotal * Number(value)) / 100)
      else discount = Math.round(Number(value))
      discount = Math.max(0, Math.min(discount, subtotal))
      db.prepare('UPDATE orders SET discount = ? WHERE id = ?').run(discount, orderId)
      recalcOrder(orderId)
      return getOrderWithItems(orderId)
    },

    'orders:void': ({ orderId }) => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
      if (order && order.table_id) db.prepare("UPDATE tables SET status = 'open' WHERE id = ?").run(order.table_id)
      db.prepare('DELETE FROM orders WHERE id = ?').run(orderId)
      return { ok: true }
    },

    // ---- split / partial payments ----
    'orders:addPayment': ({ orderId, method, amount }) => {
      db.prepare('INSERT INTO payments (order_id, method, amount) VALUES (?, ?, ?)').run(orderId, method || 'cash', Math.round(amount))
      return getOrderWithItems(orderId)
    },

    'orders:removePayment': ({ paymentId }) => {
      const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId)
      if (!p) return null
      db.prepare('DELETE FROM payments WHERE id = ?').run(paymentId)
      return getOrderWithItems(p.order_id)
    },

    // Finalize: requires payments to cover the total. Records change from cash overpayment.
    'orders:complete': ({ orderId }) => {
      const order = getOrderWithItems(orderId)
      if (!order) throw new Error('Order not found')
      if (order.paid < order.total) throw new Error('Payments do not cover the total')
      const cash = order.payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
      const change = Math.max(0, order.paid - order.total)
      db.prepare(
        "UPDATE orders SET status = 'paid', cash_received = ?, change_due = ?, paid_at = datetime('now') WHERE id = ?"
      ).run(cash, change, orderId)
      if (order.table_id) db.prepare("UPDATE tables SET status = 'open' WHERE id = ?").run(order.table_id)
      return getOrderWithItems(orderId)
    },

    // ---------------- Receipt ----------------
    'receipt:print': async ({ orderId }) => {
      const order = getOrderWithItems(orderId)
      if (!order) throw new Error('Order not found')
      const settings = getSettings()
      await printReceipt(order, settings)
      return { ok: true }
    },

    // ---------------- History ----------------
    'orders:history': ({ date }) => {
      const where = date ? "AND date(paid_at,'localtime') = ?" : ''
      const params = date ? [date] : []
      return db
        .prepare(
          `SELECT o.id, o.table_label, o.subtotal, o.discount, o.total, o.cash_received, o.change_due, o.paid_at,
                  (SELECT COALESCE(SUM(qty),0) FROM order_items WHERE order_id = o.id) AS item_count
           FROM orders o WHERE o.status = 'paid' ${where}
           ORDER BY o.paid_at DESC LIMIT 200`
        )
        .all(...params)
    },

    // ---------------- Analytics ----------------
    'analytics:overview': () => {
      const q = (cond) =>
        db.prepare(`SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count FROM orders WHERE status = 'paid' AND ${cond}`).get()
      return {
        today: q("date(paid_at,'localtime') = date('now','localtime')"),
        week: q("strftime('%Y-%W', paid_at,'localtime') = strftime('%Y-%W','now','localtime')"),
        month: q("strftime('%Y-%m', paid_at,'localtime') = strftime('%Y-%m','now','localtime')"),
        year: q("strftime('%Y', paid_at,'localtime') = strftime('%Y','now','localtime')")
      }
    },

    'analytics:series': ({ period }) => {
      const rows = db
        .prepare(
          `SELECT date(paid_at,'localtime') AS d, strftime('%Y-%W', paid_at,'localtime') AS w,
                  strftime('%Y-%m', paid_at,'localtime') AS m, strftime('%Y', paid_at,'localtime') AS y, total
           FROM orders WHERE status = 'paid'`
        )
        .all()
      return buildSeries(rows, period)
    },

    'analytics:topProducts': ({ period }) => {
      const where = periodWhere(period)
      return db
        .prepare(
          `SELECT oi.name AS name, SUM(oi.qty) AS qty, SUM(oi.qty * oi.unit_price) AS revenue
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE o.status = 'paid' AND ${where}
           GROUP BY oi.name ORDER BY revenue DESC LIMIT 10`
        )
        .all()
    },

    'analytics:recentOrders': () =>
      db
        .prepare(
          `SELECT id, table_label, total, cash_received, change_due, paid_at
           FROM orders WHERE status = 'paid' ORDER BY paid_at DESC LIMIT 25`
        )
        .all()
  }

  for (const [channel, fn] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, payload) => fn(payload || {}))
  }
}

// ---- analytics helpers (pure JS, run in main) ----
function periodWhere(period) {
  switch (period) {
    case 'today':
      return "date(o.paid_at,'localtime') = date('now','localtime')"
    case 'week':
      return "strftime('%Y-%W', o.paid_at,'localtime') = strftime('%Y-%W','now','localtime')"
    case 'month':
      return "strftime('%Y-%m', o.paid_at,'localtime') = strftime('%Y-%m','now','localtime')"
    case 'year':
      return "strftime('%Y', o.paid_at,'localtime') = strftime('%Y','now','localtime')"
    default:
      return '1=1'
  }
}

function buildSeries(rows, period) {
  const buckets = []
  const now = new Date()
  const fmt = (d) => d.toISOString().slice(0, 10)

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

function weekNumber(date) {
  const start = new Date(date.getFullYear(), 0, 1)
  const diff = (date - start) / 86400000
  return Math.floor((diff + start.getDay()) / 7)
}
