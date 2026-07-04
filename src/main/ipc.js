import { ipcMain, BrowserWindow } from 'electron'
import { printReceipt } from './receipt'
import { hashPin, verifyPin, needsRehash } from './auth-util'
import {
  getStatus as licenseStatus,
  activate as licenseActivate,
  activateByCode as licenseActivateByCode,
  renewLicense
} from './license'
import { exportDatabase, importDatabase } from './backup'
import { exportAnalyticsPdf } from './report'
import { mt } from './i18n'
import { createOrders } from './orders'
import { createAnalytics } from './analytics'

// Channels callable without being signed in (licensing + the login flow itself).
// Everything else requires an authenticated session — enforced in the dispatcher.
const PUBLIC_CHANNELS = new Set([
  'license:status', 'license:activate', 'license:activateByCode', 'license:renew',
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

  // ---- order domain ----
  // The full order lifecycle lives in a deep module. The handlers below stay thin:
  // boundary validation (numeric coercion, auth/role, session attribution) here,
  // domain rules (stock reservation, discount clamp, change calc) behind one interface.
  const orderDomain = createOrders(db)

  // Analytics queries live in their own module; the handlers pass the session
  // scope (ownOrders) and the live clock in.
  const analytics = createAnalytics(db)

  const handlers = {
    // ---------------- Licensing ----------------
    'license:status': () => licenseStatus(),
    'license:activate': ({ license }) => licenseActivate(license),
    'license:activateByCode': ({ code }) => licenseActivateByCode(code),
    // Silent background renewal; never throws. Returns the (possibly refreshed) status
    // so the renderer can update its banners without a second round-trip.
    'license:renew': async () => {
      await renewLicense()
      return licenseStatus()
    },

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
        for (const o of openOrders) orderDomain.restoreOrderStock(o.id) // return their reserved stock
        db.prepare("DELETE FROM orders WHERE table_id = ? AND status = 'open'").run(id)
        db.prepare('DELETE FROM tables WHERE id = ?').run(id)
      })
      return { ok: true }
    },

    // ---------------- Orders ----------------
    'orders:openForTable': ({ tableId }) => orderDomain.openForTable({ tableId, user: currentUser }),

    'orders:get': ({ orderId }) => orderDomain.get(orderId),

    'orders:addItem': ({ orderId, productId }) => orderDomain.addItem({ orderId, productId }),

    'orders:addItemWithMods': ({ orderId, productId, optionIds }) => orderDomain.addItemWithMods({ orderId, productId, optionIds }),

    'orders:setItemQty': ({ itemId, qty }) =>
      orderDomain.setItemQty({ itemId, qty: intIn(qty, { min: 0, name: 'Quantity' }) }),

    'orders:removeItem': ({ itemId }) => orderDomain.removeItem({ itemId }),

    'orders:setDiscount': ({ orderId, type, value }) => orderDomain.setDiscount({ orderId, type, value }),

    'orders:void': ({ orderId }) => orderDomain.void({ orderId }),

    // ---- split / partial payments ----
    // Payment amount is coerced at this boundary; the domain enforces the
    // open-order rule before recording it.
    'orders:addPayment': ({ orderId, method, amount }) =>
      orderDomain.addPayment({ orderId, method, amount: intIn(amount, { min: 1, name: 'Payment amount' }) }),

    'orders:removePayment': ({ paymentId }) => orderDomain.removePayment({ paymentId }),

    'orders:complete': ({ orderId }) => orderDomain.complete({ orderId }),

    // By-item split: coerce every person's tender and assigned quantities here
    // (the renderer is untrusted); the domain computes shares and enforces the rules.
    'orders:completeSplit': ({ orderId, groups }) =>
      orderDomain.completeSplit({
        orderId,
        groups: (groups || []).map((g) => ({
          method: g.method === 'card' ? 'card' : 'cash',
          tendered: intIn(g.tendered, { min: 0, name: 'Tender' }),
          items: (g.items || []).map((it) => ({ itemId: it.itemId, qty: intIn(it.qty, { min: 1, name: 'Quantity' }) }))
        }))
      }),

    // ---------------- History admin actions ----------------
    // Delete a paid order: restore stock and mark it cancelled. It stays in history,
    // tagged with who deleted it, but is excluded from revenue/analytics.
    // Any signed-in user may delete any order.
    'orders:cancelPaid': ({ orderId }) =>
      orderDomain.cancelPaid({ orderId, by: currentUser ? currentUser.name || currentUser.username : 'Unknown' }),

    // Edit a paid order's quantities (0 removes a line) and discount; adjusts stock by the delta.
    'orders:updatePaid': ({ orderId, items, discountType, discountValue }) =>
      orderDomain.updatePaid({ orderId, items, discountType, discountValue }),

    // ---------------- Receipt ----------------
    'receipt:print': async ({ orderId }) => {
      const order = orderDomain.get(orderId)
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
    // Handlers supply the session scope (ownOrders) + live clock; the analytics
    // module owns the period->SQL mapping, the queries, and the bucketing.
    'analytics:overview': () => analytics.overview(ownOrders('orders')),

    'analytics:series': ({ period }) => analytics.series(period, ownOrders('orders'), new Date()),

    'analytics:topProducts': ({ period }) => analytics.topProducts(period, ownOrders('o')),

    'analytics:byServer': ({ period }) => analytics.byServer(period, ownOrders('o')),

    'analytics:recentOrders': () => analytics.recentOrders(ownOrders('orders')),

    // Export the analytics as a PDF. Scope is enforced here — non-admins are always
    // locked to their own sales regardless of any userId passed in. The query work
    // is the analytics module's; this handler resolves session + labels + i18n.
    'analytics:exportPdf': ({ from, to, userId, sections, rangeLabel, rangeKey, lang }) => {
      const settings = getSettings()
      const reportLang = lang || settings.language || 'en'
      const scopedUserId = isAdmin()
        ? userId != null && userId !== '' ? Number(userId) : null
        : currentUser
          ? currentUser.id
          : -1

      const data = analytics.report({ from, to, scopedUserId })

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
        ...data,
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

