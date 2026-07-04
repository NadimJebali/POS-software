// Policy tests for the auto-update wiring. The electron-updater instance is injected
// (a tiny fake emitter here), so this exercises the real event→notice mapping and the
// "failures are silent" guarantees with no Electron or network involved.
import { describe, test, expect, vi } from 'vitest'
import { initAutoUpdate } from '../src/main/updater'

function fakeUpdater({ checkResult } = {}) {
  const handlers = {}
  return {
    autoDownload: null,
    autoInstallOnAppQuit: null,
    on(event, fn) {
      handlers[event] = fn
      return this
    },
    emit(event, ...args) {
      handlers[event]?.(...args)
    },
    checkForUpdates: vi.fn(() => checkResult ?? Promise.resolve())
  }
}

describe('initAutoUpdate', () => {
  test('downloads in the background, installs on quit, and kicks off a check', () => {
    const updater = fakeUpdater()

    initAutoUpdate(updater, { onReady: vi.fn() })

    expect(updater.autoDownload).toBe(true)
    expect(updater.autoInstallOnAppQuit).toBe(true)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  test('the ready notice fires only after a completed download', () => {
    const updater = fakeUpdater()
    const onReady = vi.fn()

    initAutoUpdate(updater, { onReady })
    expect(onReady).not.toHaveBeenCalled() // nothing downloaded yet

    updater.emit('update-downloaded', { version: '1.2.3' })
    expect(onReady).toHaveBeenCalledWith({ version: '1.2.3' })
  })

  test('an updater error is silent: no notice, no throw', () => {
    const updater = fakeUpdater()
    const onReady = vi.fn()
    const log = { warn: vi.fn() }

    initAutoUpdate(updater, { onReady, log })

    expect(() => updater.emit('error', new Error('ENOTFOUND updates feed'))).not.toThrow()
    expect(onReady).not.toHaveBeenCalled()
  })

  test('a rejected update check is swallowed (unreachable feed is harmless)', async () => {
    const updater = fakeUpdater({ checkResult: Promise.reject(new Error('502 Bad Gateway')) })

    expect(() => initAutoUpdate(updater, { onReady: vi.fn() })).not.toThrow()
    // Let the rejected promise settle; an unhandled rejection here would fail the run.
    await Promise.resolve()
  })
})
