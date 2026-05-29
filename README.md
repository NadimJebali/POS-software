# POS Software

A touchscreen point-of-sale desktop app for restaurants & cafés.
Built with **Electron + React + Vite + Tailwind** and a local **SQLite** database — runs fully offline on a Windows cash register.

## Accounts & roles

**First run:** the very first launch shows a **setup screen** where you create your administrator account — business name (optional), your name, a username, and a PIN. No default password ships with the app. After that, the app opens to a **login screen** (pick your name, enter your PIN).

Two roles:

- **Administrator** — full access: manage users, edit settings, manage the menu & tables, and **edit or cancel orders in history**.
- **Cashier (user)** — day-to-day only: take orders, checkout, view history (+ reprint), and view stats.

Add cashiers (and more admins) any time from the **Users** page. PINs are stored hashed (scrypt), never in plain text. Roles are enforced both in the UI and in the backend.

> To re-trigger first-run setup on a dev machine, clear the `users` table (or delete `%APPDATA%/pos-software/pos.db` for a full reset).

## Features

- **Login & user management** — PIN login, admin-managed accounts (create/edit/disable/delete, reset PINs).
- **Categories & products** — create categories (with colors), add products with prices & stock, list view, edit/delete.
- **Stock tracking** — per-product stock, drawn down on each completed sale and restored when an order is cancelled. A configurable **low-stock threshold** (Setup) flags low/out items across the app, with a count badge on the Menu tab; the order screen warns (badge, toast, ticket banner) when serving low/out items.
- **Barcode scanning** — give a product a barcode in the Menu editor; on the order screen a USB scanner (keyboard-wedge) adds it instantly.
- **Modifiers / variants** — attach option groups to a product (e.g. *Size* → S/M/L, *Extras* → +cheese) with price deltas; tapping the product prompts for choices, and the modifiers show on the ticket, checkout, receipt, and history.
- **Auto-lock** — optionally sign the terminal out after N idle minutes (Setup → Security).
- **Tables** — add/remove tables by number or reference (from the Floor or the Tables screen), see the floor at a glance (available vs. occupied + running total).
- **Ordering** — tap a table, browse products by category, add items and adjust quantities on a live ticket.
- **Checkout** — order total with **discounts** (percentage or fixed), **split / partial payments** (cash + card), automatic **change due**, and receipt printing.
- **Order history** — browse paid orders by day or all-time, tap a row for full details, one-tap **receipt re-print**, and (admins) **edit quantities/discount or cancel** an order — stock adjusts automatically.
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

## Licensing (selling the app)

The app is protected with **offline, node-locked, signed licenses** — no server required.

- Each install shows a **Machine ID** (derived from the hardware GUID) on the activation screen and in **Setup → License**.
- The app runs as a **14-day trial**, then requires a license.
- A license is an Ed25519-**signed token bound to one Machine ID** — it can't be forged (no private key) and won't work if the app/folder is copied to another PC (different Machine ID).

### The license generator (vendor tool)
Issue licenses with the friendly generator — no commands to type:
- **`Generate License.bat`** — double-click (uses your installed Node), or
- **`LicenseGenerator.exe`** — standalone, no Node needed. Rebuild it any time with `npm run license:exe`.

It opens a small console: choose **[1] Generate a license**, paste the customer's **Machine ID**, enter a name and validity (days), and it prints the license — with options to **copy to clipboard** or save to a file. (Scriptable too: `LicenseGenerator.exe --machine <ID> --name "X" --days 365`.)

Keep the tool **next to `license-private.pem`** (your SECRET signing key — gitignored, never commit it). The public key is embedded in `src/main/license.js`. To create a fresh key pair, run the tool and choose **[2] Create new signing keys** (this invalidates all previously issued licenses).

### Issuing a license to a customer
1. The customer installs the app and reads their **Machine ID** from the activation screen (or Setup → License).
2. You run the generator, paste their Machine ID, set a name/duration → get the license string.
3. Send it to them; they paste it into **Activate** (or Setup → License). Done.

> Note: this deters casual copying/sharing (the realistic goal for a JS app). To raise the bar further, **code-sign** the build and consider compiling the license check with `bytenode`.

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
- **App icon:** lives at `build/icon.svg`. Edit it and run `npm run icon` to regenerate `build/icon.png` + `build/icon.ico` (used for the app, installer, and shortcuts), then rebuild.

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
