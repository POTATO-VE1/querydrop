# QueryDrop — Comprehensive Project Audit & Improvement Plan

> **Audited:** Every source file in `src/`, `public/`, `scripts/`, `test/`, and root config files.
> **Date:** 2026-06-07
> **Scope:** Bugs · Broken UI · Logic Errors · SEO · Accessibility · Security · Performance · Code Quality · Product Improvements

---

## Table of Contents

- [Part 1: Critical Issues (Must Fix)](#part-1-critical-issues-must-fix)
- [Part 2: High-Severity Issues](#part-2-high-severity-issues)
- [Part 3: Medium-Severity Issues](#part-3-medium-severity-issues)
- [Part 4: Low-Severity Issues](#part-4-low-severity-issues)
- [Part 5: SEO Improvements](#part-5-seo-improvements)
- [Part 6: Product Improvements (Frontend)](#part-6-product-improvements-frontend)
- [Part 7: Product Improvements (Backend)](#part-7-product-improvements-backend)
- [Part 8: Implementation Plan](#part-8-implementation-plan)

---

## Part 1: Critical Issues (Must Fix)

### C-1 · SQL Injection in `sqlForFile` — `queries.ts`
**File:** `src/lib/duckdb/queries.ts` lines 17–32
**Description:** `virtualName` is interpolated directly into SQL with only single-quote wrapping. If `virtualName` contains a single quote, it enables SQL injection.
**Fix:**
```ts
export function sqlForFile(virtualName: string, format: FileFormat): string {
  const escaped = virtualName.replace(/'/g, "''");
  switch (format) {
    case 'csv':  return `SELECT * FROM read_csv_auto('${escaped}')`;
    case 'tsv':  return `SELECT * FROM read_csv_auto('${escaped}', delim='\\t')`;
    case 'json': return `SELECT * FROM read_json_auto('${escaped}')`;
    // ... all other cases
  }
}
```

---

### C-2 · SQL Injection in `serializeParquet` — `export.ts`
**File:** `src/lib/export.ts` lines 114–142
**Description:** The `sql` parameter (user input) is interpolated directly into `CREATE TEMP TABLE ${tempTable} AS ${sql}`. While this runs in browser-local DuckDB, it can still cause unexpected behavior. Additionally, if `CREATE TEMP TABLE` fails, neither `tempTable` nor `virtualFile` get cleaned up.
**Fix:**
```ts
export async function serializeParquet(db, conn, sql) {
  const ts = Date.now();
  const tempTable = `__export_${ts}`;
  const virtualFile = `__export_${ts}.parquet`;
  let tableCreated = false;
  try {
    await conn.query(`CREATE TEMP TABLE ${tempTable} AS ${sql}`);
    tableCreated = true;
    await db.registerFileBuffer(virtualFile, new Uint8Array(0));
    await conn.query(`COPY (SELECT * FROM ${tempTable}) TO '${virtualFile}' (FORMAT PARQUET)`);
    const buf = await db.copyFileToBuffer(virtualFile);
    return new Blob([new Uint8Array(buf)], { type: 'application/vnd.apache.parquet' });
  } finally {
    if (tableCreated) {
      try { await conn.query(`DROP TABLE ${tempTable}`); } catch { /* best effort */ }
    }
    try { await db.dropFile(virtualFile); } catch { /* best effort */ }
  }
}
```

---

### C-3 · SQL Injection in `FormatConverter.tsx`
**File:** `src/components/tool/FormatConverter.tsx` lines 404–405, 415, 419, 422, 436, 463, 467
**Description:** `virtualName` constructed from user filename is interpolated into SQL via template literals (`CREATE TEMP TABLE ${virtualName}`, `SELECT * FROM ${virtualName}`, etc.). Although the regex strips non-alphanumeric chars, filenames starting with digits (after stripping) create invalid identifiers.
**Fix:** Quote all identifiers:
```ts
const safeName = `"${virtualName.replace(/"/g, '""')}"`;
```

---

### C-4 · Missing OG Image File — All Social Previews Broken
**File:** `src/layouts/Layout.astro` line 21
**Description:** `ogImage` defaults to `/og-default.png` but the file does **not exist** in `public/`. Every page generates broken `og:image` and `twitter:image` meta tags pointing to a 404.
**Fix:** Create a `public/og-default.png` (1200×630px) or change the default to an existing file.

---

### C-5 · Nested `<main>` Elements — Invalid HTML
**Files:** `src/layouts/Layout.astro` line 85, `src/pages/index.astro` line 32, `convert.astro` line 36, `pivot.astro` line 48, `privacy.astro` line 32
**Description:** Layout.astro wraps `<slot />` in `<main>`. Each page adds another `<main>` inside the slot = **nested `<main>` elements** = invalid HTML + broken landmarks for screen readers.
**Fix:** Change inner `<main>` to `<div>` in all page files:
```diff
- <main class="min-h-screen">
+ <div class="min-h-screen">
```

---

### C-6 · Broken Nav Links — /guides, /datasets, /pricing → 404
**File:** `src/pages/index.astro` lines 45–47, 82, 197–199
**Description:** Header and footer link to `/guides`, `/datasets`, `/pricing` but none of these pages exist. These are confirmed 404s visible to every visitor.
**Fix:** Remove links until pages are built, or create placeholder pages:
```diff
- <a href="/guides">Guides</a>
- <a href="/datasets">Datasets</a>
- <a href="/pricing">Pricing</a>
```

---

### C-7 · `removeFile` — SQL Injection via Table Name
**File:** `src/components/tool/QueryPad.tsx` line 371
**Description:** `target.registered.virtualName` is interpolated directly into `DROP TABLE IF EXISTS ${target.registered.virtualName}` without quoting. While virtual names are sanitized during registration, this is a fragile pattern.
**Fix:**
```ts
await conn.query(`DROP TABLE IF EXISTS "${target.registered.virtualName.replace(/"/g, '""')}"`);
```

---

## Part 2: High-Severity Issues

### H-1 · `downloadBlob` Revokes URL Too Early — Large Downloads Fail
**File:** `src/lib/export.ts` lines 182–192
**Description:** `URL.revokeObjectURL(url)` is called in `setTimeout(..., 0)`. For large blobs, the download may not have started.
**Fix:** Change to `setTimeout(() => URL.revokeObjectURL(url), 60_000)`.

---

### H-2 · DuckDB Query Timeout Doesn't Cancel Underlying Query
**File:** `src/lib/duckdb/queries.ts` lines 56–79
**Description:** The timeout race only rejects the JS Promise; the actual DuckDB query continues running in the background, consuming memory and CPU.
**Fix:** Close/cancel the connection on timeout to abort the query.

---

### H-3 · No `tableName` Validation in `arrow.ts`
**File:** `src/lib/duckdb/arrow.ts` lines 17–25
**Description:** `tableName` is passed to `conn.insertArrowTable` without sanitization. The `assertSafeIdent` from queries.ts is not used.
**Fix:** Add validation: `if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) throw new Error(...)`.

---

### H-4 · MobileRunBar Uses Non-Existent CSS Classes — Invisible Text
**File:** `src/components/tool/MobileRunBar.tsx` lines 73, 83, 106, 111, 134
**Description:** Uses `text-fg-0`, `text-fg-1`, `text-fg-2` classes that don't exist anywhere in the CSS/Tailwind config. Text will be invisible on dark backgrounds.
**Fix:** Replace with existing utility classes (`text-text-primary`, `text-text-secondary`, `text-text-tertiary`).

---

### H-5 · OfflineBanner `autoDismissed` Never Resets
**File:** `src/components/OfflineBanner.tsx` lines 49, 65–81
**Description:** Once `autoDismissed` is set to `true`, it's never reset. If user goes offline → banner auto-dismisses → online → offline again, the banner won't reappear.
**Fix:** Reset `autoDismissed` when the user comes back online:
```ts
const onOnline = () => { setOnline(true); setAutoDismissed(false); };
```

---

### H-6 · ChartView — `Number(v) || 0` Masks Null Values
**File:** `src/components/tool/ChartView.tsx` line 60
**Description:** `null` and `NaN` values become `0` instead of gaps in the chart, masking data quality issues.
**Fix:**
```ts
const v = r[c];
if (v === null || v === undefined) return null;
const n = Number(v);
return Number.isFinite(n) ? n : null;
```

---

### H-7 · `uPlot.paths?.bars?.()` May Be Undefined
**File:** `src/components/tool/ChartView.tsx` line 100
**Description:** Optional chaining returns `undefined` which uPlot may throw on for bar charts.
**Fix:** Add runtime check before using bar mode, or fallback to line mode.

---

### H-8 · Wrong Icon on Contact Link
**File:** `src/pages/index.astro` lines 201–207
**Description:** Footer "Contact" link uses `href="mailto:..."` but shows a GitHub icon. Users expect a GitHub link.
**Fix:** Either use an email icon or change the href to GitHub.

---

### H-9 · Inconsistent Email Domains
**Files:** `index.astro` line 202 (`hello@querydrop.app`), `privacy.astro` line 156 (`privacy@querydrop.com`)
**Description:** Different TLDs (`.app` vs `.com`). Site domain is `querydrop.com`.
**Fix:** Standardize to `.com`.

---

### H-10 · Theme Color Mismatch (Manifest vs Layout/CSS)
**Files:** `Layout.astro` line 45 (`#0d0d11`), `manifest.webmanifest` lines 9–10 (`#0a0a0f`)
**Description:** PWA launch shows a color flash.
**Fix:** Set manifest to `#0d0d11`.

---

### H-11 · COEP Header Blocks Google Fonts
**Files:** `public/_headers` line 11, `Layout.astro` lines 70–75
**Description:** `Cross-Origin-Embedder-Policy: require-corp` blocks font stylesheet because it lacks `crossorigin` attribute.
**Fix:** Add `crossorigin` to the font stylesheet `<link>`.

---

### H-12 · Preconnect to fonts.googleapis.com Has Wrong `crossorigin`
**File:** `src/layouts/Layout.astro` line 70
**Description:** The preconnect for the CSS host should NOT have `crossorigin` (it's a no-CORS fetch).
**Fix:** Remove `crossorigin` from the fonts.googleapis.com preconnect.

---

### H-13 · Missing HSTS Header
**File:** `public/_headers`
**Description:** `Strict-Transport-Security` is not set despite LAUNCH.md claiming it is.
**Fix:** Add `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.

---

### H-14 · Privacy Page Claims "Zero Analytics" But Plausible Exists
**Files:** `privacy.astro` line 140, `src/scripts/analytics.ts` lines 48–56
**Description:** Privacy page says "No Plausible" but the site has an opt-in Plausible toggle.
**Fix:** Update privacy page to acknowledge opt-in analytics.

---

### H-15 · JSON-LD Outside `</Layout>` Tag
**Files:** `src/pages/convert.astro` line 156, `src/pages/pivot.astro` line 158
**Description:** JSON-LD `<script>` placed after `</Layout>` renders **after** `</html>` in output = invalid markup + Google can't read it.
**Fix:** Move JSON-LD inside the Layout slot.

---

### H-16 · ExportMenu Eagerly Serializes All Formats
**File:** `src/components/tool/ExportMenu.tsx` lines 109–122
**Description:** The `sizes` useMemo runs `serializeCSV`, `serializeJSON`, `serializeNDJSON`, `serializeMarkdown`, `serializeHTML`, `serializeSQL` every time result changes — even if the menu is never opened. For large results (10K+ rows), this is extremely expensive.
**Fix:** Compute sizes lazily only when the dropdown opens, or use estimates.

---

### H-17 · `openConn` Returns Wrong Type in ViewArea Props
**File:** `src/components/tool/QueryPad.tsx` line 1186
**Description:** `openConn` is typed as returning `Promise<AsyncDuckDBConnection>` but actually returns `Promise<{ db, conn }>` (line 327–333). The ExportMenu expects the `{ db, conn }` shape. This type mismatch works at runtime but the TypeScript type is wrong.
**Fix:** Update the ViewArea prop type to match the actual signature.

---

## Part 3: Medium-Severity Issues

### M-1 · `categorizeType` Misses Parameterized Types
**File:** `src/lib/duckdb/queries.ts` lines 174–188
**Description:** `DECIMAL(10,2)`, `VARCHAR(255)`, etc. don't match exact regex patterns.
**Fix:** Strip parameters before matching: `const base = t.replace(/\(.*\)$/, '').trim()`.

---

### M-2 · `generatePivotSQL` Ignores `rowColumn`
**File:** `src/lib/duckdb/queries.ts` lines 103–109
**Description:** The PivotSpec has `rowColumn` but the generated SQL doesn't use it — the pivot won't group by rows.
**Fix:** Add `GROUP BY ${q(spec.rowColumn)}` and include `rowColumn` in SELECT.

---

### M-3 · Excel `parseExcelSheets` Row Count Off-by-One
**File:** `src/lib/duckdb/excel.ts` lines 33–35
**Description:** Row count includes header row, overreporting by 1.
**Fix:** Subtract header row from count.

---

### M-4 · GeoJSON Property Collisions
**File:** `src/lib/duckdb/geojson.ts` lines 31–35
**Description:** User properties named `_feature_id`, `_geometry`, `_type` are silently overwritten.
**Fix:** Use less collision-prone prefixes like `_geojson_`.

---

### M-5 · `serializeMarkdown` Doesn't Escape Pipe in Headers
**File:** `src/lib/export.ts` line 58
**Description:** Column names with `|` break the markdown table.
**Fix:** `result.columns.map(c => mdEscapeCell(c))`.

---

### M-6 · `sqlTypeFromDuckDB` Matches `INT` Too Broadly
**File:** `src/lib/export.ts` line 234
**Description:** `/INT/.test(t)` matches `INTERVAL`, `POINT`, etc.
**Fix:** Use word boundaries: `/\bINT\b|INTEGER|BIGINT|.../.test(t)`.

---

### M-7 · GZIP Magic Check Only Tests First Byte
**File:** `src/lib/share.ts` lines 51, 62–63
**Description:** Only checks `bytes[0] === 0x1f`. Should check both magic bytes.
**Fix:** `bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b`.

---

### M-8 · `isValidWorkspace` Missing Version and Element Validation
**File:** `src/lib/workspace.ts` lines 40–48
**Description:** No version check, no validation of `files` array elements.
**Fix:** Check `typeof o.v === 'number'` and validate each file entry.

---

### M-9 · Unbounded Workspace Count in localStorage
**File:** `src/lib/workspace.ts` lines 63–93
**Description:** Workspaces grow unbounded. Could exhaust localStorage.
**Fix:** Cap at ~50: `[entry, ...all].slice(0, MAX_WORKSPACES)`.

---

### M-10 · Sample `queryHint` References Wrong Table Names
**File:** `src/lib/samples.ts` lines 49–64
**Description:** Hints reference `sales` and `server_logs` but actual table names include timestamps.
**Fix:** Use dynamic table name references or document that hints are templates.

---

### M-11 · `useEscapeKey` Handler Churn on Every Render
**File:** `src/lib/useEscapeKey.ts` lines 16–28
**Description:** If caller passes inline arrow function, effect re-runs every render.
**Fix:** Use `useRef` for the handler:
```ts
const handlerRef = useRef(handler);
handlerRef.current = handler;
useEffect(() => {
  if (!enabled) return;
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handlerRef.current(); };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}, [enabled]);
```

---

### M-12 · `useFocusTrap` Never Removes Added `tabindex`
**File:** `src/lib/useFocusTrap.ts` lines 57–58
**Description:** Container gets `tabindex="-1"` but it's never cleaned up on deactivation.
**Fix:** Track and remove in cleanup.

---

### M-13 · `column-not-found` Error Regex Too Restrictive
**File:** `src/lib/errorPatterns.ts` line 43 and others
**Description:** `\w+` doesn't match quoted identifiers with spaces/dots.
**Fix:** Use `[^"]+` for identifier captures.

---

### M-14 · Cleaning Ops Error on Non-String Columns
**Files:** `src/lib/cleaning.ts` lines 38–61
**Description:** `TRIM()`, `emptyToNull`, `dropEmptyRows` all fail on non-string columns (INTEGER, etc.).
**Fix:** Filter to string columns only, or add type guards.

---

### M-15 · Button Spinner Is a Square
**File:** `src/components/ui/Button.tsx` line 61
**Description:** Loading spinner uses `rounded-none` — renders as a spinning square.
**Fix:** Change to `rounded-full`.

---

### M-16 · Social Icons Render as Hollow Outlines
**File:** `src/components/ui/Icon.tsx` lines 65–67
**Description:** GitHub/Twitter/Discord icons are filled paths, but parent SVG sets `fill="none"` + `stroke="currentColor"`.
**Fix:** Add `fill="currentColor" stroke="none"` to those specific paths.

---

### M-17 · ExcelSheetPicker Missing Focus Trap
**File:** `src/components/tool/ExcelSheetPicker.tsx` lines 43–104
**Description:** Modal has `role="dialog"` + `aria-modal` but no focus trap.
**Fix:** Add `useFocusTrap(containerRef, true)`.

---

### M-18 · MobileRunBar Missing Focus Trap
**File:** `src/components/tool/MobileRunBar.tsx` lines 90–124
**Description:** Bottom sheet dialog has no focus trap. Keyboard users can Tab out.
**Fix:** Add `useFocusTrap(sheetRef, menuOpen)`.

---

### M-19 · TemplateMenu Missing Arrow Key Navigation
**File:** `src/components/tool/TemplateMenu.tsx` lines 68–106
**Description:** Menu has `role="menu"` but no arrow-key navigation (WAI-ARIA requirement).
**Fix:** Add `onKeyDown` handler with roving tabindex.

---

### M-20 · Three Duplicate `formatBytes` Functions
**Files:** `FormatConverter.tsx:93`, `ExcelSheetPicker.tsx:107`, `SampleLibrary.tsx:18`, `ExportMenu.tsx:90`, `QueryPad.tsx:1767`
**Description:** Five slightly different implementations across the codebase.
**Fix:** Create `src/lib/format.ts` with a single shared utility.

---

### M-21 · SrAnnouncer Drops Intermediate Messages
**File:** `src/components/a11y/SrAnnouncer.tsx` lines 39–51
**Description:** Rapid `announce("Loading")` then `announce("Loaded")` drops "Loading" entirely.
**Fix:** Consider a queue or at minimum document this behavior.

---

### M-22 · SampleLibrary Hardcodes Total Size
**File:** `src/components/tool/SampleLibrary.tsx` line 55
**Description:** `~109 KB` is hardcoded. Will become stale if samples change.
**Fix:** Compute dynamically: `SAMPLES.reduce((s, x) => s + x.sizeBytes, 0)`.

---

### M-23 · `_headers` File Uses Wrong Comment Syntax
**File:** `public/_headers` lines 1–6
**Description:** Uses `/* */` comments but Cloudflare Pages only supports `#` comments.
**Fix:** Replace with `#` comments.

---

### M-24 · No Content-Security-Policy Header
**File:** `public/_headers`
**Description:** No CSP header despite handling user file data.
**Fix:** Add appropriate CSP.

---

### M-25 · Analytics Toggle Missing ARIA
**File:** `src/scripts/analytics.ts` lines 20–28
**Description:** Toggle built with raw DOM has no `role="switch"`, no `aria-checked`. Screen readers can't interact.
**Fix:** Add `role="switch"` and `aria-checked` to the label.

---

### M-26 · Service Worker `cacheFirst` Is Actually Stale-While-Revalidate
**File:** `public/sw.js` lines 73–93
**Description:** Function named `cacheFirst` implements SWR. Misleading.
**Fix:** Rename function to `staleWhileRevalidate`.

---

### M-27 · SW Background Fetch Is Floating Promise
**File:** `public/sw.js` lines 77–81
**Description:** Background fetch is not attached to `event.waitUntil()`. SW may terminate before cache updates.
**Fix:** Attach to `event.waitUntil()`.

---

### M-28 · `ChartView` xCol Duplicated in numericCols
**File:** `src/components/tool/ChartView.tsx` lines 35–38
**Description:** If column 0 is numeric, it appears as both X axis and series.
**Fix:** Exclude index 0: `result.columns.filter((col, i) => i !== 0 && isNumeric(result.columnTypes[i]))`.

---

### M-29 · Duplicate City in `gen_samples.py`
**File:** `scripts/gen_samples.py` lines 61, 97
**Description:** "Buenos Aires" appears twice with identical data.
**Fix:** Remove duplicate or replace with a different city.

---

### M-30 · FormatConverter Temp Table Leaked on Modal Close
**File:** `src/components/tool/FormatConverter.tsx` lines 460–473
**Description:** If user opens converter, loads a file, then closes without converting, the temp table is never cleaned up.
**Fix:** Drop temp table in the `useEffect` cleanup when `open` changes to false.

---

### M-31 · Race Condition in `resetDuckDB`
**File:** `src/lib/duckdb/client.ts` lines 163–174
**Description:** Concurrent calls to `resetDuckDB()` and `getDuckDB()` can cause the old promise to resolve with a terminated DB.
**Fix:** Clear `initPromise` immediately before awaiting.

---

### M-32 · `nav` Element Missing `aria-label`
**File:** `src/pages/index.astro` line 43
**Description:** When there are multiple nav landmarks, screen readers need labels.
**Fix:** Add `aria-label="Main navigation"`.

---

### M-33 · `estimateConvertSize` Returns 0 for Text Formats
**File:** `src/components/tool/FormatConverter.tsx` lines 535–552
**Description:** Only returns estimates for Excel/SQLite/Parquet; all text formats return 0.
**Fix:** Add rough estimates for text formats.

---

### M-34 · No Index Page JSON-LD Structured Data
**File:** `src/pages/index.astro`
**Description:** Convert and pivot pages have JSON-LD, but the main landing page doesn't.
**Fix:** Add `WebApplication` schema.

---

## Part 4: Low-Severity Issues

| # | File | Description |
|---|------|-------------|
| L-1 | `client.ts:36-40` | `unload` event handler fires async `.then()` that may never complete |
| L-2 | `client.ts:145` | `detectFormat` doesn't detect `.tab` files as TSV |
| L-3 | `queries.ts:36` | `QueryOptions.params` defined but never used (dead code) |
| L-4 | `split.ts:36-46` | Block comment nesting not supported (DuckDB supports it) |
| L-5 | `snippets.ts:55-73` | `saveSnippet` allows empty SQL |
| L-6 | `excel.ts:48-59` | Double-reading large Excel files in memory |
| L-7 | `geojson.ts:16` | Large GeoJSON files triple memory usage |
| L-8 | `arrow.ts:22-24` | No friendly error for corrupt Arrow files |
| L-9 | `history.ts:11-22` | `rowCount` type not validated in `isValidItem` |
| L-10 | `export.ts:89-91` | `serializeSQL` inconsistent closing paren formatting |
| L-11 | `export.ts:208-215` | `htmlEscape` doesn't escape single quotes |
| L-12 | `share.ts:50` | `hasCompressionStream` evaluated at module load (breaks SSR) |
| L-13 | `share.ts:87,101` | `decodeShare` silently returns null on version mismatch |
| L-14 | `templates.ts:133-143` | `SQL_RESERVED_WORDS` incomplete |
| L-15 | `workspace.ts:108` | Creates Blob just to check size (inefficient) |
| L-16 | `workspace.ts:126-138` | `importWorkspaceFromFile` doesn't persist |
| L-17 | `useEscapeKey.ts:21` | `e.preventDefault()` blocks browser defaults |
| L-18 | `ChartView.tsx:146` | Identical ternary branches (dead code) |
| L-19 | `ChartView.tsx:129` | Redundant `result` in useEffect deps |
| L-20 | `FormatConverter.tsx:483` | JSON indent=0 produces compact (not pretty) JSON |
| L-21 | `ExcelSheetPicker.tsx:41` | Unstable `onCancel` in useEffect deps |
| L-22 | `PivotBuilder.tsx:34-37` | Dead code useEffect |
| L-23 | `PivotBuilder.tsx:54-55` | Cryptic `aria-label` from virtual table name |
| L-24 | `SampleLibrary.tsx:18-21` | `formatBytes` missing GB tier |
| L-25 | `TemplateMenu.tsx:50-68` | Menu missing `aria-controls` |
| L-26 | `Button.tsx:51` | Inconsistent `rounded-none` vs rest of design |
| L-27 | `OfflineBanner.tsx:112` | Dismiss button missing `rounded` class |
| L-28 | `convert.astro:27` | JSON-LD featureList has duplicates |
| L-29 | `gen_samples.py:135` | Unused `sex_dist` variable (dead code) |
| L-30 | `test/setup.ts:96-111` | `Blob.prototype.stream` polyfill returns wrong type |
| L-31 | `README.md` | Still uses Astro starter template; not project-specific |
| L-32 | `HistoryDropdown.tsx:72` | Dropdown positioned `right-0` may overflow viewport on small screens |
| L-33 | `QueryBuilder.tsx:88-105` | `generateWhere` doesn't quote column names (breaks columns with spaces) |
| L-34 | `QueryBuilder.tsx:128` | `s.name` unquoted in generated SQL — columns with reserved words break |
| L-35 | `QueryPad.tsx:661` | `active?.kind` — should be `active?.state.kind` (wrong property access) |
| L-36 | `QueryPad.tsx:807` | Dropzone `accept` missing `.avro`, `.orc`, `.nc`; "Add another" has them |
| L-37 | `Stores/` | Empty directory — dead weight in the repo |

---

## Part 5: SEO Improvements

### Current SEO Issues
| Issue | File | Priority |
|-------|------|----------|
| Missing OG image (404) | `Layout.astro` | **CRITICAL** |
| 3 nav links to 404 pages | `index.astro` | **CRITICAL** |
| JSON-LD outside `</html>` | `convert.astro`, `pivot.astro` | **HIGH** |
| No JSON-LD on index page | `index.astro` | **MEDIUM** |
| Render-blocking Google Fonts | `Layout.astro` | **MEDIUM** |
| No canonical on index page (implicit) | `index.astro` | **LOW** |
| `tool.astro` has noindex | `tool.astro` | **MEDIUM** (review) |
| Duplicate featureList in JSON-LD | `convert.astro` | **LOW** |

### SEO Enhancements to Implement
1. **Create OG image** — 1200×630 branded image for social shares
2. **Add JSON-LD to index page** — `WebApplication` schema with pricing, features
3. **Move JSON-LD inside Layout slot** — so it renders within `<html>`
4. **Build /guides and /datasets pages** — turn 404s into content that ranks
5. **Non-blocking font loading** — use `preload` + `onload` pattern
6. **Add explicit canonical URLs** — to all pages
7. **Create a blog/content strategy** — target "SQL on CSV", "query Parquet in browser", etc.
8. **Add `lang` attribute** — `<html lang="en">` if not present
9. **Optimize Lighthouse scores** — especially LCP (Google Fonts blocking)
10. **Add Twitter card meta** — ensure `twitter:card`, `twitter:title`, `twitter:description` are correct

---

## Part 6: Product Improvements (Frontend)

### 6.1 · UI/UX Improvements
1. **Confirmation dialog for destructive actions** — Deleting workspaces, clearing history, removing files should prompt "Are you sure?"
2. **Toast notifications** — Replace inline success messages with toast system (export success, workspace saved, clipboard copied)
3. **Dark/light mode toggle** — Currently dark-only; many users prefer light mode for data work
4. **Keyboard shortcut overlay** — Show Cmd+Enter, Escape, etc. hints; add Cmd+S to save snippet
5. **Drag-and-drop reordering** for file chips, columns in query builder
6. **Column resize** in the data table for better data exploration
7. **Full-text search** in results table
8. **Pagination controls** — Currently limited to 100 rows; add proper pagination or "load more"
9. **Split-pane layout** — Resizable editor/results panes
10. **Multi-file query support** — Visual JOIN builder across uploaded files

### 6.2 · Missing Features
1. **Undo/Redo for SQL editor** — CodeMirror has history but no visible undo/redo buttons
2. **Query formatting/prettifying** — Add a "Format SQL" button
3. **Column statistics panel** — Show min/max/mean/nulls/unique count per column
4. **Data profiling** — Automatic data type detection quality, missing values heatmap
5. **Save results locally** — Option to cache query results in IndexedDB
6. **Multiple tabs/queries** — Support running multiple queries in tabs
7. **Auto-save SQL** — Persist current SQL to localStorage on change

### 6.3 · Mobile Improvements
1. **Fix MobileRunBar invisible text** (H-4 above)
2. **Better responsive layout for data tables** — Horizontal scroll is hard on mobile
3. **Swipe gestures** for file chip navigation
4. **Bottom sheet for all menus** — Convert all dropdowns to bottom sheets on mobile

---

## Part 7: Product Improvements (Backend/Logic)

### 7.1 · Performance
1. **Lazy export size calculation** — Don't serialize all formats when ExportMenu isn't open
2. **Web Worker for serialization** — Move CSV/JSON/HTML serialization off main thread
3. **Streaming large exports** — Use streaming for files >10MB to avoid OOM
4. **Connection pooling** — Reuse DuckDB connections instead of connect/close per operation
5. **Cancel running queries** — Implement actual query cancellation (not just Promise rejection)

### 7.2 · Reliability
1. **Input validation** — Validate file sizes before processing (reject >100MB with a clear message)
2. **Retry logic for DuckDB init** — Auto-retry on transient WASM loading failures
3. **Graceful degradation** — Show a proper error page if DuckDB fails to load entirely
4. **Error boundaries** — Wrap major React sections in error boundaries
5. **Type-safe SQL generation** — Use a SQL builder library or parameterized queries everywhere

### 7.3 · Data Handling
1. **Shared `formatBytes` utility** — Eliminate all 5 duplicate implementations
2. **Shared `isNumericType` utility** — Eliminate duplicate type checking
3. **Better GeoJSON support** — Handle GeometryCollection, bare Geometry types
4. **Incremental file processing** — Stream large files instead of `file.text()` / `file.arrayBuffer()`
5. **Arrow file error handling** — Friendly messages for corrupt IPC files

### 7.4 · Security
1. **Content Security Policy** — Add CSP header to block XSS
2. **HSTS header** — Add as documented but missing
3. **Input sanitization audit** — Every SQL interpolation point should use parameterized or quoted identifiers
4. **Subresource Integrity** — Add SRI hashes for external scripts (Plausible)

---

## Part 8: Implementation Plan

### Phase 1: Critical Fixes (1–2 days)
**Goal:** Fix all critical bugs that could cause security issues, broken UX, or invalid HTML.

| Task | Files to Change | Effort |
|------|----------------|--------|
| Fix SQL injection in `sqlForFile` | `queries.ts` | 30min |
| Fix SQL injection in `serializeParquet` | `export.ts` | 30min |
| Fix SQL injection in `FormatConverter` | `FormatConverter.tsx` | 30min |
| Fix SQL injection in `removeFile` | `QueryPad.tsx` | 15min |
| Create OG image file | `public/og-default.png` | 30min |
| Fix nested `<main>` elements | 4 page files | 15min |
| Remove/disable 404 nav links | `index.astro` | 15min |
| Fix MobileRunBar CSS classes | `MobileRunBar.tsx` | 15min |

---

### Phase 2: High-Severity Fixes (2–3 days)
**Goal:** Fix all high-severity bugs affecting UX, accessibility, and reliability.

| Task | Files | Effort |
|------|-------|--------|
| Fix `downloadBlob` URL revocation | `export.ts` | 15min |
| Fix OfflineBanner `autoDismissed` | `OfflineBanner.tsx` | 15min |
| Fix ChartView null/NaN handling | `ChartView.tsx` | 30min |
| Fix social icons fill/stroke | `Icon.tsx` | 15min |
| Fix Button spinner rounded | `Button.tsx` | 5min |
| Fix wrong Contact icon | `index.astro` | 5min |
| Fix email domain inconsistency | `index.astro`, `privacy.astro` | 5min |
| Fix theme color mismatch | `manifest.webmanifest` | 5min |
| Fix COEP font loading | `Layout.astro`, `_headers` | 15min |
| Fix preconnect crossorigin | `Layout.astro` | 5min |
| Add HSTS header | `_headers` | 5min |
| Update privacy page for Plausible | `privacy.astro` | 15min |
| Move JSON-LD inside Layout | `convert.astro`, `pivot.astro` | 10min |
| Fix ExportMenu eager serialization | `ExportMenu.tsx` | 45min |
| Fix `openConn` type mismatch | `QueryPad.tsx` | 10min |
| Fix `arrow.ts` table name validation | `arrow.ts` | 10min |

---

### Phase 3: Medium-Severity Fixes (3–5 days)
**Goal:** Fix all medium issues including accessibility, code quality, and edge cases.

| Task | Files | Effort |
|------|-------|--------|
| Create shared `formatBytes` utility | New `format.ts`, 5 consumers | 1h |
| Create shared `isNumericType` utility | New or `queries.ts`, 2 consumers | 30min |
| Fix `categorizeType` parameterized types | `queries.ts` | 15min |
| Fix `generatePivotSQL` rowColumn | `queries.ts` | 30min |
| Fix `useEscapeKey` handler churn | `useEscapeKey.ts` | 20min |
| Fix `useFocusTrap` tabindex cleanup | `useFocusTrap.ts` | 15min |
| Add focus traps to ExcelSheetPicker, MobileRunBar | 2 files | 30min |
| Add arrow key nav to TemplateMenu | `TemplateMenu.tsx` | 45min |
| Fix error regex patterns | `errorPatterns.ts` | 30min |
| Fix cleaning ops for non-string columns | `cleaning.ts` | 30min |
| Fix gzip magic check | `share.ts` | 5min |
| Fix workspace validation | `workspace.ts` | 20min |
| Cap workspace count | `workspace.ts` | 10min |
| Fix `_headers` comment syntax | `_headers` | 5min |
| Add CSP header | `_headers` | 30min |
| Fix analytics toggle ARIA | `analytics.ts` | 15min |
| Fix SW function naming | `sw.js` | 5min |
| Add nav aria-label | Page files | 10min |
| Fix SampleLibrary hardcoded size | `SampleLibrary.tsx` | 10min |
| Fix FormatConverter temp table leak | `FormatConverter.tsx` | 20min |
| Add JSON-LD to index page | `index.astro` | 20min |
| Fix sample queryHints | `samples.ts` | 15min |
| Fix `sqlTypeFromDuckDB` matching | `export.ts` | 10min |
| Fix markdown header pipe escape | `export.ts` | 10min |
| Fix Excel rowCount off-by-one | `excel.ts` | 10min |
| Fix ChartView xCol duplication | `ChartView.tsx` | 10min |
| Fix gen_samples duplicate city | `gen_samples.py` | 5min |

---

### Phase 4: SEO & Content (1 week)
**Goal:** Maximize search visibility and organic traffic.

| Task | Effort |
|------|--------|
| Create branded OG image (1200×630) | 1h |
| Build `/guides` landing page with 3–5 initial guides | 2 days |
| Build `/datasets` page showcasing sample data | 1 day |
| Build `/pricing` page (free tier + future plans) | 4h |
| Add `WebApplication` JSON-LD to index | 30min |
| Non-blocking Google Fonts | 30min |
| Add PWA raster icons (192, 512, maskable) | 1h |
| Write proper README for the project | 1h |
| Add sitemap exclusion for `/tool` (noindex page) | 15min |

---

### Phase 5: Product Enhancements (2–3 weeks)
**Goal:** Make the product significantly better for users.

**Week 1: Core UX**
- [ ] Add toast notification system
- [ ] Add confirmation dialogs for destructive actions
- [ ] Add "Format SQL" button
- [ ] Add column statistics panel (min/max/mean/nulls)
- [ ] Auto-save SQL to localStorage

**Week 2: Performance & Reliability**
- [ ] Lazy export size calculation
- [ ] Error boundaries for React sections
- [ ] Retry logic for DuckDB init
- [ ] Cancel running queries (close connection)
- [ ] Web Worker for serialization

**Week 3: Advanced Features**
- [ ] Multi-tab query support
- [ ] Full-text search in results
- [ ] Column resize in data table
- [ ] Split-pane resizable layout
- [ ] Improved mobile experience (bottom sheets, swipe gestures)

---

### Phase 6: Long-term Roadmap
- [ ] Light mode / theme toggle
- [ ] Collaborative sharing (via URL encoding improvements)
- [ ] Plugin system for custom transforms
- [ ] SQL query history with diff view
- [ ] Data visualization improvements (more chart types, customization)
- [ ] AI-powered SQL suggestions
- [ ] Browser extension for quick analysis
- [ ] Build out `/guides` with 20+ tutorials for SEO
- [ ] Performance benchmarks page (marketing + SEO)

---

## Quick Reference: File Impact Map

| File | Issues |
|------|--------|
| `QueryPad.tsx` | C-7, H-17, L-35, L-36 |
| `queries.ts` | C-1, H-2, M-1, M-2, L-3 |
| `export.ts` | C-2, H-1, M-5, M-6, L-10, L-11 |
| `FormatConverter.tsx` | C-3, M-30, M-33, L-20 |
| `Layout.astro` | C-4, H-11, H-12 |
| `index.astro` | C-5, C-6, H-8, H-9, M-32, M-34 |
| `client.ts` | M-31, L-1, L-2 |
| `MobileRunBar.tsx` | H-4, M-18 |
| `OfflineBanner.tsx` | H-5, L-27 |
| `ChartView.tsx` | H-6, H-7, M-28, L-18, L-19 |
| `Icon.tsx` | M-16 |
| `Button.tsx` | M-15, L-26 |
| `workspace.ts` | M-8, M-9, L-15, L-16 |
| `ExportMenu.tsx` | H-16 |
| `share.ts` | M-7, L-12, L-13 |
| `cleaning.ts` | M-14 |
| `errorPatterns.ts` | M-13 |
| `useEscapeKey.ts` | M-11, L-17 |
| `useFocusTrap.ts` | M-12 |
| `ExcelSheetPicker.tsx` | M-17, L-21 |
| `TemplateMenu.tsx` | M-19, L-25 |
| `SampleLibrary.tsx` | M-22, L-24 |
| `SrAnnouncer.tsx` | M-21 |
| `_headers` | H-13, M-23, M-24 |
| `privacy.astro` | H-14 |
| `convert.astro` | H-15, L-28 |
| `pivot.astro` | H-15 |
| `manifest.webmanifest` | H-10 |
| `analytics.ts` | M-25 |
| `sw.js` | M-26, M-27 |
| `arrow.ts` | H-3, L-8 |
| `geojson.ts` | M-4, L-7 |
| `excel.ts` | M-3, L-6 |
| `samples.ts` | M-10 |
| `gen_samples.py` | M-29, L-29 |
| `QueryBuilder.tsx` | L-33, L-34 |
| `HistoryDropdown.tsx` | L-32 |
| `test/setup.ts` | L-30 |

---

## Issue Count Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 7 |
| 🟠 HIGH | 17 |
| 🟡 MEDIUM | 34 |
| ⚪ LOW | 37 |
| **Total** | **95** |

---

> **This document is the primary reference for all project changes.** Follow the phased implementation plan above. Each fix includes the exact file, line numbers, and code to change. Do not skip critical or high-severity items.
