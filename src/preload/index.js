import { contextBridge, ipcRenderer } from 'electron'

// Whitelisted channels the renderer is allowed to invoke.
const CHANNELS = [
  'auth:needsSetup', 'auth:setup', 'auth:login', 'auth:logout', 'auth:current', 'auth:users',
  'users:list', 'users:create', 'users:update', 'users:remove',
  'settings:get', 'settings:set', 'printers:list',
  'categories:list', 'categories:create', 'categories:update', 'categories:remove',
  'products:list', 'products:byCategory', 'products:byBarcode', 'products:create', 'products:update', 'products:remove',
  'products:modifiers', 'modgroups:create', 'modgroups:remove', 'modoptions:create', 'modoptions:remove',
  'tables:list', 'tables:create', 'tables:update', 'tables:remove',
  'orders:openForTable', 'orders:get', 'orders:addItem', 'orders:addItemWithMods', 'orders:setItemQty',
  'orders:removeItem', 'orders:setDiscount', 'orders:void',
  'orders:addPayment', 'orders:removePayment', 'orders:complete', 'orders:history',
  'orders:cancelPaid', 'orders:updatePaid',
  'receipt:print',
  'analytics:overview', 'analytics:series', 'analytics:topProducts', 'analytics:byServer', 'analytics:recentOrders'
]

const api = {}
for (const channel of CHANNELS) {
  // window.pos['categories:list'](payload) -> invoke
  api[channel] = (payload) => ipcRenderer.invoke(channel, payload)
}

contextBridge.exposeInMainWorld('pos', api)
