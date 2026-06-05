import { BrowserWindow } from 'electron'
import { mt, isRtlLang } from './i18n'

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Format integer "millis" (price * 1000) using the shop's currency settings.
function money(millis, s) {
  const decimals = Math.max(0, Math.min(3, parseInt(s.currency_decimals ?? '3', 10)))
  const sign = millis < 0 ? '-' : ''
  const value = Math.abs(Math.round(millis || 0)) / 1000
  const num = value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const sym = s.currency_symbol || ''
  return s.currency_position === 'before' ? `${sign}${sym}${num}` : `${sign}${num} ${sym}`.trim()
}

function receiptHtml(order, s) {
  const lang = s.language || 'en'
  const dir = isRtlLang(lang) ? 'rtl' : 'ltr'
  const width = s.paper_width === '58' ? 210 : 280 // px render width per paper size
  const date = new Date((order.paid_at || '') + 'Z')
  const dateStr = isNaN(date) ? new Date().toLocaleString() : date.toLocaleString()

  const rows = order.items
    .map(
      (it) =>
        `<tr><td class="q">${it.qty}×</td><td class="n">${esc(it.name)}${
          it.modifiers ? `<div class="mod">${esc(it.modifiers)}</div>` : ''
        }</td><td class="p">${money(it.unit_price * it.qty, s)}</td></tr>`
    )
    .join('')

  const payments = (order.payments || [])
    .map((p) => `<div class="line"><span>${esc(p.method === 'card' ? mt(lang, 'receipt.card') : mt(lang, 'receipt.cash'))}</span><span>${money(p.amount, s)}</span></div>`)
    .join('')

  const logo = s.logo ? `<img src="${esc(s.logo)}" alt="" style="max-width:60%;max-height:80px;margin:0 auto 6px;display:block;" />` : ''

  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: 'Cascadia Mono','Consolas','Courier New',monospace; width: ${width}px; margin: 0 auto; padding: 10px 6px; color:#000; }
    h1 { font-size: 18px; text-align:center; margin:0 0 2px; letter-spacing:.5px; }
    .sub { text-align:center; font-size:11px; line-height:1.4; margin-bottom:8px; }
    hr { border:none; border-top:1px dashed #000; margin:6px 0; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    td { padding:2px 0; vertical-align:top; }
    td.q { width:30px; }
    td.p { text-align:right; white-space:nowrap; padding-left:6px; }
    .mod { font-size:10px; color:#444; padding-left:4px; }
    .line { display:flex; justify-content:space-between; font-size:12px; padding:1px 0; }
    .tot { font-size:15px; font-weight:bold; }
    .foot { text-align:center; font-size:11px; margin-top:10px; line-height:1.5; }
  </style></head><body>
    ${logo}
    <h1>${esc(s.shop_name || 'Receipt')}</h1>
    <div class="sub">
      ${s.shop_address ? esc(s.shop_address) + '<br>' : ''}
      ${s.shop_phone ? mt(lang, 'receipt.tel') + ': ' + esc(s.shop_phone) + '<br>' : ''}
      ${order.table_label ? mt(lang, 'receipt.table') + ' ' + esc(order.table_label) + ' · ' : ''}${mt(lang, 'receipt.order')} #${order.id}<br>${esc(dateStr)}
    </div>
    <hr>
    <table>${rows}</table>
    <hr>
    ${order.discount > 0 ? `<div class="line"><span>${mt(lang, 'receipt.subtotal')}</span><span>${money(order.subtotal, s)}</span></div><div class="line"><span>${mt(lang, 'receipt.discount')}</span><span>-${money(order.discount, s)}</span></div>` : ''}
    <div class="line tot"><span>${mt(lang, 'receipt.total')}</span><span>${money(order.total, s)}</span></div>
    ${payments}
    ${order.change_due > 0 ? `<div class="line"><span>${mt(lang, 'receipt.change')}</span><span>${money(order.change_due, s)}</span></div>` : ''}
    <div class="foot">${esc(s.receipt_footer || '')}</div>
  </body></html>`
}

/**
 * Renders the receipt offscreen and prints it.
 * Uses shop settings for content, paper width, the target printer, and silent mode.
 */
export function printReceipt(order, settings) {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({ show: false, webPreferences: { offscreen: false } })

    const finish = (err) => {
      if (!win.isDestroyed()) win.close()
      if (err && !/cancel/i.test(String(err.message || err))) reject(err)
      else resolve()
    }

    const silent = settings.print_silent === '1'
    const printOpts = { silent, printBackground: true, margins: { marginType: 'none' } }
    if (silent && settings.printer_name) printOpts.deviceName = settings.printer_name

    win
      .loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(receiptHtml(order, settings)))
      .then(() => {
        try {
          win.webContents.print(printOpts, (success, failureReason) =>
            finish(success ? null : new Error(failureReason || 'print failed'))
          )
        } catch (err) {
          finish(err)
        }
      })
      .catch(finish)
  })
}
