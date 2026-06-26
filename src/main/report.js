import { dialog, BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import { mt, isRtlLang } from './i18n'
import { formatMoney } from '../shared/money'
import { parseSettings } from '../shared/settings'

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const mainWindow = () => BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) || null

// Main-process adapter: formats integer millimes from a settings row (mirrors receipt.js).
function money(millis, s) {
  return formatMoney(millis, parseSettings(s).currency)
}

const methodLabel = (m, lang) =>
  m === 'card' ? mt(lang, 'report.card') : m === 'cash' ? mt(lang, 'report.cash') : m || mt(lang, 'report.other')

function reportHtml(data) {
  const s = data.shop || {}
  const lang = data.lang || 'en'
  const dir = isRtlLang(lang) ? 'rtl' : 'ltr'
  const t = (key, vars) => esc(mt(lang, key, vars))
  const m = (v) => money(v, s)
  const sec = data.sections || {}

  const summaryBlock = sec.summary
    ? `<div class="cards">
        <div class="card"><div class="lbl">${t('report.revenue')}</div><div class="amt">${m(data.summary.total)}</div></div>
        <div class="card"><div class="lbl">${t('report.orders')}</div><div class="amt">${data.summary.count}</div></div>
        <div class="card"><div class="lbl">${t('report.avgOrder')}</div><div class="amt">${m(data.summary.avg)}</div></div>
      </div>`
    : ''

  const trendRows = (data.trend || [])
    .map((b) => `<tr><td>${esc(b.label)}</td><td class="r">${b.count}</td><td class="r">${m(b.total)}</td></tr>`)
    .join('')
  const trendBlock = sec.trend
    ? `<h2>${t('report.salesTrend', { unit: mt(lang, data.trendBy === 'month' ? 'report.month' : 'report.day') })}</h2>
       <table><thead><tr><th>${t('report.period')}</th><th class="r">${t('report.orders')}</th><th class="r">${t('report.revenueCol')}</th></tr></thead>
       <tbody>${trendRows || `<tr><td colspan="3" class="muted">${t('report.noSales')}</td></tr>`}</tbody></table>`
    : ''

  const topRows = (data.top || [])
    .map((tp, i) => `<tr><td class="i">${i + 1}</td><td>${esc(tp.name)}</td><td class="r">${tp.qty}</td><td class="r">${m(tp.revenue)}</td></tr>`)
    .join('')
  const topBlock = sec.topProducts
    ? `<h2>${t('report.topProducts')}</h2>
       <table><thead><tr><th class="i">#</th><th>${t('report.product')}</th><th class="r">${t('report.qty')}</th><th class="r">${t('report.revenueCol')}</th></tr></thead>
       <tbody>${topRows || `<tr><td colspan="4" class="muted">${t('report.noSales')}</td></tr>`}</tbody></table>`
    : ''

  const serverRows = (data.byServer || [])
    .map((v) => `<tr><td>${esc(v.name)}</td><td class="r">${v.orders}</td><td class="r">${m(v.revenue)}</td></tr>`)
    .join('')
  const serverBlock = sec.byServer && data.isAdmin
    ? `<h2>${t('report.salesByServer')}</h2>
       <table><thead><tr><th>${t('report.server')}</th><th class="r">${t('report.orders')}</th><th class="r">${t('report.revenueCol')}</th></tr></thead>
       <tbody>${serverRows || `<tr><td colspan="3" class="muted">${t('report.noSales')}</td></tr>`}</tbody></table>`
    : ''

  const payRows = (data.payments?.methods || [])
    .map((p) => `<tr><td>${esc(methodLabel(p.method, lang))}</td><td class="r">${m(p.amount)}</td></tr>`)
    .join('')
  const paysBlock = sec.payments
    ? `<h2>${t('report.payments')}</h2>
       <table><thead><tr><th>${t('report.method')}</th><th class="r">${t('report.collected')}</th></tr></thead>
       <tbody>${payRows || `<tr><td colspan="2" class="muted">${t('report.noPayments')}</td></tr>`}
       <tr><td>${t('report.changeGiven')}</td><td class="r">${m(data.payments?.change || 0)}</td></tr></tbody></table>`
    : ''

  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, Arial, sans-serif; color: #1b1b1b; margin: 0; padding: 32px 36px; }
    h1 { font-size: 24px; margin: 0; }
    h2 { font-size: 15px; margin: 26px 0 8px; color: #b4761f; border-bottom: 2px solid #f0e2cf; padding-bottom: 4px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #ec9a45; padding-bottom: 12px; }
    .meta { text-align: end; font-size: 12px; color: #555; line-height: 1.6; }
    .meta b { color: #1b1b1b; }
    .cards { display: flex; gap: 12px; margin-top: 18px; }
    .card { flex: 1; border: 1px solid #eadfce; border-radius: 12px; padding: 12px 14px; background: #fbf7f0; }
    .card .lbl { font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: .4px; }
    .card .amt { font-size: 20px; font-weight: 700; color: #b4761f; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    th { text-align: start; color: #777; font-weight: 600; border-bottom: 1.5px solid #e7ddcd; padding: 6px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
    td { padding: 6px 8px; border-bottom: 1px solid #f0eadf; }
    td.r, th.r { text-align: end; }
    td.i { color: #999; width: 24px; }
    td.muted { color: #999; text-align: center; }
    .foot { margin-top: 28px; font-size: 10.5px; color: #aaa; text-align: center; }
  </style></head><body>
    <div class="head">
      <div>
        <h1>${esc(s.shop_name || mt(lang, 'report.salesReport'))}</h1>
        <div style="font-size:13px;color:#777;margin-top:2px;">${t('report.salesReport')} · ${esc(data.rangeLabel || '')}</div>
      </div>
      <div class="meta">
        <div>${t('report.for')}: <b>${esc(data.scope)}</b></div>
        <div>${t('report.generated')}: <b>${esc(data.generatedAt.toLocaleString())}</b></div>
      </div>
    </div>
    ${summaryBlock}
    ${trendBlock}
    ${topBlock}
    ${serverBlock}
    ${paysBlock}
    <div class="foot">${t('report.generatedBy')} ${esc(s.shop_name || 'POS')} · ${esc(data.generatedAt.toISOString().slice(0, 10))}</div>
  </body></html>`
}

// Render the analytics report to a PDF the user chooses a location for.
export async function exportAnalyticsPdf(data) {
  const scopeSlug = String(data.scope || 'report').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const stamp = new Date().toISOString().slice(0, 10)
  const opts = {
    title: 'Export sales report',
    defaultPath: `sales-report-${scopeSlug}-${stamp}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  }
  const win = mainWindow()
  const { canceled, filePath } = await (win ? dialog.showSaveDialog(win, opts) : dialog.showSaveDialog(opts))
  if (canceled || !filePath) return { ok: false, canceled: true }

  const pdfWin = new BrowserWindow({ show: false, webPreferences: { offscreen: false } })
  try {
    await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(reportHtml(data)))
    const pdf = await pdfWin.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } })
    writeFileSync(filePath, pdf)
  } finally {
    if (!pdfWin.isDestroyed()) pdfWin.close()
  }
  return { ok: true, path: filePath }
}
