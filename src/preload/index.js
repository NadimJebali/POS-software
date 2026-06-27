import { contextBridge, ipcRenderer } from 'electron'

// Whitelisted channels the renderer is allowed to invoke.
const CHANNELS = [
  'license:status', 'license:activate',
  'auth:needsSetup', 'auth:setup', 'auth:login', 'auth:logout', 'auth:current', 'auth:users',
  'users:list', 'users:create', 'users:update', 'users:remove',
  'settings:get', 'settings:set', 'printers:list',
  'categories:list', 'categories:create', 'categories:update', 'categories:remove',
  'products:list', 'products:byCategory', 'products:byBarcode', 'products:create', 'products:update', 'products:remove', 'products:stock',
  'products:modifiers', 'modgroups:create', 'modgroups:remove', 'modoptions:create', 'modoptions:remove',
  'tables:list', 'tables:create', 'tables:update', 'tables:remove',
  'orders:openForTable', 'orders:get', 'orders:addItem', 'orders:addItemWithMods', 'orders:setItemQty',
  'orders:removeItem', 'orders:setDiscount', 'orders:void',
  'orders:addPayment', 'orders:removePayment', 'orders:complete', 'orders:completeSplit', 'orders:history',
  'orders:cancelPaid', 'orders:updatePaid',
  'receipt:print',
  'window:setFullscreen',
  'analytics:overview', 'analytics:series', 'analytics:topProducts', 'analytics:byServer', 'analytics:recentOrders', 'analytics:exportPdf',
  'db:export', 'db:import'
]

// Electron wraps any error thrown by an ipcMain handler as
//   "Error invoking remote method '<channel>': Error: <real message>"
// Strip that scaffolding so the UI shows only the message we actually threw.
function cleanMessage(err) {
  let msg = (err && err.message) || String(err)
  msg = msg.replace(/^Error invoking remote method '[^']*':\s*/, '')
  msg = msg.replace(/^(?:[A-Za-z]+Error|Error):\s*/, '')
  return msg.trim() || 'Something went wrong'
}

const api = {}
for (const channel of CHANNELS) {
  // window.pos['categories:list'](payload) -> invoke
  api[channel] = async (payload) => {
    try {
      return await ipcRenderer.invoke(channel, payload)
    } catch (err) {
      throw new Error(cleanMessage(err))
    }
  }
}

contextBridge.exposeInMainWorld('pos', api)
