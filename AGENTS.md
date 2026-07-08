# AGENTS.md — Cocina La Abundancia

Static landing page for a Mexican restaurant with a WhatsApp order flow. No build step, no package manager, no tests, no linter.

## Stack
- HTML + CSS + vanilla JS (no framework, no bundler)
- Leaflet 1.9.4 via CDN for the location picker map
- Google Maps embed for the "Conócenos" section
- Menú images served from Cloudinary (URLs hardcoded in `index.html`)
- Deploy: GitHub Pages via `.github/workflows/deploy.yml` on push to `main`

## File ownership
- `index.html` — markup, WhatsApp deep links, phone number also appears here
- `styles.css` — all styles; cache-busted via `?v=...` query string
- `script.js` — order sheet, cart, Leaflet map picker, localStorage persistence, WhatsApp message builder
- `menu-data.js` — exposes `window.MENU_DATA`: products, categories, pricing, business coords, schedules
- `Menú V1/` — unused legacy images, not referenced anywhere; safe to delete
- `Menu-V2/` — also not referenced in HTML; exists only to satisfy the `validate-assets` workflow job that walks this directory. Keep the folder, but its contents are free to remove/replace
- `Portada.png` — only critical image asset loaded from repo root

## Phone number
Single source of truth: `ORDER_PHONE` constant in `script.js:7` (`525573342834`). Also hardcoded in several `wa.me/` links in `index.html`. Update both when changing.

## Cache busting
`index.html` loads CSS/JS with `?v=20260702-1`. Bump this string on any change to `styles.css` or `script.js` or users will get stale assets.

## Deploy
Push to `main` triggers `.github/workflows/deploy.yml`:
1. `deploy` job publishes the repo root to GitHub Pages.
2. `validate-assets` job (runs after deploy) does an HTTP check on `index.html`, `Portada.png`, `styles.css`, `script.js`, `menu-data.js`, and every file under the directory whose name starts with `menu` and contains `V2` (case-insensitive). If you rename/move that folder, the validator breaks.

There is no staging environment. Every push to `main` is live.

## Local preview
No dev server. Open `index.html` directly in a browser, or `python3 -m http.server` from the repo root. The site needs network access for Leaflet CDN, Google Maps embed, and Cloudinary images.

## Conventions / gotchas
- Folder names used to use Spanish accents and spaces (`Menú V1`, `Menú V2`). `Menú V1` was removed entirely (Fase 5.1) and `Menú V2` was renamed to ASCII `Menu-V2` (Fase 5.2). If you re-introduce either, also update `deploy.yml`'s V2 detection logic.
- Order state is persisted in `localStorage` under key `cla_order_state_v2` with a 24h TTL (`STORAGE_KEY`, `STORAGE_TTL_MS` in `script.js`).
- Prices are integers in MXN. Shipping is `$10/km` from the coords in `menu-data.js#businessLocation`; packaging is `$10/item`; pickup has a fixed charge (currently `$0`).
- Category availability uses `availability.mode = 'schedule'` with `days` as JS day-of-week numbers (0=Sun … 6=Sat). Pozole is `[5,6]`, Antojitos is `[5,6]`.
- Product modifiers are defined inline in `menu-data.js` (`modifiers[]` with `type: 'multi' | 'single'`, `required`, and `priceDelta` per option).
- The `.nojekyll` file at the repo root is required for GitHub Pages to serve files starting with `_`. Keep it.
- `.gitignore` only ignores `.DS_Store`. The working tree currently has uncommitted edits to `index.html`, `script.js`, `styles.css` (and a modified `.DS_Store`) — `git status` is dirty on `main`.
