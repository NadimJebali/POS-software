import { dialog, BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const mainWindow = () => BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) || null

// Format integer "millis" using the shop's currency settings (mirrors receipt.js).
function money(millis, s) {
  const decimals = Math.max(0, Math.min(3, parseInt(s.currency_decimals ?? '3', 10)))
  const sign = millis < 0 ? '-' : ''
  const value = Math.abs(Math.round(millis || 0)) / 1000
  const num = value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const sym = s.currency_symbol || ''
  return s.currency_position === 'before' ? `${sign}${sym}${num}` : `${sign}${num} ${sym}`.trim()
}

const PERIOD_LABEL = {
  daily: 'Daily — last 14 days',
  weekly: 'Weekly — last 8 weeks',
  monthly: 'Monthly — last 12 months',
  yearly: 'Yearly — last 5 years'
}

function reportHtml(data) {
  const s = data.shop || {}
  const m = (v) => money(v, s)
  const scope = data.isAdmin ? 'All staff (whole shop)' : `${data.scope || 'You'}`
  const periodShort = (PERIOD_LABEL[data.period] || data.period).split('—')[0].trim()

  const summaryCard = (label, metric) => `
    <div class="card">
      <div class="lbl">${esc(label)}</div>
      <div class="amt">${m(metric.total)}</div>
      <div class="sub">${metric.count} order${metric.count === 1 ? '' : 's'}</div>
    </div>`

  const seriesRows = (data.series || [])
    .map((b) => `<tr><td>${esc(b.label)}</td><td class="r">${m(b.total)}</td></tr>`)
    .join('')

  const topRows = (data.top || [])
    .map((t, i) => `<tr><td class="i">${i + 1}</td><td>${esc(t.name)}</td><td class="r">${t.qty}</td><td class="r">${m(t.revenue)}</td></tr>`)
    .join('')

  const serverRows = (data.byServer || [])
    .map((v) => `<tr><td>${esc(v.name)}</td><td class="r">${v.orders}</td><td class="r">${m(v.revenue)}</td></tr>`)
    .join('')

  const serverSection = data.isAdmin
    ? `<h2>Sales by server — ${esc(periodShort)}</h2>
       <table><thead><tr><th>Server</th><th class="r">Orders</th><th class="r">Revenue</th></tr></thead>
       <tbody>${serverRows || '<tr><td colspan="3" class="muted">No sales in this period.</td></tr>'}</tbody></table>`
    : ''

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, Arial, sans-serif; color: #1b1b1b; margin: 0; padding: 32px 36px; }
    h1 { font-size: 24px; margin: 0; }
    h2 { font-size: 15px; margin: 26px 0 8px; color: #b4761f; border-bottom: 2px solid #f0e2cf; padding-bottom: 4px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #ec9a45; padding-bottom: 12px; }
    .meta { text-align: right; font-size: 12px; color: #555; line-height: 1.6; }
    .meta b { color: #1b1b1b; }
    .cards { display: flex; gap: 12px; margin-top: 18px; }
    .card { flex: 1; border: 1px solid #eadfce; border-radius: 12px; padding: 12px 14px; background: #fbf7f0; }
    .card .lbl { font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: .4px; }
    .card .amt { font-size: 20px; font-weight: 700; color: #b4761f; margin-top: 4px; }
    .card .sub { font-size: 11px; color: #777; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    th { text-align: left; color: #777; font-weight: 600; border-bottom: 1.5px solid #e7ddcd; padding: 6px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
    td { padding: 6px 8px; border-bottom: 1px solid #f0eadf; }
    td.r, th.r { text-align: right; }
    td.i { color: #999; width: 24px; }
    td.muted { color: #999; text-align: center; }
    .foot { margin-top: 28px; font-size: 10.5px; color: #aaa; text-align: center; }
  </style></head><body>
    <div class="head">
      <div>
        <h1>${esc(s.shop_name || 'Sales report')}</h1>
        <div style="font-size:13px;color:#777;margin-top:2px;">Sales report</div>
      </div>
      <div class="meta">
        <div>For: <b>${esc(scope)}</b></div>
        <div>Generated: <b>${esc(data.generatedAt.toLocaleString())}</b></div>
      </div>
    </div>

    <div class="cards">
      ${summaryCard('Today', data.overview.today)}
      ${summaryCard('This week', data.overview.week)}
      ${summaryCard('This month', data.overview.month)}
      ${summaryCard('This year', data.overview.year)}
    </div>

    <h2>${esc(PERIOD_LABEL[data.period] || data.period)}</h2>
    <table><thead><tr><th>Period</th><th class="r">Revenue</th></tr></thead>
    <tbody>${seriesRows || '<tr><td colspan="2" class="muted">No data.</td></tr>'}</tbody></table>

    <h2>Top products — ${esc(periodShort)}</h2>
    <table><thead><tr><th class="i">#</th><th>Product</th><th class="r">Qty</th><th class="r">Revenue</th></tr></thead>
    <tbody>${topRows || '<tr><td colspan="4" class="muted">No sales in this period.</td></tr>'}</tbody></table>

    ${serverSection}

    <div class="foot">Generated by ${esc(s.shop_name || 'POS')} · ${esc(data.generatedAt.toISOString().slice(0, 10))}</div>
  </body></html>`
}

// Render the analytics report to a PDF the user chooses a location for.
export async function exportAnalyticsPdf(data) {
  const scopeSlug = (data.isAdmin ? 'all-staff' : data.scope || 'me').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
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
