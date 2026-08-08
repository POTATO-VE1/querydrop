# QueryDrop

QueryDrop is a fast, secure, and private browser-native SQL pad and format converter powered by DuckDB-WASM. Query and analyze files up to 100MB completely client-side. Your data never leaves your browser.

**Live demo / project home:** [github.com/POTATO-VE1/querydrop](https://github.com/POTATO-VE1/querydrop)

## 🚀 Key Features

* **Zero-Upload Ingestion**: Analyze CSV, TSV, JSON, NDJSON, Excel, Parquet, Feather, Arrow, and GeoJSON files in-browser.
* **DuckDB SQL Engine**: Full SQL support including complex joins, aggregations, window functions, and pivot queries.
* **Instant Conversions**: Convert between 9 inputs and 9 outputs (CSV, JSON, NDJSON, Parquet, Excel, SQLite, SQL, Markdown, HTML). Dedicated per-format pages at `/convert/<from>-to-<to>` (e.g. `/convert/parquet-to-csv`).
* **Interactive Visualization**: Automatically chart query results using line and bar charts.
* **Saved Queries & History**: Persist query snippets and recent run history locally in your browser.
* **Visual Query Builder**: Slide-over panel to construct queries visually for non-SQL users.
* **Shareable Workspace Links**: Encode your current query and result schemas into lightweight, compressed sharing URLs.
* **Offline-First PWA**: Runs fully offline with service worker support.

## 🛠️ Tech Stack

* **Core Structure**: [Astro](https://astro.build) (static outputs, optimized routing)
* **WASM SQL Engine**: [@duckdb/duckdb-wasm](https://github.com/duckdb/duckdb-wasm)
* **Frontend Components**: React, CodeMirror 6 (SQL editor), uPlot (charts), SheetJS (excel processing)
* **Styling**: Vanilla CSS with HSL-themed variables (sleek dark mode)
* **Testing**: Vitest with React Testing Library

## ⚙️ Commands

All commands are executed from the project root:

| Command | Action |
|:---|:---|
| `npm install` | Installs project dependencies |
| `npm run dev` | Starts the local dev server at `localhost:4321` |
| `npm run build` | Builds the static site to `./dist/` |
| `npm run test` | Runs the Vitest test suite |
| `npm run test --run` | Executes tests and exits (ideal for CI) |

## 🚀 Deploying

The site is a fully static build (output: `dist/`) and is deployed on **Cloudflare Pages**:

1. Push to GitHub (repo root is the project root).
2. Cloudflare Pages → Create application → Connect to Git → select the repo.
3. Build settings: **Build command** `npm run build`, **Build output directory** `dist`.
4. Deploy. First build ~2 min, subsequent ~30s.

`public/_headers` ships COOP, COEP (`credentialless` — keeps DuckDB-WASM high-perf mode while allowing third-party ad iframes), HSTS, and a CSP that allows Google AdSense on content pages.

## 🔒 Security & Privacy

QueryDrop is architected with security and privacy as core priorities:
1. **Local Processing**: DuckDB-WASM executes directly in the browser's web worker context.
2. **CSP & Security Headers**: Equipped with a strict Content Security Policy, Cross-Origin Opener Policy (COOP), Cross-Origin Embedder Policy (COEP), and HSTS.
3. **No Tracking**: Opt-in privacy-respecting Plausible analytics toggle only. Ads (AdSense) run on content pages only — the tool pages stay clean, and file data never leaves the browser.
