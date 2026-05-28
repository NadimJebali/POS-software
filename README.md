# POS Software

A touchscreen point-of-sale desktop app for restaurants & cafés.
Built with **Electron + React + Vite + Tailwind** and a local **SQLite** database — runs fully offline on a Windows cash register.

## Features

- **Categories & products** — create categories (with colors), add products with prices, list view, edit/delete.
- **Tables** — add/remove tables by number or reference (from the Floor or the Tables screen), see the floor at a glance (available vs. occupied + running total).
- **Ordering** — tap a table, browse products by category, add items and adjust quantities on a live ticket.
- **Checkout** — order total with **discounts** (percentage or fixed), **split / partial payments** (cash + card), automatic **change due**, and receipt printing.
- **Order history** — browse paid orders by day or all-time, with one-tap **receipt re-print**.
- **Analytics** — daily / weekly / monthly / yearly earnings, a bar chart, and top products.
- **Settings** — shop name / address / phone / logo on receipts, configurable **currency** (symbol, decimals, position), and **printer** setup (target printer, silent vs. dialog, 58/80 mm paper).

### Design

"Espresso & Ember" — a warm hospitality dark theme with **Bricolage Grotesque** (display) + **Hanken Grotesk** (body), self-hosted for offline use, tabular figures on all money, ambient glow + film-grain texture, and touch-first motion.

> Money is stored internally as integer "millis" (price × 1000) to avoid rounding errors. Defaults to **Tunisian Dinar (TND)**, 3 decimals (`12.500 DT`), no tax — all configurable in Settings.

## Requirements

- Node.js 18+ (tested on 24)
- Windows (the build targets a Windows touchscreen terminal)

## Setup

```bash
npm install
```

> The database uses **sql.js** (SQLite compiled to WebAssembly), so there is **no native build step** — no Visual Studio / C++ toolchain required.

## Run (development)

```bash
npm run dev
```

## Build a Windows installer

```bash
npm run dist
```

This produces `release/POS-Software-<version>-setup.exe` — a standard NSIS installer that lets the user pick the install folder and creates desktop + Start-menu shortcuts (installs per-user, no admin required). The SQLite WASM database (`sql.js`) is bundled and unpacked from the asar automatically.

### Notes

- **Unsigned app:** the installer isn't code-signed, so Windows SmartScreen may show *"Windows protected your PC"*. Click **More info → Run anyway**. To remove this, buy a code-signing certificate and set `CSC_LINK`/`CSC_KEY_PASSWORD` before building.
- **`winCodeSign` symlink error on first build:** electron-builder downloads a tool whose archive contains macOS symlinks; Windows blocks creating symlinks without **Developer Mode** or admin, which aborts the build with *"A required privilege is not held by the client"*. Fixes (any one):
  1. Turn on **Settings → Privacy & security → For developers → Developer Mode**, then `npm run dist` (recommended, permanent).
  2. Run the build from an **Administrator** terminal.
  3. Pre-extract the tool without the macOS folder (one-time):
     ```powershell
     $c = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
     & ".\node_modules\7zip-bin\win\x64\7za.exe" x "$c\<any-cached>.7z" "-o$c\winCodeSign-2.6.0" "-x!darwin" -y
     ```
- **App data** lives in `%APPDATA%/pos-software/pos.db` and survives reinstalls/updates.
- **App icon:** currently the default Electron icon. Drop a `build/icon.ico` (256×256) to brand it.

## Data

The SQLite database lives in Electron's per-user data folder
(`%APPDATA%/pos-software/pos.db` on Windows). It is created and seeded with demo
categories, products, and 8 tables on first launch.

## Project layout

```
src/
  main/        Electron main process
    index.js   window + app lifecycle
    db.js      SQLite (sql.js/WASM) schema, seed + storage adapter
    ipc.js     all data operations + analytics queries
    receipt.js receipt rendering + printing
  preload/
    index.js   secure contextBridge (window.pos)
  renderer/    React UI
    src/
      pages/       Floor, Order, Checkout, Products, TablesManage, Analytics, History, Settings
      components/  Layout, PageHeader, Modal, NumberPad, icons
      lib/         api.js (bridge wrapper), settings.jsx (settings store + currency-aware money())
```
