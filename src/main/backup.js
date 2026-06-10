import { app, dialog, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, copyFileSync, readFileSync } from 'fs'
import initSqlJs from 'sql.js'
import { resolveWasm } from './db'

// Tables a file must contain to be accepted as a POS database on import.
const REQUIRED_TABLES = ['settings', 'users', 'products', 'categories', 'orders', 'order_items', 'payments', 'tables']

const dbPath = () => join(app.getPath('userData'), 'pos.db')
const mainWindow = () => BrowserWindow.getAllWindows()[0] || null

// sql.js is initialised lazily and only for validating an import candidate.
let sqlPromise
const getSQL = () => (sqlPromise ||= initSqlJs({ wasmBinary: readFileSync(resolveWasm()) }))

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')

// Save a copy of the live database to a location the user chooses. Disk writes
// are debounced, so flush the running adapter first to make pos.db current.
export async function exportDatabase(db) {
  const opts = {
    title: 'Export database backup',
    defaultPath: `pos-backup-${stamp()}.db`,
    filters: [{ name: 'POS database', extensions: ['db'] }]
  }
  const win = mainWindow()
  const { canceled, filePath } = await (win ? dialog.showSaveDialog(win, opts) : dialog.showSaveDialog(opts))
  if (canceled || !filePath) return { ok: false, canceled: true }
  if (db) db.flush()
  copyFileSync(dbPath(), filePath)
  return { ok: true, path: filePath }
}

// Replace the live database with a chosen backup, then relaunch so it loads cleanly.
// `db` is the running adapter — we detach it first so the outgoing in-memory copy
// can't overwrite the freshly imported file when the app quits.
export async function importDatabase(db) {
  const opts = {
    title: 'Import database backup',
    properties: ['openFile'],
    filters: [{ name: 'POS database', extensions: ['db', 'sqlite', 'sqlite3'] }]
  }
  const win = mainWindow()
  const { canceled, filePaths } = await (win ? dialog.showOpenDialog(win, opts) : dialog.showOpenDialog(opts))
  if (canceled || !filePaths || !filePaths.length) return { ok: false, canceled: true }

  const source = filePaths[0]
  await validate(readFileSync(source))

  const target = dbPath()
  if (db) db.flush() // make the on-disk copy current before snapshotting it
  if (existsSync(target)) copyFileSync(target, `${target}.pre-import-${stamp()}.bak`) // safety net
  if (db) db.detach()
  copyFileSync(source, target)

  app.relaunch()
  app.exit(0)
  return { ok: true }
}

async function validate(buffer) {
  // SQLite files begin with the literal header "SQLite format 3\0".
  if (buffer.length < 16 || buffer.toString('utf8', 0, 15) !== 'SQLite format 3') {
    throw new Error('That file is not a SQLite database')
  }
  const SQL = await getSQL()
  let probe
  try {
    probe = new SQL.Database(buffer)
  } catch {
    throw new Error('That file could not be opened as a database')
  }
  try {
    const res = probe.exec("SELECT name FROM sqlite_master WHERE type = 'table'")
    const names = res.length ? res[0].values.map((row) => row[0]) : []
    const missing = REQUIRED_TABLES.filter((t) => !names.includes(t))
    if (missing.length) throw new Error(`This file is not a POS backup (missing: ${missing.join(', ')})`)
  } finally {
    probe.close()
  }
}
