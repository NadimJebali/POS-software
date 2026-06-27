import { app, Menu, ipcMain } from 'electron'
import { initDatabase } from './db'
import { registerIpc } from './ipc'
import { createMainWindow, setMainFullscreen } from './windows'
import { parseSettings } from '../shared/settings'

let db

// Dev runs against the Vite server; production loads built files from disk.
const isDev = !!process.env.ELECTRON_RENDERER_URL

// Read the raw settings row (key/value map) straight from the db.
const settingsRow = () => Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]))

// Persist the fullscreen choice so the window opens the same way next launch.
const persistFullscreen = (on) =>
  db
    .prepare("INSERT INTO settings (key, value) VALUES ('fullscreen', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(on ? '1' : '0')

app.whenReady().then(async () => {
  // Remove the default application menu in production (strips the reload / DevTools
  // accelerators); dev keeps it for convenience.
  if (!isDev) Menu.setApplicationMenu(null)
  db = await initDatabase()
  registerIpc(db)

  createMainWindow({ isDev, fullscreen: parseSettings(settingsRow()).fullscreen, onFullscreenChange: persistFullscreen })

  // Window control from the renderer (Settings → Display toggle). Just flips the
  // main window and persists; carries no data, so it sits outside the IPC auth gate.
  ipcMain.handle('window:setFullscreen', (_e, { on }) => setMainFullscreen(!!on))
})

// Single-window kiosk app: closing the window exits everywhere (including macOS —
// re-opening a window via `activate` would run against the already-closed database).
app.on('window-all-closed', () => {
  if (db) db.close()
  app.quit()
})
