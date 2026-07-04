# Auto-updates (issue #24)

The POS app self-updates from a static HTTPS feed with **no per-café action**. Updates
download in the background and install **on quit** — never a forced restart, and a
failed or unreachable check is silent and harmless. Updates are **not** gated on license
status, and the update check never touches the license endpoints.

- **Feed:** `https://pos.nadimjebali.engineer/updates/` (served by the platform droplet —
  POS-platform#11). Requires no authentication.
- **Provider:** electron-updater `generic`, configured in `package.json` → `build.publish`.
- **Channel:** single stable `latest`.
- **Signing:** none in this slice (per the PRD). Windows SmartScreen will warn on first
  run of an unsigned installer.

## How it works in the app

- `src/main/updater.js` (`initAutoUpdate`) sets `autoDownload` + `autoInstallOnAppQuit`,
  starts one background check, and swallows every error. It's wired in
  `src/main/index.js` for **packaged builds only** (dev has no feed).
- On a completed download it sends `update:ready` to the renderer, which shows a small,
  dismissible "Update ready — installs when you quit" strip (en/fr/ar). The notice only
  appears after the download finishes and never blocks a screen.

## Publishing a new version

1. Bump `version` in `package.json` (electron-updater compares semver).
2. Publish:

   ```bash
   # builds (electron-vite + electron-builder) then uploads to the droplet's /updates
   npm run publish:update
   ```

   Config via env if your host differs (defaults shown):
   `DEPLOY_HOST=pos.nadimjebali.engineer DEPLOY_USER=root UPDATES_DIR=/root/pos-platform/updates SSH_KEY=<path>`

   Useful flags: `--skip-build` (upload an existing `release/`), `--dry-run` (build + list,
   no upload).

The script uploads the installer + `.blockmap` first and `latest.yml` **last**, so a
client never reads metadata pointing at a half-uploaded file.

## Manual verification checklist (do this once per pipeline change)

Publishing vN+1 while a real install runs vN:

- [ ] Install **vN** (`release/POS-Software-vN-setup.exe`) on a test machine and launch it.
- [ ] Bump `version` to **vN+1**, run `npm run publish:update`.
- [ ] Confirm the feed is live: `curl https://pos.nadimjebali.engineer/updates/latest.yml`
      shows version **vN+1** and a `sha512`.
- [ ] Leave the **vN** app open ~1 min; the background download completes and the
      **"Update ready — installs when you quit"** notice appears (no interruption).
- [ ] Quit the app. It installs silently.
- [ ] Relaunch → **Help/About or the installer version shows vN+1**.
- [ ] Turn off networking and launch: no update error is shown; the app works normally.

## Rollback

To roll fresh installs back from a bad **vN+1** to **vN**:

1. Re-upload **vN**'s artifacts so the feed points at the older build:

   ```bash
   # from a checkout/build of vN (or a saved release/ of vN)
   SKIP=1 npm run publish:update -- --skip-build   # if you still have vN in release/
   # otherwise rebuild vN and run: npm run publish:update
   ```

   The key file is `latest.yml` — whichever version it names is what clients install.
   Uploading vN's `latest.yml` (plus vN's installer + blockmap) is the rollback.
2. Verify: `curl …/updates/latest.yml` names **vN**; a fresh install picks up **vN**.

> Machines already updated to vN+1 won't auto-downgrade (electron-updater only moves to a
> **newer** semver). To force a downgrade everywhere, publish a **vN+2** built from the
> good vN code.
