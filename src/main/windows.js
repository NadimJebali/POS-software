import { BrowserWindow } from 'electron'
import { join } from 'path'

// Window management for the app. Today: the cashier (main) window, its DevTools
// lockdown, and the fullscreen toggle. The customer-facing display will live here
// too, so the entry point (index.js) stays thin.

let mainWin = null
let persistFullscreen = () => {}

/**
 * Create the cashier window. `fullscreen` sets the initial state (persisted across
 * launches); `onFullscreenChange` is called whenever F11 or the Settings toggle
 * flips it, so the caller can persist the new state.
 */
export function createMainWindow({ isDev, fullscreen = false, onFullscreenChange = () => {} }) {
  persistFullscreen = onFullscreenChange

  const win = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    fullscreen,
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
  mainWin = win

  win.webContents.on('before-input-event', (event, input) => {
    const key = (input.key || '').toLowerCase()
    // F11 toggles fullscreen in any build, and stays escapable (so does Esc).
    if (key === 'f11') {
      event.preventDefault()
      setMainFullscreen(!win.isFullScreen())
      return
    }
    // Defence in depth: block the DevTools shortcuts on a shipped build.
    if (!isDev) {
      const ctrlShift = input.control && input.shift
      if (key === 'f12' || (ctrlShift && (key === 'i' || key === 'j' || key === 'c'))) {
        event.preventDefault()
      }
    }
  })

  if (!isDev) win.webContents.on('devtools-opened', () => win.webContents.closeDevTools())

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

// Set the cashier window's fullscreen state and persist the choice. Used by F11
// and the Settings → Display toggle (via the window:setFullscreen IPC channel).
export function setMainFullscreen(on) {
  if (!mainWin || mainWin.isDestroyed()) return
  mainWin.setFullScreen(!!on)
  persistFullscreen(!!on)
}

export function getMainWindow() {
  return mainWin
}
