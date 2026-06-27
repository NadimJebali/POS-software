import { contextBridge, ipcRenderer } from 'electron'

// Preload for the customer-facing window. Deliberately minimal: it exposes ONLY a
// subscribe to presentation snapshots — no order/auth/db channels — so the
// customer screen can never operate the till.
contextBridge.exposeInMainWorld('posCustomer', {
  onState: (cb) => {
    const handler = (_e, state) => cb(state)
    ipcRenderer.on('customer:state', handler)
    return () => ipcRenderer.removeListener('customer:state', handler)
  }
})
