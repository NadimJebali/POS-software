/**
 * The Order domain: the full lifecycle of an order behind one interface.
 *
 * Constructed with `db` (the sql.js adapter). The session is NOT owned here —
 * callers that need attribution pass `user` / `by` per call, so the IPC layer
 * stays the trust boundary and this module stays testable without it.
 *
 * Money is integer millimes throughout; this module never formats it.
 */
export function createOrders(db) {
  // Run a unit of work atomically (BEGIN/COMMIT, ROLLBACK on throw).
  const inTx = (fn) => db.transaction(fn)()

  // Recompute subtotal from items, then total = subtotal - discount (never below 0).
  const recalcOrder = (orderId) => {
    const { subtotal } = db
      .prepare('SELECT COALESCE(SUM(unit_price * qty), 0) AS subtotal FROM order_items WHERE order_id = ?')
      .get(orderId)
    const order = db.prepare('SELECT discount FROM orders WHERE id = ?').get(orderId)
    const discount = Math.min(order ? order.discount : 0, subtotal)
    const total = subtotal - discount
    db.prepare('UPDATE orders SET subtotal = ?, total = ? WHERE id = ?').run(subtotal, total, orderId)
    return total
  }

  // Put an order's reserved stock back (used when voiding an open order or
  // discarding the open order on a table being removed).
  const restoreOrderStock = (orderId) => {
    const inc = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
    const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(orderId)
    for (const it of items) if (it.product_id) inc.run(it.qty, it.product_id)
  }

  // Read model: an order with its items, payments, and derived paid/remaining.
  const getOrderWithItems = (orderId) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
    if (!order) return null
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(orderId)
    order.payments = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id').all(orderId)
    order.paid = order.payments.reduce((s, p) => s + p.amount, 0)
    order.remaining = Math.max(0, order.total - order.paid)
    return order
  }

  // Return the table's current open order, creating (and occupying the table) if
  // none exists. Attribution comes from the passed-in user.
  const openForTable = ({ tableId, user }) => {
    let order = db
      .prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1")
      .get(tableId)
    if (!order) {
      const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId)
      order = inTx(() => {
        const info = db
          .prepare("INSERT INTO orders (table_id, table_label, status, user_id, user_name) VALUES (?, ?, 'open', ?, ?)")
          .run(tableId, table ? table.label : null, user ? user.id : null, user ? user.name || user.username : null)
        db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(tableId)
        return db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid)
      })
    }
    return getOrderWithItems(order.id)
  }

  // Add one unit of a product to an open order, reserving stock immediately.
  // Merges into the existing line for the same product.
  const addItem = ({ orderId, productId }) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId)
    if (!product) throw new Error('Product not found')
    if (product.stock < 1) throw new Error(`Not enough stock for ${product.name}`)
    const existing = db.prepare('SELECT * FROM order_items WHERE order_id = ? AND product_id = ?').get(orderId, productId)
    inTx(() => {
      if (existing) {
        db.prepare('UPDATE order_items SET qty = qty + 1 WHERE id = ?').run(existing.id)
      } else {
        db.prepare('INSERT INTO order_items (order_id, product_id, name, unit_price, qty) VALUES (?, ?, ?, ?, 1)').run(
          orderId,
          productId,
          product.name,
          product.price
        )
      }
      db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ?').run(productId) // reserve the unit
      recalcOrder(orderId)
    })
    return getOrderWithItems(orderId)
  }

  // Set a discount as a fixed amount (millimes) or a percentage of the subtotal.
  // Clamped to [0, subtotal] so the total can never go negative.
  const setDiscount = ({ orderId, type, value }) => {
    const { subtotal } = db
      .prepare('SELECT COALESCE(SUM(unit_price * qty),0) AS subtotal FROM order_items WHERE order_id = ?')
      .get(orderId)
    const amount = Number(value)
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Discount must be a positive number')
    let discount = type === 'percent' ? Math.round((subtotal * amount) / 100) : Math.round(amount)
    discount = Math.max(0, Math.min(discount, subtotal))
    inTx(() => {
      db.prepare('UPDATE orders SET discount = ? WHERE id = ?').run(discount, orderId)
      recalcOrder(orderId)
    })
    return getOrderWithItems(orderId)
  }

  // Payments may only be attached to / removed from orders that are still open —
  // a stale checkout screen must not alter a settled order's money. `amount` is
  // expected pre-coerced to a positive integer by the caller.
  const addPayment = ({ orderId, method, amount }) => {
    const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(orderId)
    if (!order) throw new Error('Order not found')
    if (order.status !== 'open') throw new Error('This order has already been settled')
    db.prepare('INSERT INTO payments (order_id, method, amount) VALUES (?, ?, ?)').run(orderId, method || 'cash', amount)
    return getOrderWithItems(orderId)
  }

  const removePayment = ({ paymentId }) => {
    const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId)
    if (!p) return null
    const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(p.order_id)
    if (order && order.status !== 'open') throw new Error('This order has already been settled')
    db.prepare('DELETE FROM payments WHERE id = ?').run(paymentId)
    return getOrderWithItems(p.order_id)
  }

  // Finalize: requires payments to cover the total. Change can only be returned
  // from physically tendered cash — a card overpayment earns no change.
  const complete = ({ orderId }) => {
    const order = getOrderWithItems(orderId)
    if (!order) throw new Error('Order not found')
    if (order.status !== 'open') throw new Error('This order has already been settled')
    if (order.paid < order.total) throw new Error('Payments do not cover the total')
    const cash = order.payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
    const change = Math.max(0, Math.min(order.paid - order.total, cash))
    inTx(() => {
      db.prepare(
        "UPDATE orders SET status = 'paid', cash_received = ?, change_due = ?, paid_at = datetime('now') WHERE id = ?"
      ).run(cash, change, orderId)
      // Stock was reserved as items were added; completion just converts it to sold.
      if (order.table_id) db.prepare("UPDATE tables SET status = 'open' WHERE id = ?").run(order.table_id)
    })
    return getOrderWithItems(orderId)
  }

  // Add a product with chosen modifier options. Always a new line (never merged),
  // priced as base + sum of option deltas, with a human-readable modifier label.
  const addItemWithMods = ({ orderId, productId, optionIds }) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId)
    if (!product) throw new Error('Product not found')
    if (product.stock < 1) throw new Error(`Not enough stock for ${product.name}`)
    let delta = 0
    let label = ''
    const ids = (optionIds || []).filter((x) => x != null)
    if (ids.length) {
      const opts = db.prepare(`SELECT * FROM modifier_options WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids)
      delta = opts.reduce((s, o) => s + o.price_delta, 0)
      label = opts.map((o) => o.name).join(', ')
    }
    inTx(() => {
      db.prepare('INSERT INTO order_items (order_id, product_id, name, unit_price, qty, modifiers) VALUES (?, ?, ?, ?, 1, ?)').run(
        orderId,
        productId,
        product.name,
        product.price + delta,
        label || null
      )
      db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ?').run(productId) // reserve the unit
      recalcOrder(orderId)
    })
    return getOrderWithItems(orderId)
  }

  // Set a line's quantity (0 removes it). `qty` is expected pre-coerced to a
  // non-negative integer by the caller. Reserves/returns stock by the delta.
  const setItemQty = ({ itemId, qty }) => {
    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId)
    if (!item) throw new Error('Item not found')
    const newQty = Math.max(0, qty)
    const delta = newQty - item.qty // positive => reserve more units
    if (delta > 0 && item.product_id) {
      const product = db.prepare('SELECT name, stock FROM products WHERE id = ?').get(item.product_id)
      if (!product || product.stock < delta) throw new Error(`Not enough stock${product ? ' for ' + product.name : ''}`)
    }
    inTx(() => {
      if (newQty <= 0) db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId)
      else db.prepare('UPDATE order_items SET qty = ? WHERE id = ?').run(newQty, itemId)
      if (item.product_id && delta !== 0) db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(delta, item.product_id)
      recalcOrder(item.order_id)
    })
    return getOrderWithItems(item.order_id)
  }

  const removeItem = ({ itemId }) => {
    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId)
    if (!item) return null
    inTx(() => {
      if (item.product_id) db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.qty, item.product_id) // return reserved stock
      db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId)
      recalcOrder(item.order_id)
    })
    return getOrderWithItems(item.order_id)
  }

  // Discard an order entirely. An open order returns its reserved stock and frees
  // its table; the order row is deleted.
  const voidOrder = ({ orderId }) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
    inTx(() => {
      if (order && order.status === 'open') restoreOrderStock(orderId)
      if (order && order.table_id) db.prepare("UPDATE tables SET status = 'open' WHERE id = ?").run(order.table_id)
      db.prepare('DELETE FROM orders WHERE id = ?').run(orderId)
    })
    return { ok: true }
  }

  // Delete a paid order: restore stock and mark it cancelled. It stays in history,
  // tagged with who deleted it (`by`), but is excluded from revenue/analytics.
  const cancelPaid = ({ orderId, by }) => {
    const order = getOrderWithItems(orderId)
    if (!order) throw new Error('Order not found')
    if (order.status !== 'paid') throw new Error('Only paid orders can be deleted')
    const inc = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
    inTx(() => {
      for (const it of order.items) if (it.product_id) inc.run(it.qty, it.product_id)
      db.prepare("UPDATE orders SET status = 'cancelled', deleted_at = datetime('now'), deleted_by = ? WHERE id = ?").run(by || 'Unknown', orderId)
    })
    return { ok: true }
  }

  // Edit a paid order's quantities (0 removes a line) and discount; adjusts stock
  // by the delta. Validates the whole change before mutating anything.
  const updatePaid = ({ orderId, items, discountType, discountValue }) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
    if (!order || order.status !== 'paid') throw new Error('Order is not editable')

    // Aggregate net change per product so multi-line products are checked once.
    const netDelta = new Map() // productId -> (oldQty - newQty) summed; negative => consumes more
    for (const change of items || []) {
      const item = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(change.id, orderId)
      if (!item || !item.product_id) continue
      const newQty = Math.max(0, Math.round(change.qty))
      netDelta.set(item.product_id, (netDelta.get(item.product_id) || 0) + (item.qty - newQty))
    }
    for (const [productId, delta] of netDelta) {
      if (delta >= 0) continue // returning stock is always fine
      const product = db.prepare('SELECT name, stock FROM products WHERE id = ?').get(productId)
      if (product && product.stock + delta < 0) {
        throw new Error(`Not enough stock for ${product.name} — only ${product.stock} more available`)
      }
    }

    const adjust = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
    inTx(() => {
      for (const change of items || []) {
        const item = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(change.id, orderId)
        if (!item) continue
        const newQty = Math.max(0, Math.round(change.qty))
        const delta = item.qty - newQty // positive => return stock
        if (delta !== 0 && item.product_id) adjust.run(delta, item.product_id)
        if (newQty === 0) db.prepare('DELETE FROM order_items WHERE id = ?').run(item.id)
        else db.prepare('UPDATE order_items SET qty = ? WHERE id = ?').run(newQty, item.id)
      }
      const { subtotal } = db
        .prepare('SELECT COALESCE(SUM(unit_price * qty),0) AS subtotal FROM order_items WHERE order_id = ?')
        .get(orderId)
      let discount = order.discount
      if (discountType === 'percent') discount = Math.round((subtotal * Number(discountValue)) / 100)
      else if (discountType === 'amount') discount = Math.round(Number(discountValue))
      discount = Math.max(0, Math.min(discount, subtotal))
      const total = subtotal - discount
      const paidRow = db.prepare('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE order_id = ?').get(orderId)
      db.prepare('UPDATE orders SET subtotal = ?, discount = ?, total = ?, change_due = ? WHERE id = ?').run(
        subtotal,
        discount,
        total,
        Math.max(0, paidRow.paid - total),
        orderId
      )
    })
    return getOrderWithItems(orderId)
  }

  return {
    get: (orderId) => getOrderWithItems(orderId),
    openForTable,
    addItem,
    addItemWithMods,
    setItemQty,
    removeItem,
    setDiscount,
    addPayment,
    removePayment,
    complete,
    void: voidOrder,
    cancelPaid,
    updatePaid,
    restoreOrderStock
  }
}
