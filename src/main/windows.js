import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

// Window management for the app: the cashier (main) window with its DevTools
// lockdown and fullscreen toggle, plus the customer-facing display on a second
// monitor. Keeping it here lets the entry point (index.js) stay thin.

let mainWin = null
let persistFullscreen = () => {}

let customerWin = null
let customerCfg = { enabled: false, monitorId: '', branding: {}, snapshot: null }

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
    backgroundColor: '#15100D',
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

// ---------------- Customer-facing display ----------------

// The monitor to host the customer display: the chosen one if still present, else
// the first non-primary monitor. Returns null on a single-monitor setup (no-op).
function pickDisplay(monitorId) {
  const displays = screen.getAllDisplays()
  if (displays.length < 2) return null
  const primary = screen.getPrimaryDisplay()
  if (monitorId) {
    const chosen = displays.find((d) => String(d.id) === String(monitorId))
    if (chosen) return chosen
  }
  return displays.find((d) => d.id !== primary.id) || null
}

// Push a presentation snapshot to the customer window (used here for the initial
// idle branding, and by the cashier's live updates). Remembered so a freshly
// (re)opened window can render the current state immediately.
export function pushCustomerState(state) {
  customerCfg.snapshot = state
  if (customerWin && !customerWin.isDestroyed()) customerWin.webContents.send('customer:state', state)
}

function openCustomerWindow(display) {
  customerWin = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    backgroundColor: '#15100D',
    autoHideMenuBar: true,
    skipTaskbar: true,
    webPreferences: {
      // A separate, subscribe-only preload: the customer screen cannot invoke any
      // order/auth/db channel — it can only receive state.
      preload: join(__dirname, '../preload/customer.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false
    }
  })
  customerWin.setBounds(display.bounds) // cover the whole monitor
  customerWin.on('closed', () => {
    customerWin = null
  })

  if (process.env.ELECTRON_RENDERER_URL) customerWin.loadURL(process.env.ELECTRON_RENDERER_URL)
  else customerWin.loadFile(join(__dirname, '../renderer/index.html'))

  customerWin.webContents.on('did-finish-load', () =>
    pushCustomerState(customerCfg.snapshot || { phase: 'idle', ...customerCfg.branding })
  )
}

function closeCustomerWindow() {
  if (customerWin && !customerWin.isDestroyed()) customerWin.close()
  customerWin = null
}

/**
 * Reconcile the customer window with the current config + available monitors.
 * Opens it on the target monitor when enabled, closes it when disabled or the
 * target is gone, and re-places it if the monitor moved. Safe to call repeatedly.
 */
export function syncCustomerDisplay(cfg) {
  if (cfg) customerCfg = { ...customerCfg, ...cfg }
  const display = customerCfg.enabled ? pickDisplay(customerCfg.monitorId) : null
  if (display && !customerWin) openCustomerWindow(display)
  else if (display && customerWin && !customerWin.isDestroyed()) customerWin.setBounds(display.bounds)
  else if (!display && customerWin) closeCustomerWindow()
}

// React to monitors being plugged/unplugged: close if the target vanished, reopen
// when it returns (while still enabled).
export function initDisplayWatch() {
  screen.on('display-removed', () => syncCustomerDisplay())
  screen.on('display-added', () => syncCustomerDisplay())
}

// Monitors for the Settings picker.
export function listDisplays() {
  const primary = screen.getPrimaryDisplay()
  return screen.getAllDisplays().map((d) => ({
    id: String(d.id),
    label: `${d.size.width}×${d.size.height}`,
    primary: d.id === primary.id
  }))
}
