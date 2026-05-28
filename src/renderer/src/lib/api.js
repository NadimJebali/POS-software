// Thin, readable wrapper over the preload bridge (window.pos).
const call = (channel, payload) => window.pos[channel](payload)

export const api = {
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
    create: (data) => call('products:create', data),
    update: (data) => call('products:update', data),
    remove: (id) => call('products:remove', { id })
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
    setItemQty: (itemId, qty) => call('orders:setItemQty', { itemId, qty }),
    removeItem: (itemId) => call('orders:removeItem', { itemId }),
    setDiscount: (orderId, type, value) => call('orders:setDiscount', { orderId, type, value }),
    void: (orderId) => call('orders:void', { orderId }),
    addPayment: (orderId, method, amount) => call('orders:addPayment', { orderId, method, amount }),
    removePayment: (paymentId) => call('orders:removePayment', { paymentId }),
    complete: (orderId) => call('orders:complete', { orderId }),
    history: (date) => call('orders:history', { date })
  },
  receipt: {
    print: (orderId) => call('receipt:print', { orderId })
  },
  analytics: {
    overview: () => call('analytics:overview'),
    series: (period) => call('analytics:series', { period }),
    topProducts: (period) => call('analytics:topProducts', { period }),
    recentOrders: () => call('analytics:recentOrders')
  }
}
