// Thin, readable wrapper over the preload bridge (window.pos).
const call = (channel, payload) => window.pos[channel](payload)

export const api = {
  license: {
    status: () => call('license:status'),
    activate: (license) => call('license:activate', { license }),
    activateByCode: (code) => call('license:activateByCode', { code }),
    rebindByCode: (code) => call('license:rebindByCode', { code }),
    renew: () => call('license:renew')
  },
  auth: {
    needsSetup: () => call('auth:needsSetup'),
    setup: (data) => call('auth:setup', data),
    login: (username, pin) => call('auth:login', { username, pin }),
    logout: () => call('auth:logout'),
    current: () => call('auth:current'),
    users: () => call('auth:users')
  },
  users: {
    list: () => call('users:list'),
    create: (data) => call('users:create', data),
    update: (data) => call('users:update', data),
    remove: (id) => call('users:remove', { id })
  },
  settings: {
    get: () => call('settings:get'),
    set: (patch) => call('settings:set', { patch })
  },
  printers: {
    list: () => call('printers:list')
  },
  categories: {
    list: () => call('categories:list'),
    create: (data) => call('categories:create', data),
    update: (data) => call('categories:update', data),
    remove: (id) => call('categories:remove', { id })
  },
  products: {
    list: () => call('products:list'),
    byCategory: (categoryId) => call('products:byCategory', { categoryId }),
    byBarcode: (barcode) => call('products:byBarcode', { barcode }),
    create: (data) => call('products:create', data),
    update: (data) => call('products:update', data),
    remove: (id) => call('products:remove', { id }),
    stock: () => call('products:stock'),
    modifiers: (productId) => call('products:modifiers', { productId })
  },
  modifiers: {
    createGroup: (data) => call('modgroups:create', data),
    removeGroup: (id) => call('modgroups:remove', { id }),
    createOption: (data) => call('modoptions:create', data),
    removeOption: (id) => call('modoptions:remove', { id })
  },
  tables: {
    list: () => call('tables:list'),
    create: (data) => call('tables:create', data),
    update: (data) => call('tables:update', data),
    remove: (id) => call('tables:remove', { id })
  },
  orders: {
    openForTable: (tableId) => call('orders:openForTable', { tableId }),
    get: (orderId) => call('orders:get', { orderId }),
    addItem: (orderId, productId) => call('orders:addItem', { orderId, productId }),
    addItemWithMods: (orderId, productId, optionIds) => call('orders:addItemWithMods', { orderId, productId, optionIds }),
    setItemQty: (itemId, qty) => call('orders:setItemQty', { itemId, qty }),
    removeItem: (itemId) => call('orders:removeItem', { itemId }),
    setDiscount: (orderId, type, value) => call('orders:setDiscount', { orderId, type, value }),
    void: (orderId) => call('orders:void', { orderId }),
    addPayment: (orderId, method, amount) => call('orders:addPayment', { orderId, method, amount }),
    removePayment: (paymentId) => call('orders:removePayment', { paymentId }),
    complete: (orderId) => call('orders:complete', { orderId }),
    completeSplit: (orderId, groups) => call('orders:completeSplit', { orderId, groups }),
    history: (date) => call('orders:history', { date }),
    cancelPaid: (orderId) => call('orders:cancelPaid', { orderId }),
    updatePaid: (orderId, items, discountType, discountValue) =>
      call('orders:updatePaid', { orderId, items, discountType, discountValue })
  },
  receipt: {
    print: (orderId) => call('receipt:print', { orderId })
  },
  window: {
    setFullscreen: (on) => call('window:setFullscreen', { on })
  },
  displays: {
    list: () => call('displays:list')
  },
  customer: {
    enable: (on, monitorId) => call('customer:enable', { on, monitorId }),
    present: (snapshot) => call('customer:present', { snapshot })
  },
  analytics: {
    overview: () => call('analytics:overview'),
    series: (period) => call('analytics:series', { period }),
    topProducts: (period) => call('analytics:topProducts', { period }),
    byServer: (period) => call('analytics:byServer', { period }),
    recentOrders: () => call('analytics:recentOrders'),
    exportPdf: (params) => call('analytics:exportPdf', params)
  },
  db: {
    export: () => call('db:export'),
    import: () => call('db:import')
  }
}
