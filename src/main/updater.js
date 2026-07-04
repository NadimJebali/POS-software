// Background auto-update policy, kept free of electron-updater/Electron imports so it's
// unit-testable: the caller (index.js) injects the real `autoUpdater`. Rules from the
// PRD: download in the background, install on quit (never a forced restart), show a
// notice only once an update is fully downloaded, and stay completely silent on any
// failure (offline, unreachable feed, bad metadata). Updates are not gated on license.
export function initAutoUpdate(updater, { onReady, log = console } = {}) {
  updater.autoDownload = true
  updater.autoInstallOnAppQuit = true

  // A finished download is the only thing the user ever hears about.
  updater.on('update-downloaded', (info) => {
    try {
      onReady?.(info)
    } catch {
      // A UI hiccup must never bubble out of the updater.
    }
  })

  // Any error is logged for the vendor and swallowed — never surfaced to the café.
  updater.on('error', (err) => {
    try {
      log?.warn?.('[updater] update check failed:', err?.message || err)
    } catch {
      // ignore
    }
  })

  // Fire-and-forget check. Guard both a synchronous throw and a rejected promise so a
  // missing/unreachable feed can't crash or block startup.
  try {
    Promise.resolve(updater.checkForUpdates()).catch(() => {})
  } catch {
    // ignore
  }

  return updater
}
