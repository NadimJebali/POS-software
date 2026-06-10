import { ipcMain, BrowserWindow } from 'electron'
import { printReceipt } from './receipt'
import { hashPin, verifyPin, needsRehash } from './auth-util'
import { getStatus as licenseStatus, activate as licenseActivate } from './license'
import { exportDatabase, importDatabase } from './backup'
import { exportAnalyticsPdf } from './report'
import { mt } from './i18n'

// Channels callable without being signed in (licensing + the login flow itself).
// Everything else requires an authenticated session — enforced in the dispatcher.
const PUBLIC_CHANNELS = new Set([
  'license:status', 'license:activate',
  'auth:needsSetup', 'auth:setup', 'auth:login', 'auth:logout', 'auth:current', 'auth:users',
  // The login/setup/activate screens render before sign-in and need shop name,
  // currency and logo. Settings hold no secrets; writing them stays admin-only.
  'settings:get'
])

// Channels only an authenticated admin may call (enforced in the dispatcher below).
const ADMIN_CHANNELS = new Set([
  'settings:set',
  'users:list', 'users:create', 'users:update', 'users:remove',
  'categories:create', 'categories:update', 'categories:remove',
  'products:create', 'products:update', 'products:remove',
  'modgroups:create', 'modgroups:remove', 'modoptions:create', 'modoptions:remove',
  'tables:create', 'tables:update', 'tables:remove',
  // Note: orders:cancelPaid is intentionally NOT admin-only — staff may delete
  // their own orders; the handler enforces the per-user restriction itself.
  'orders:updatePaid',
  'db:export', 'db:import'
])

/**
 * Registers every IPC handler. Channels are namespaced "entity:action".
 * Each handler receives a single plain payload object from the renderer.
 */
export function registerIpc(db) {
  // In-memory session for this terminal (cleared on logout / app restart).
  let currentUser = null
  const publicUser = (u) => (u ? { id: u.id, username: u.username, name: u.name, role: u.role } : null)

  // Failed-login throttle, keyed by username. After 5 wrong PINs the account locks
  // for an escalating cooldown (30s, then doubling, capped at 15 min) to make a
  // 4-digit PIN impractical to brute-force.
  const loginThrottle = new Map()
  const isAdmin = () => currentUser && currentUser.role === 'admin'

  // Boundary validation: the renderer is untrusted, so coerce and bound numeric
  // inputs here before they reach the DB. Returns a finite, rounded integer in
  // [min, max] or throws a user-facing error.
  const intIn = (value, { min = 0, max = Number.MAX_SAFE_INTEGER, name = 'value' } = {}) => {
    const n = Math.round(Number(value))
    if (!Number.isFinite(n)) throw new Error(`${name} must be a number`)
    if (n < min || n > max) throw new Error(`${name} is out of range`)
    return n
  }

  // Boundary validation for required text fields: trims and rejects empty values
  // with a friendly message instead of a raw NOT NULL constraint error.
  const textIn = (value, name) => {
    const s = String(value ?? '').trim()
    if (!s) throw new Error(`${name} is required`)
    return s
  }

  // Runs a handler body inside a single transaction: multi-statement writes either
  // all land or none do, and the database is exported to disk once, not per statement.
  // Don't nest — the adapter's transaction() issues a plain BEGIN/COMMIT.
  const inTx = (fn) => db.transaction(fn)()

  // Backup/restore is a licensed-only feature — a trial or unlicensed copy can't use it.
  const requireLicensed = () => {
    if (licenseStatus().state !== 'licensed') {
      throw new Error('An active license is required to back up or restore the database')
    }
  }

  // SQL fragment limiting rows to the signed-in user's own orders (everything for
  // admins). `alias` is the orders-table alias used in the surrounding query.
  // Safe to inline: the id is a number from our own in-memory session.
  const ownOrders = (alias) => (isAdmin() ? '1=1' : `${alias}.user_id = ${Number(currentUser?.id) || 0}`)

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

  // Stock is reserved the moment an item is added to an open order, so products.stock
  // always reflects what's physically left. Returning an order's items puts their
  // reserved stock back (used when voiding an open order or deleting its table).
  const restoreOrderStock = (orderId) => {
    const inc = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
    const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(orderId)
    for (const it of items) if (it.product_id) inc.run(it.qty, it.product_id)
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
    // ---------------- Licensing ----------------
    'license:status': () => licenseStatus(),
    'license:activate': ({ license }) => licenseActivate(license),

    // ---------------- Backup / restore (activated license only) ----------------
    'db:export': () => {
      requireLicensed()
      return exportDatabase(db)
    },
    'db:import': () => {
      requireLicensed()
      return importDatabase(db)
    },

    // ---------------- First-run setup ----------------
    // The app needs setup until at least one admin exists.
    'auth:needsSetup': () => db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n === 0,

    // Create the first administrator and sign them in. Refuses once an admin exists.
    'auth:setup': ({ username, name, pin }) => {
      const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n
      if (admins > 0) throw new Error('Setup has already been completed')
      const uname = String(username || 'admin').trim() || 'admin'
      if (!pin || String(pin).length < 4) throw new Error('PIN must be at least 4 digits')
      const info = db
        .prepare("INSERT INTO users (username, name, pin_hash, role) VALUES (?, ?, ?, 'admin')")
        .run(uname, name || 'Administrator', hashPin(pin))
      currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)
      return publicUser(currentUser)
    },

    // ---------------- Auth ----------------
    'auth:login': ({ username, pin }) => {
      const uname = String(username || '').trim()
      const now = Date.now()
      const t = loginThrottle.get(uname) || { fails: 0, lockedUntil: 0 }
      if (t.lockedUntil > now) {
        throw new Error(`Too many attempts. Try again in ${Math.ceil((t.lockedUntil - now) / 1000)}s`)
      }
      const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(uname)
      if (!user || !verifyPin(pin, user.pin_hash)) {
        t.fails++
        if (t.fails % 5 === 0) {
          const blocks = t.fails / 5
          t.lockedUntil = now + Math.min(30000 * 2 ** (blocks - 1), 15 * 60000)
        }
        loginThrottle.set(uname, t)
        throw new Error('Invalid username or PIN')
      }
      loginThrottle.delete(uname) // success clears the counter
      // Opportunistically upgrade hashes written under an older (weaker) work factor,
      // now that we have the plaintext PIN in hand from a valid sign-in.
      if (needsRehash(user.pin_hash)) {
        try {
          db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(pin), user.id)
        } catch {
          // Non-fatal: login still succeeds; we just retry the upgrade next time.
        }
      }
      currentUser = user
      return publicUser(user)
    },
    'auth:logout': () => {
      currentUser = null
      return { ok: true }
    },
    'auth:current': () => publicUser(currentUser),

    // Active users for the login picker (names/roles only — no hashes).
    'auth:users': () => db.prepare("SELECT id, username, name, role FROM users WHERE active = 1 ORDER BY role, username").all(),

    // ---------------- Users (admin) ----------------
    'users:list': () => db.prepare('SELECT id, username, name, role, active, created_at FROM users ORDER BY role, username').all(),

    'users:create': ({ username, name, pin, role }) => {
      const uname = String(username || '').trim()
      if (!uname) throw new Error('Username is required')
      if (!pin || String(pin).length < 4) throw new Error('PIN must be at least 4 digits')
      const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(uname)
      if (exists) throw new Error('That username already exists')
      const info = db
        .prepare('INSERT INTO users (username, name, pin_hash, role) VALUES (?, ?, ?, ?)')
        .run(uname, name || uname, hashPin(pin), role === 'admin' ? 'admin' : 'user')
      return db.prepare('SELECT id, username, name, role, active FROM users WHERE id = ?').get(info.lastInsertRowid)
    },

    'users:update': ({ id, name, role, active, pin }) => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
      if (!user) throw new Error('User not found')
      // Don't allow demoting/deactivating the last active admin.
      const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n
      const losingAdmin = user.role === 'admin' && user.active && (role !== 'admin' || active === 0)
      if (losingAdmin && admins <= 1) throw new Error('You cannot remove the last administrator')
      if (pin && String(pin).length < 4) throw new Error('PIN must be at least 4 digits')
      inTx(() => {
        db.prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?').run(
          name || user.name,
          role === 'admin' ? 'admin' : 'user',
          active ? 1 : 0,
          id
        )
        if (pin) db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(pin), id)
      })
      return db.prepare('SELECT id, username, name, role, active FROM users WHERE id = ?').get(id)
    },

    'users:remove': ({ id }) => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
      if (!user) return { ok: true }
      if (currentUser && currentUser.id === id) throw new Error('You cannot delete the account you are signed in with')
      const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n
      if (user.role === 'admin' && user.active && admins <= 1) throw new Error('You cannot delete the last administrator')
      db.prepare('DELETE FROM users WHERE id = ?').run(id)
      return { ok: true }
    },

    // ---------------- Settings ----------------
    'settings:get': () => getSettings(),

    'settings:set': ({ patch }) => {
      const set = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      inTx(() => {
        for (const [key, value] of Object.entries(patch || {})) set.run(key, String(value))
      })
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
        .run(textIn(name, 'Category name'), color || '#64748b', sort_order || 0)
      return db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid)
    },

    'categories:update': ({ id, name, color, sort_order }) => {
      db.prepare('UPDATE categories SET name = ?, color = ?, sort_order = ? WHERE id = ?').run(textIn(name, 'Category name'), color, sort_order || 0, id)
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
          `SELECT p.*, c.name AS category_name, c.color AS category_color,
                  (SELECT COUNT(*) FROM modifier_groups WHERE product_id = p.id) AS modifier_count
           FROM products p LEFT JOIN categories c ON c.id = p.category_id
           ORDER BY c.sort_order, p.name`
        )
        .all(),

    'products:byCategory': ({ categoryId }) =>
      db
        .prepare(
          `SELECT p.*, (SELECT COUNT(*) FROM modifier_groups WHERE product_id = p.id) AS modifier_count
           FROM products p WHERE p.category_id = ? AND p.active = 1 ORDER BY p.name`
        )
        .all(categoryId),

    // Barcode lookup for scanning (matches active products).
    'products:byBarcode': ({ barcode }) => {
      const code = String(barcode || '').trim()
      if (!code) return null
      return db
        .prepare(
          `SELECT p.*, (SELECT COUNT(*) FROM modifier_groups WHERE product_id = p.id) AS modifier_count
           FROM products p WHERE p.barcode = ? AND p.active = 1 LIMIT 1`
        )
        .get(code)
    },

    'products:create': ({ category_id, name, price, color, stock, barcode, image }) => {
      const safePrice = intIn(price, { name: 'Price' })
      const safeStock = intIn(stock || 0, { name: 'Stock' })
      const info = db
        .prepare('INSERT INTO products (category_id, name, price, color, stock, barcode, image) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(category_id, textIn(name, 'Product name'), safePrice, color || null, safeStock, barcode || null, image || null)
      return db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid)
    },

    'products:update': ({ id, category_id, name, price, color, active, stock, barcode, image }) => {
      db.prepare('UPDATE products SET category_id = ?, name = ?, price = ?, color = ?, active = ?, stock = ?, barcode = ?, image = ? WHERE id = ?').run(
        category_id,
        textIn(name, 'Product name'),
        intIn(price, { name: 'Price' }),
        color || null,
        active ? 1 : 0,
        intIn(stock || 0, { name: 'Stock' }),
        barcode || null,
        image || null,
        id
      )
      return db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    },

    // Lightweight stock-only snapshot (id → stock) for the order screen's live
    // refresh, so it never has to pull product images on every tap.
    'products:stock': () => db.prepare('SELECT id, stock FROM products').all(),

    // ---- Modifiers ----
    'products:modifiers': ({ productId }) => {
      const groups = db.prepare('SELECT * FROM modifier_groups WHERE product_id = ? ORDER BY sort_order, id').all(productId)
      const optStmt = db.prepare('SELECT * FROM modifier_options WHERE group_id = ? ORDER BY sort_order, id')
      return groups.map((g) => ({ ...g, options: optStmt.all(g.id) }))
    },

    'modgroups:create': ({ product_id, name, required, multi }) => {
      const info = db
        .prepare('INSERT INTO modifier_groups (product_id, name, required, multi) VALUES (?, ?, ?, ?)')
        .run(product_id, textIn(name, 'Group name'), required ? 1 : 0, multi ? 1 : 0)
      return db.prepare('SELECT * FROM modifier_groups WHERE id = ?').get(info.lastInsertRowid)
    },
    'modgroups:remove': ({ id }) => {
      db.prepare('DELETE FROM modifier_groups WHERE id = ?').run(id)
      return { ok: true }
    },
    'modoptions:create': ({ group_id, name, price_delta }) => {
      const info = db
        .prepare('INSERT INTO modifier_options (group_id, name, price_delta) VALUES (?, ?, ?)')
        .run(group_id, textIn(name, 'Option name'), Math.round(price_delta || 0))
      return db.prepare('SELECT * FROM modifier_options WHERE id = ?').get(info.lastInsertRowid)
    },
    'modoptions:remove': ({ id }) => {
      db.prepare('DELETE FROM modifier_options WHERE id = ?').run(id)
      return { ok: true }
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
      const name = String(label || '').trim()
      if (!name) throw new Error('Table number is required')
      const clash = db.prepare('SELECT id FROM tables WHERE label = ? COLLATE NOCASE').get(name)
      if (clash) throw new Error(`Table "${name}" already exists`)
      const info = db.prepare('INSERT INTO tables (label, seats) VALUES (?, ?)').run(name, seats || 4)
      return db.prepare('SELECT * FROM tables WHERE id = ?').get(info.lastInsertRowid)
    },

    'tables:update': ({ id, label, seats }) => {
      const name = String(label || '').trim()
      if (!name) throw new Error('Table number is required')
      const clash = db.prepare('SELECT id FROM tables WHERE label = ? COLLATE NOCASE AND id != ?').get(name, id)
      if (clash) throw new Error(`Table "${name}" already exists`)
      db.prepare('UPDATE tables SET label = ?, seats = ? WHERE id = ?').run(name, seats || 4, id)
      return db.prepare('SELECT * FROM tables WHERE id = ?').get(id)
    },

    'tables:remove': ({ id }) => {
      // Discard any unpaid order on this table so it can always be removed.
      // (Paid orders keep their table_label for history via ON DELETE SET NULL.)
      inTx(() => {
        const openOrders = db.prepare("SELECT id FROM orders WHERE table_id = ? AND status = 'open'").all(id)
        for (const o of openOrders) restoreOrderStock(o.id) // return their reserved stock
        db.prepare("DELETE FROM orders WHERE table_id = ? AND status = 'open'").run(id)
        db.prepare('DELETE FROM tables WHERE id = ?').run(id)
      })
      return { ok: true }
    },

    // ---------------- Orders ----------------
    'orders:openForTable': ({ tableId }) => {
      let order = db
        .prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1")
        .get(tableId)
      if (!order) {
        const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId)
        // Attribute the order to whoever is signed in (the server taking it).
        order = inTx(() => {
          const info = db
            .prepare("INSERT INTO orders (table_id, table_label, status, user_id, user_name) VALUES (?, ?, 'open', ?, ?)")
            .run(
              tableId,
              table ? table.label : null,
              currentUser ? currentUser.id : null,
              currentUser ? currentUser.name || currentUser.username : null
            )
          db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(tableId)
          return db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid)
        })
      }
      return getOrderWithItems(order.id)
    },

    'orders:get': ({ orderId }) => getOrderWithItems(orderId),

    'orders:addItem': ({ orderId, productId }) => {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId)
      if (!product) throw new Error('Product not found')
      if (product.stock < 1) throw new Error(`Not enough stock for ${product.name}`)
      const existing = db.prepare('SELECT * FROM order_items WHERE order_id = ? AND product_id = ?').get(orderId, productId)
      inTx(() => {
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
        db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ?').run(productId) // reserve the unit
        recalcOrder(orderId)
      })
      return getOrderWithItems(orderId)
    },

    // Add a product with chosen modifier options. Always a new line (never merged),
    // priced as base + sum of option deltas, with a human-readable modifier label.
    'orders:addItemWithMods': ({ orderId, productId, optionIds }) => {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId)
      if (!product) throw new Error('Product not found')
      if (product.stock < 1) throw new Error(`Not enough stock for ${product.name}`)
      let delta = 0
      let label = ''
      const ids = (optionIds || []).filter((x) => x != null)
      if (ids.length) {
        const opts = db
          .prepare(`SELECT * FROM modifier_options WHERE id IN (${ids.map(() => '?').join(',')})`)
          .all(...ids)
        delta = opts.reduce((s, o) => s + o.price_delta, 0)
        label = opts.map((o) => o.name).join(', ')
      }
      inTx(() => {
        db.prepare(
          'INSERT INTO order_items (order_id, product_id, name, unit_price, qty, modifiers) VALUES (?, ?, ?, ?, 1, ?)'
        ).run(orderId, productId, product.name, product.price + delta, label || null)
        db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ?').run(productId) // reserve the unit
        recalcOrder(orderId)
      })
      return getOrderWithItems(orderId)
    },

    'orders:setItemQty': ({ itemId, qty }) => {
      const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId)
      if (!item) throw new Error('Item not found')
      const newQty = intIn(qty, { min: 0, name: 'Quantity' })
      const delta = newQty - item.qty // positive => reserve more units
      if (delta > 0 && item.product_id) {
        const product = db.prepare('SELECT name, stock FROM products WHERE id = ?').get(item.product_id)
        if (!product || product.stock < delta) throw new Error(`Not enough stock${product ? ' for ' + product.name : ''}`)
      }
      inTx(() => {
        if (newQty <= 0) db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId)
        else db.prepare('UPDATE order_items SET qty = ? WHERE id = ?').run(newQty, itemId)
        // Reserve the extra units (delta > 0) or return the freed ones (delta < 0).
        if (item.product_id && delta !== 0) db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(delta, item.product_id)
        recalcOrder(item.order_id)
      })
      return getOrderWithItems(item.order_id)
    },

    'orders:removeItem': ({ itemId }) => {
      const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId)
      if (!item) return null
      inTx(() => {
        if (item.product_id) db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.qty, item.product_id) // return reserved stock
        db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId)
        recalcOrder(item.order_id)
      })
      return getOrderWithItems(item.order_id)
    },

    // Set a discount as a fixed amount (millis) or a percentage of the subtotal.
    'orders:setDiscount': ({ orderId, type, value }) => {
      const { subtotal } = db
        .prepare('SELECT COALESCE(SUM(unit_price * qty),0) AS subtotal FROM order_items WHERE order_id = ?')
        .get(orderId)
      const amount = Number(value)
      if (!Number.isFinite(amount) || amount < 0) throw new Error('Discount must be a positive number')
      let discount = 0
      if (type === 'percent') discount = Math.round((subtotal * amount) / 100)
      else discount = Math.round(amount)
      discount = Math.max(0, Math.min(discount, subtotal))
      inTx(() => {
        db.prepare('UPDATE orders SET discount = ? WHERE id = ?').run(discount, orderId)
        recalcOrder(orderId)
      })
      return getOrderWithItems(orderId)
    },

    'orders:void': ({ orderId }) => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
      inTx(() => {
        if (order && order.status === 'open') restoreOrderStock(orderId) // put reserved stock back
        if (order && order.table_id) db.prepare("UPDATE tables SET status = 'open' WHERE id = ?").run(order.table_id)
        db.prepare('DELETE FROM orders WHERE id = ?').run(orderId)
      })
      return { ok: true }
    },

    // ---- split / partial payments ----
    // Payments may only be attached to (or removed from) orders that are still open —
    // a stale checkout screen must not be able to alter a settled order's money.
    'orders:addPayment': ({ orderId, method, amount }) => {
      const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(orderId)
      if (!order) throw new Error('Order not found')
      if (order.status !== 'open') throw new Error('This order has already been settled')
      const safeAmount = intIn(amount, { min: 1, name: 'Payment amount' })
      db.prepare('INSERT INTO payments (order_id, method, amount) VALUES (?, ?, ?)').run(orderId, method || 'cash', safeAmount)
      return getOrderWithItems(orderId)
    },

    'orders:removePayment': ({ paymentId }) => {
      const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId)
      if (!p) return null
      const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(p.order_id)
      if (order && order.status !== 'open') throw new Error('This order has already been settled')
      db.prepare('DELETE FROM payments WHERE id = ?').run(paymentId)
      return getOrderWithItems(p.order_id)
    },

    // Finalize: requires payments to cover the total. Change can only be returned
    // from physically tendered cash — a card overpayment earns no change.
    'orders:complete': ({ orderId }) => {
      const order = getOrderWithItems(orderId)
      if (!order) throw new Error('Order not found')
      if (order.status !== 'open') throw new Error('This order has already been settled')
      if (order.paid < order.total) throw new Error('Payments do not cover the total')
      const cash = order.payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
      const change = Math.max(0, Math.min(order.paid - order.total, cash))
      inTx(() => {
        db.prepare(
          "UPDATE orders SET status = 'paid', cash_received = ?, change_due = ?, paid_at = datetime('now') WHERE id = ?"
        ).run(cash, change, orderId)
        // Stock was already reserved when each item was added to the order, so there's
        // nothing to draw down here — the units simply convert from reserved to sold.
        if (order.table_id) db.prepare("UPDATE tables SET status = 'open' WHERE id = ?").run(order.table_id)
      })
      return getOrderWithItems(orderId)
    },

    // ---------------- History admin actions ----------------
    // Delete a paid order: restore stock and mark it cancelled. It stays in history,
    // tagged with who deleted it, but is excluded from revenue/analytics.
    // Any signed-in user may delete any order.
    'orders:cancelPaid': ({ orderId }) => {
      const order = getOrderWithItems(orderId)
      if (!order) throw new Error('Order not found')
      if (order.status !== 'paid') throw new Error('Only paid orders can be deleted')
      const inc = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
      const by = currentUser ? currentUser.name || currentUser.username : 'Unknown'
      inTx(() => {
        for (const it of order.items) if (it.product_id) inc.run(it.qty, it.product_id)
        db.prepare("UPDATE orders SET status = 'cancelled', deleted_at = datetime('now'), deleted_by = ? WHERE id = ?").run(by, orderId)
      })
      return { ok: true }
    },

    // Edit a paid order's quantities (0 removes a line) and discount; adjusts stock by the delta.
    'orders:updatePaid': ({ orderId, items, discountType, discountValue }) => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
      if (!order || order.status !== 'paid') throw new Error('Order is not editable')

      // Validate before mutating: this order's quantities are already reserved from
      // stock, so raising a line by N units needs N more units still on hand.
      // Aggregate the net change per product so multi-line products are checked once.
      const netDelta = new Map() // productId -> (oldQty - newQty) summed; negative => consumes more
      for (const change of items || []) {
        const item = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(change.id, orderId)
        if (!item || !item.product_id) continue
        const newQty = Math.max(0, Math.round(change.qty))
        netDelta.set(item.product_id, (netDelta.get(item.product_id) || 0) + (item.qty - newQty))
      }
      for (const [productId, delta] of netDelta) {
        if (delta >= 0) continue // returning stock is always fine
        const product = db.prepare('SELECT name, stock FROM products WHERE id = ?').get(productId)
        if (product && product.stock + delta < 0) {
          throw new Error(`Not enough stock for ${product.name} — only ${product.stock} more available`)
        }
      }

      const adjust = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
      inTx(() => {
        for (const change of items || []) {
          const item = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(change.id, orderId)
          if (!item) continue
          const newQty = Math.max(0, Math.round(change.qty))
          const delta = item.qty - newQty // positive => return stock
          if (delta !== 0 && item.product_id) adjust.run(delta, item.product_id)
          if (newQty === 0) db.prepare('DELETE FROM order_items WHERE id = ?').run(item.id)
          else db.prepare('UPDATE order_items SET qty = ? WHERE id = ?').run(newQty, item.id)
        }
        // Recompute subtotal -> discount -> total, and refresh change.
        const { subtotal } = db
          .prepare('SELECT COALESCE(SUM(unit_price * qty),0) AS subtotal FROM order_items WHERE order_id = ?')
          .get(orderId)
        let discount = order.discount
        if (discountType === 'percent') discount = Math.round((subtotal * Number(discountValue)) / 100)
        else if (discountType === 'amount') discount = Math.round(Number(discountValue))
        discount = Math.max(0, Math.min(discount, subtotal))
        const total = subtotal - discount
        const paidRow = db.prepare('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE order_id = ?').get(orderId)
        db.prepare('UPDATE orders SET subtotal = ?, discount = ?, total = ?, change_due = ? WHERE id = ?').run(
          subtotal,
          discount,
          total,
          Math.max(0, paidRow.paid - total),
          orderId
        )
      })
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
      // Every user sees the full history. Deleted (cancelled) orders stay listed,
      // tagged with who removed them.
      return db
        .prepare(
          `SELECT o.id, o.table_label, o.subtotal, o.discount, o.total, o.cash_received, o.change_due, o.paid_at, o.user_id, o.user_name,
                  o.status, o.deleted_at, o.deleted_by,
                  (SELECT COALESCE(SUM(qty),0) FROM order_items WHERE order_id = o.id) AS item_count
           FROM orders o WHERE o.status IN ('paid','cancelled') ${where}
           ORDER BY o.paid_at DESC LIMIT 200`
        )
        .all(...params)
    },

    // ---------------- Analytics ----------------
    'analytics:overview': () => {
      const q = (cond) =>
        db
          .prepare(`SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count FROM orders WHERE status = 'paid' AND ${ownOrders('orders')} AND ${cond}`)
          .get()
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
           FROM orders WHERE status = 'paid' AND ${ownOrders('orders')}`
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
           WHERE o.status = 'paid' AND ${ownOrders('o')} AND ${where}
           GROUP BY oi.name ORDER BY revenue DESC LIMIT 10`
        )
        .all()
    },

    // Sales grouped by the user who served each order, for the given period.
    'analytics:byServer': ({ period }) => {
      const where = periodWhere(period)
      return db
        .prepare(
          `SELECT COALESCE(o.user_name, 'Unknown') AS name, COUNT(*) AS orders, COALESCE(SUM(o.total),0) AS revenue
           FROM orders o WHERE o.status = 'paid' AND ${ownOrders('o')} AND ${where}
           GROUP BY COALESCE(o.user_name, 'Unknown') ORDER BY revenue DESC`
        )
        .all()
    },

    'analytics:recentOrders': () =>
      db
        .prepare(
          `SELECT id, table_label, total, cash_received, change_due, paid_at
           FROM orders WHERE status = 'paid' AND ${ownOrders('orders')} ORDER BY paid_at DESC LIMIT 25`
        )
        .all(),

    // Export the analytics as a PDF with caller-chosen parameters: a date range
    // (from/to as YYYY-MM-DD, or null = all time), an optional staff filter, and
    // which sections to include. Scope is enforced here — non-admins are always
    // locked to their own sales regardless of any userId passed in.
    'analytics:exportPdf': ({ from, to, userId, sections, rangeLabel, rangeKey, lang }) => {
      const settings = getSettings()
      const reportLang = lang || settings.language || 'en'
      const scopedUserId = isAdmin()
        ? userId != null && userId !== '' ? Number(userId) : null
        : currentUser
          ? currentUser.id
          : -1

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

      const byServer = db
        .prepare(
          `SELECT COALESCE(o.user_name,'Unknown') AS name, COUNT(*) AS orders, COALESCE(SUM(o.total),0) AS revenue
           FROM orders o WHERE ${whereO} GROUP BY COALESCE(o.user_name,'Unknown') ORDER BY revenue DESC`
        )
        .all(...params)

      const methods = db
        .prepare(`SELECT p.method AS method, COALESCE(SUM(p.amount),0) AS amount FROM payments p JOIN orders o ON o.id = p.order_id WHERE ${whereO} GROUP BY p.method ORDER BY amount DESC`)
        .all(...params)
      const change = db.prepare(`SELECT COALESCE(SUM(o.change_due),0) AS c FROM orders o WHERE ${whereO}`).get(...params).c

      let scope
      if (!isAdmin()) scope = currentUser ? currentUser.name || currentUser.username : 'You'
      else if (scopedUserId != null) {
        const u = db.prepare('SELECT name, username FROM users WHERE id = ?').get(scopedUserId)
        scope = u ? u.name || u.username : 'Unknown'
      } else scope = mt(reportLang, 'report.allStaff')

      // Preset ranges arrive as a rangeKey we can localize here; custom ranges send
      // a pre-formatted rangeLabel (a date span) from the renderer.
      const resolvedRange = rangeKey ? mt(reportLang, `report.${rangeKey}`) : rangeLabel || mt(reportLang, 'report.allTime')

      const want = sections || {}
      return exportAnalyticsPdf({
        shop: settings,
        lang: reportLang,
        isAdmin: isAdmin(),
        scope,
        rangeLabel: resolvedRange,
        sections: {
          summary: want.summary !== false,
          trend: want.trend !== false,
          topProducts: want.topProducts !== false,
          byServer: want.byServer !== false,
          payments: want.payments !== false
        },
        summary,
        trend,
        trendBy: byDay ? 'day' : 'month',
        top,
        byServer,
        payments: { methods, change },
        generatedAt: new Date()
      })
    }
  }

  for (const [channel, fn] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, payload) => {
      // The renderer gates the UI, but the main process is the real trust boundary:
      // every non-public channel requires a signed-in session, admin ones an admin.
      if (!PUBLIC_CHANNELS.has(channel) && !currentUser) {
        throw new Error('Please sign in first')
      }
      if (ADMIN_CHANNELS.has(channel) && (!currentUser || currentUser.role !== 'admin')) {
        throw new Error('Administrator access required')
      }
      return fn(payload || {})
    })
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

// Week-of-year matching SQLite's strftime('%W'): Monday-based, 00–53, where days
// before the year's first Monday fall in week 00. Buckets built here must line up
// with the '%Y-%W' keys coming out of SQL, or the weekly chart reads zero.
export function weekNumber(date) {
  const jan1 = new Date(date.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((date - jan1) / 86400000) // 0-based
  const mondayDow = (date.getDay() + 6) % 7 // Monday = 0
  return Math.floor((dayOfYear + 7 - mondayDow) / 7)
}
