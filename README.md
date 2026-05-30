# Carnet de vol (FlightLog)

Offline-first PWA flight logbook (ALAT). **No build step, no framework, zero
runtime dependencies** — plain HTML/CSS + native ES modules, designed to keep
working for years and to run with nothing but a static file host.

## Run locally

```sh
npm run dev      # serves app/ at http://localhost:8080 (python3 http.server)
```

Open it, then **Réglages → Importer (JSON)** to load a logbook.

## Import existing data

```sh
npm run migrate                       # carnet de vol.xlsx -> carnet-migrated.json
# or: node tools/migrate.mjs "<xlsx>" out.json
```

Then import the JSON via Réglages. The migration is zero-dependency (shells out
to `unzip`, parses the sheet XML). Personal data (`carnet-*.json`, the source
`.xlsx`) is gitignored.

## Layout

- `app/` — the deployable web root (this is what GitHub Pages serves)
  - `index.html`, `manifest.webmanifest`, `sw.js` (hand-written service worker), `styles.css`
  - `src/` — `app.js` (entry), `router.js` (hash router), `state.js` + `db.js` (IndexedDB, single-JSON doc), `model.js` (pure helpers), `views/`, `ui/`
- `tools/` — `gen_icons.mjs` (zero-dep PNG icons), `migrate.mjs` (xlsx → JSON)

## Deploy

Pushing to `main` triggers `.github/workflows/pages.yml`, which publishes `app/`
to GitHub Pages. One-time: repo **Settings → Pages → Source: GitHub Actions**.

The app uses only relative paths (`start_url: "."`, `scope: "./"`), so it works
from any subpath without configuration.
