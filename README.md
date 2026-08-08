# QueryDrop

QueryDrop is a free, browser-based tool for converting and querying data files. Everything runs on your device — files are never uploaded to any server.

## What it does

- Converts files between 9 input formats and 9 output formats: CSV, TSV, JSON, NDJSON, Excel, Parquet, Feather, Arrow, GeoJSON, SQL, Markdown, HTML, and SQLite.
- Runs SQL queries on local files (joins, aggregations, window functions, pivot queries).
- Builds pivot tables and charts from query results.
- Works offline as a PWA.

Each conversion has its own page under `/convert/<from>-to-<to>` (for example `/convert/parquet-to-csv`).

## How it works

The site is a static build (Astro + React) deployed on Cloudflare Pages. There is no backend.

The SQL engine is [DuckDB](https://duckdb.org) compiled to WebAssembly. When you drop a file, the browser:

1. Reads the file locally and registers it in an in-memory DuckDB instance running in a web worker.
2. Runs the conversion or query on that instance.
3. Writes the result back to your device as a download.

Because the engine runs in the browser, files are never transmitted. DuckDB-WASM runs in a high-performance mode that requires cross-origin isolation (COOP + COEP headers, configured in `public/_headers`).

## Development

```bash
npm install
npm run dev      # local dev server at localhost:4321
npm run build    # static output in dist/
npm run preview  # serve the built site locally
```

## Deployment

1. Push the repo to GitHub.
2. In Cloudflare Pages, create a project and connect the repository.
3. Build command: `npm run build`. Output directory: `dist`.
4. Deploy.

`public/_headers` ships the security headers (COOP, COEP, HSTS, CSP) that DuckDB-WASM needs and that allow Google AdSense on content pages.

## Privacy

- No backend, no accounts, no cookies for the tool itself.
- File data never leaves the browser.
- Content pages show ads served by Google AdSense; ad requests carry no file data.
- Optional Plausible analytics only loads if the visitor opts in via the footer toggle.
