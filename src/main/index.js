import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { initDatabase } from './db'
import { registerIpc } from './ipc'

let db

// Dev runs against the Vite server; production loads built files from disk.
const isDev = !!process.env.ELECTRON_RENDERER_URL

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // No DevTools in production — it would let anyone at the terminal open the
      // console and call IPC directly, bypassing the login screen.
      devTools: isDev
    }
  })

  // Defence in depth: block the DevTools shortcuts and force it shut if anything
  // still manages to open it on a shipped build.
  if (!isDev) {
    win.webContents.on('before-input-event', (event, input) => {
      const key = (input.key || '').toLowerCase()
      const ctrlShift = input.control && input.shift
      if (key === 'f12' || (ctrlShift && (key === 'i' || key === 'j' || key === 'c'))) {
        event.preventDefault()
      }
    })
    win.webContents.on('devtools-opened', () => win.webContents.closeDevTools())
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // Remove the default application menu in production (strips the reload / DevTools
  // accelerators); dev keeps it for convenience.
  if (!isDev) Menu.setApplicationMenu(null)
  db = await initDatabase()
  registerIpc(db)
  createWindow()
})

// Single-window kiosk app: closing the window exits everywhere (including macOS —
// re-opening a window via `activate` would run against the already-closed database).
app.on('window-all-closed', () => {
  if (db) db.close()
  app.quit()
})
