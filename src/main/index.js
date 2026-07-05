import { app, Menu, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { initDatabase } from './db'
import { registerIpc } from './ipc'
import { createMainWindow, getMainWindow, setMainFullscreen, syncCustomerDisplay, initDisplayWatch, listDisplays, pushCustomerState } from './windows'
import { initAutoUpdate } from './updater'
import { parseSettings } from '../shared/settings'

let db

// Set once a background update has finished downloading (and stays set). The renderer
// both subscribes to the live 'update:ready' push AND queries this on mount, so the
// notice still appears when the download completed before the UI was listening — e.g. an
// update staged in a previous session that fires early on the next launch.
let pendingUpdate = null

// Dev runs against the Vite server; production loads built files from disk.
const isDev = !!process.env.ELECTRON_RENDERER_URL

// Read the raw settings row (key/value map) straight from the db.
const settingsRow = () => Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]))

// Upsert a single setting key.
const putSetting = (key, value) =>
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value))

// Persist the fullscreen choice so the window opens the same way next launch.
const persistFullscreen = (on) => putSetting('fullscreen', on ? '1' : '0')

// What the customer display shows when idle (and the language/RTL it uses).
const customerBranding = () => {
  const row = settingsRow()
  const s = parseSettings(row)
  return { shopName: row.shop_name, logo: row.logo, language: s.language, currency: s.currency, theme: s.theme }
}

app.whenReady().then(async () => {
  // Remove the default application menu in production (strips the reload / DevTools
  // accelerators); dev keeps it for convenience.
  if (!isDev) Menu.setApplicationMenu(null)
  db = await initDatabase()
  registerIpc(db)

  createMainWindow({ isDev, fullscreen: parseSettings(settingsRow()).fullscreen, onFullscreenChange: persistFullscreen })

  // Bring up the customer display (if enabled) and keep it in step with the monitors.
  const cfg = parseSettings(settingsRow())
  initDisplayWatch()
  syncCustomerDisplay({ enabled: cfg.customerDisplay, monitorId: cfg.customerDisplayMonitor, branding: customerBranding() })

  // Window controls from the renderer (Settings → Display). These just drive the
  // windows and persist; they carry no data, so they sit outside the IPC auth gate.
  ipcMain.handle('window:setFullscreen', (_e, { on }) => setMainFullscreen(!!on))
  ipcMain.handle('displays:list', () => listDisplays())
  ipcMain.handle('customer:enable', (_e, { on, monitorId }) => {
    putSetting('customer_display', on ? '1' : '0')
    if (monitorId != null) putSetting('customer_display_monitor', monitorId)
    syncCustomerDisplay({ enabled: !!on, monitorId: monitorId ?? settingsRow().customer_display_monitor, branding: customerBranding() })
  })

  // The cashier pushes presentation snapshots; relay them to the customer window.
  ipcMain.handle('customer:present', (_e, { snapshot }) => pushCustomerState(snapshot))

  // Lets the renderer ask, on mount, whether an update is already downloaded — so it
  // catches a download that finished before the UI subscribed to the push below.
  ipcMain.handle('update:pending', () => pendingUpdate)

  // Background auto-update (packaged builds only — dev has no update feed). Fire-and-
  // forget: it never blocks startup, and a failure is silent. When a build finishes
  // downloading we record it (for the query above) and nudge the renderer to show a
  // small "installs when you quit" notice; the install happens on quit
  // (autoInstallOnAppQuit), never a forced restart.
  if (!isDev) {
    initAutoUpdate(autoUpdater, {
      onReady: (info) => {
        pendingUpdate = { version: info?.version || null }
        const win = getMainWindow()
        if (win && !win.isDestroyed()) win.webContents.send('update:ready', pendingUpdate)
      }
    })
  }
})

// Single-window kiosk app: closing the window exits everywhere (including macOS —
// re-opening a window via `activate` would run against the already-closed database).
app.on('window-all-closed', () => {
  if (db) db.close()
  app.quit()
})
