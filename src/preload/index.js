import { contextBridge, ipcRenderer } from 'electron'

// Whitelisted channels the renderer is allowed to invoke.
const CHANNELS = [
  'settings:get', 'settings:set', 'printers:list',
  'categories:list', 'categories:create', 'categories:update', 'categories:remove',
  'products:list', 'products:byCategory', 'products:create', 'products:update', 'products:remove',
  'tables:list', 'tables:create', 'tables:update', 'tables:remove',
  'orders:openForTable', 'orders:get', 'orders:addItem', 'orders:setItemQty',
  'orders:removeItem', 'orders:setDiscount', 'orders:void',
  'orders:addPayment', 'orders:removePayment', 'orders:complete', 'orders:history',
  'receipt:print',
  'analytics:overview', 'analytics:series', 'analytics:topProducts', 'analytics:recentOrders'
]

const api = {}
for (const channel of CHANNELS) {
  // window.pos['categories:list'](payload) -> invoke
  api[channel] = (payload) => ipcRenderer.invoke(channel, payload)
}

contextBridge.exposeInMainWorld('pos', api)
