import initSqlJs from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { DEFAULT_SETTINGS } from '../shared/settings'

/**
 * Money is stored everywhere as INTEGER millimes (1 TND = 1000 millimes)
 * to avoid floating-point rounding. Formatting to "12.500 DT" happens in the UI.
 *
 * Storage: sql.js (SQLite compiled to WebAssembly — no native build needed).
 * The whole database lives in memory and is exported to pos.db on every change.
 * A small adapter below mimics the better-sqlite3 prepare().get/all/run API so
 * the rest of the app is storage-agnostic.
 */
export async function initDatabase() {
  const SQL = await initSqlJs({ wasmBinary: readFileSync(resolveWasm()) })
  const dbPath = join(app.getPath('userData'), 'pos.db')
  const sqldb = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database()

  const writeToDisk = () => {
    const tmp = dbPath + '.tmp'
    writeFileSync(tmp, Buffer.from(sqldb.export()))
    renameSync(tmp, dbPath)
  }

  const db = buildDatabase(sqldb, writeToDisk)
  writeToDisk()
  return db
}

/**
 * Wrap a sql.js handle in the adapter, enable foreign keys, migrate and seed it.
 * This is the Electron-free seam: tests build an in-memory database with a no-op
 * `writeToDisk`, production wires it to the per-user pos.db file (see initDatabase).
 */
export function buildDatabase(sqldb, writeToDisk = () => {}) {
  const db = makeAdapter(sqldb, writeToDisk)
  db.pragma('foreign_keys = ON')
  migrate(db)
  seedIfEmpty(db)
  return db
}

// Locate the sql.js WebAssembly binary in node_modules.
export function resolveWasm() {
  const candidates = []
  try {
    candidates.push(require.resolve('sql.js/dist/sql-wasm.wasm'))
  } catch {
    // require.resolve unavailable; fall back to cwd lookup
  }
  candidates.push(join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'))
  const found = candidates.find((c) => c && existsSync(c))
  if (!found) throw new Error('Could not locate sql-wasm.wasm')
  return found
}

// How long to coalesce writes before exporting the database to disk. Each export
// serializes the whole database, so bursts of writes (one checkout = several
// statements) are flushed once instead of per-statement.
const FLUSH_DELAY_MS = 500

// Adapter exposing a better-sqlite3-like synchronous API over sql.js.
function makeAdapter(sqldb, writeToDisk) {
  let txDepth = 0
  let detached = false
  let flushTimer = null
  const flush = () => {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    if (!detached) writeToDisk()
  }
  const persist = () => {
    if (detached || txDepth > 0 || flushTimer) return
    flushTimer = setTimeout(() => {
      flushTimer = null
      if (!detached) writeToDisk()
    }, FLUSH_DELAY_MS)
  }
  const lastInsertRowid = () => {
    const r = sqldb.exec('SELECT last_insert_rowid() AS id')
    return r.length ? r[0].values[0][0] : 0
  }

  const prepare = (sql) => ({
    get(...params) {
      const stmt = sqldb.prepare(sql)
      try {
        stmt.bind(params)
        return stmt.step() ? stmt.getAsObject() : undefined
      } finally {
        stmt.free()
      }
    },
    all(...params) {
      const stmt = sqldb.prepare(sql)
      const rows = []
      try {
        stmt.bind(params)
        while (stmt.step()) rows.push(stmt.getAsObject())
      } finally {
        stmt.free()
      }
      return rows
    },
    run(...params) {
      const stmt = sqldb.prepare(sql)
      try {
        stmt.bind(params)
        stmt.step()
      } finally {
        stmt.free()
      }
      const info = { lastInsertRowid: lastInsertRowid(), changes: sqldb.getRowsModified() }
      persist()
      return info
    }
  })

  return {
    prepare,
    exec(sql) {
      sqldb.exec(sql)
      persist()
    },
    pragma(p) {
      sqldb.exec('PRAGMA ' + p)
    },
    transaction(fn) {
      return (...args) => {
        txDepth++
        sqldb.exec('BEGIN')
        try {
          const result = fn(...args)
          sqldb.exec('COMMIT')
          txDepth--
          persist()
          return result
        } catch (e) {
          sqldb.exec('ROLLBACK')
          txDepth--
          throw e
        }
      }
    },
    // Force any pending debounced write to disk now. Used before file-level
    // operations on pos.db (e.g. backup export copies the on-disk file).
    flush,
    // Stop persisting to disk. Used right before an import replaces the database
    // file, so this outgoing in-memory copy can't overwrite the imported one on quit.
    detach() {
      detached = true
      if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
      }
    },
    close() {
      flush()
      sqldb.close()
    }
  }
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE,
      name       TEXT,
      pin_hash   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'user',
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      method     TEXT NOT NULL DEFAULT 'cash',
      amount     INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      color      TEXT DEFAULT '#64748b',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      price       INTEGER NOT NULL DEFAULT 0,
      color       TEXT,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tables (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      label      TEXT NOT NULL,
      seats      INTEGER DEFAULT 4,
      status     TEXT NOT NULL DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id      INTEGER REFERENCES tables(id) ON DELETE SET NULL,
      table_label   TEXT,
      status        TEXT NOT NULL DEFAULT 'open',
      total         INTEGER NOT NULL DEFAULT 0,
      cash_received INTEGER,
      change_due    INTEGER,
      created_at    TEXT DEFAULT (datetime('now')),
      paid_at       TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      name       TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      qty        INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS modifier_groups (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      required   INTEGER NOT NULL DEFAULT 0,
      multi      INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS modifier_options (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id    INTEGER NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      price_delta INTEGER NOT NULL DEFAULT 0,
      sort_order  INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_products_cat   ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_paid    ON orders(paid_at);
    CREATE INDEX IF NOT EXISTS idx_items_order     ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_order  ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_modgroups_prod  ON modifier_groups(product_id);
    CREATE INDEX IF NOT EXISTS idx_modoptions_grp  ON modifier_options(group_id);
  `)

  // Additive column migrations for databases created before these existed.
  addColumnIfMissing(db, 'orders', 'subtotal', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'orders', 'discount', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'orders', 'user_id', 'INTEGER')
  addColumnIfMissing(db, 'orders', 'user_name', 'TEXT')
  addColumnIfMissing(db, 'orders', 'deleted_at', 'TEXT')
  addColumnIfMissing(db, 'orders', 'deleted_by', 'TEXT')
  addColumnIfMissing(db, 'products', 'stock', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'products', 'barcode', 'TEXT')
  addColumnIfMissing(db, 'products', 'image', 'TEXT') // small resized data URL, or null
  addColumnIfMissing(db, 'order_items', 'modifiers', 'TEXT')
  // Per-payment change returned, set only by a by-item split (completeSplit). Null
  // on the normal flow, where change is tracked once at the order level instead.
  addColumnIfMissing(db, 'payments', 'change', 'INTEGER')

  seedSettings(db)
  reserveOpenOrderStockOnce(db)
  // No default user is seeded — the first admin is created in the app's
  // first-run setup screen (see auth:setup in ipc.js).
}

// Stock is now reserved when an item is added to an open order (not at checkout).
// Databases created before this change have open orders whose items were never
// drawn from stock — deduct them once so on-hand counts match the new model.
function reserveOpenOrderStockOnce(db) {
  if (db.prepare("SELECT 1 FROM settings WHERE key = 'mig_reserve_open_stock'").get()) return
  const items = db
    .prepare(
      `SELECT oi.product_id AS pid, oi.qty AS qty
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status = 'open' AND oi.product_id IS NOT NULL`
    )
    .all()
  const dec = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
  const run = db.transaction(() => {
    for (const it of items) dec.run(it.qty, it.pid)
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('mig_reserve_open_stock', '1')").run()
  })
  run()
}

function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

function seedSettings(db) {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) insert.run(key, value)
}

function seedIfEmpty(db) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n
  if (count > 0) return

  const insertCat = db.prepare('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)')
  const insertProd = db.prepare('INSERT INTO products (category_id, name, price, color) VALUES (?, ?, ?, ?)')
  const insertTable = db.prepare('INSERT INTO tables (label, seats) VALUES (?, ?)')

  const seed = db.transaction(() => {
    const drinks = insertCat.run('Drinks', '#3b82f6', 1).lastInsertRowid
    const coffee = insertCat.run('Coffee', '#a16207', 2).lastInsertRowid
    const food = insertCat.run('Food', '#ef4444', 3).lastInsertRowid
    const desserts = insertCat.run('Desserts', '#ec4899', 4).lastInsertRowid

    insertProd.run(drinks, 'Water 0.5L', 800, null)
    insertProd.run(drinks, 'Soda', 2500, null)
    insertProd.run(drinks, 'Fresh Orange Juice', 4500, null)
    insertProd.run(coffee, 'Espresso', 1800, null)
    insertProd.run(coffee, 'Cappuccino', 2800, null)
    insertProd.run(coffee, 'Tea', 1500, null)
    insertProd.run(food, 'Chicken Sandwich', 7500, null)
    insertProd.run(food, 'Tuna Salad', 9000, null)
    insertProd.run(food, 'Margherita Pizza', 14000, null)
    insertProd.run(desserts, 'Tiramisu', 5500, null)
    insertProd.run(desserts, 'Ice Cream', 3500, null)

    // start demo products with some stock on hand
    db.prepare('UPDATE products SET stock = 40').run()

    for (let i = 1; i <= 8; i++) insertTable.run(String(i), 4)
  })
  seed()
}
