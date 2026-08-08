/**
 * Converter page data — one entry per per-format SEO page under /convert/[slug].
 * Each page embeds the same ConverterApp with a preset output format; the copy
 * here is the long-tail search surface ("parquet to csv online", etc.).
 *
 * Copy rules (keep them honest — AdSense + user trust):
 *  - No overclaiming: state real limitations (first sheet only for Excel,
 *    nested JSON becomes JSON-string cells, xlsx row limit, browser memory).
 *  - Each FAQ must answer a question a real user would actually type.
 */

import type { OutputFormat } from '../components/tool/FormatConverter';

export interface ConverterPage {
  slug: string;
  /** Display name of the input format, e.g. "Parquet". */
  from: string;
  /** Display name of the output format, e.g. "CSV". */
  to: string;
  /** OutputFormat key used to preset the embedded converter. */
  toKey: OutputFormat;
  /** <title> tag. */
  title: string;
  /** H1 — carries the exact search phrase. */
  h1: string;
  metaDescription: string;
  /** 2-3 short paragraphs of real content. */
  intro: string[];
  /** 3-4 FAQ entries rendered visibly AND as FAQPage JSON-LD (must match). */
  faqs: { q: string; a: string }[];
  /** Slugs of related converter pages (internal linking). */
  related: string[];
  /** Sample file in /samples that matches this page's input format. */
  sampleHref: string;
  /** One-line caption under the converter card. */
  cardNote: string;
}

const PRIVACY_FAQ = {
  q: 'Is my file uploaded to a server?',
  a: 'No. The converter runs entirely in your browser with DuckDB compiled to WebAssembly. Your file is read from disk, converted in memory, and downloaded back to disk — it never leaves your device, so there is no upload step and no file-size limit imposed by a server.',
} as const;

export const CONVERTER_PAGES: ConverterPage[] = [
  {
    slug: 'parquet-to-csv',
    from: 'Parquet',
    to: 'CSV',
    toKey: 'csv',
    title: 'Parquet to CSV — Convert .parquet to .csv in your browser | QueryDrop',
    h1: 'Parquet to CSV converter',
    metaDescription:
      'Convert Parquet (.parquet) files to CSV in your browser. No upload, no signup, no email gate. DuckDB-powered, handles large files, works offline.',
    intro: [
      'Parquet is a columnar storage format that compresses data aggressively and is fast to scan, which is why Spark, DuckDB, Polars and pandas workflows produce it. The trade-off is that a .parquet file is binary and opaque: you cannot open it in a text editor, and most spreadsheet tools do not read it directly. Converting to CSV gives you a plain-text file that Excel, Google Sheets, and almost every other tool can open.',
      'Most online "parquet to csv" converters make you upload the file to their server first. That is slow for large parquet files and disqualifying if the data is sensitive. QueryDrop reads the parquet file directly in your browser with DuckDB-WASM and writes the CSV on your machine — nothing is uploaded, so there is no waiting on a server and no arbitrary file-size limit.',
    ],
    faqs: [
      {
        q: 'What is a Parquet file?',
        a: 'Parquet is a columnar binary format designed for analytics. It stores each column separately and compresses values by type, which makes files much smaller and queries much faster than CSV for large datasets. The downside is that it is not human-readable and needs a tool like DuckDB, Spark, pandas or a converter to open.',
      },
      {
        q: 'Will my column names and data types be preserved?',
        a: 'Column names are preserved exactly. Data types are preserved during conversion — DuckDB infers each column type from the parquet metadata. Note that CSV itself has no type system: when you open the result in Excel or pandas, numbers and dates will be re-inferred by the reader.',
      },
      PRIVACY_FAQ,
      {
        q: 'How large a parquet file can I convert?',
        a: 'The file is processed in your browser\u2019s memory. On a desktop with 8GB+ of RAM, files in the hundreds of megabytes convert comfortably; very large files (1GB+) work better on desktop Chrome or Firefox than on phones. There is no server-side limit because there is no server.',
      },
    ],
    related: ['csv-to-parquet', 'parquet-to-excel', 'parquet-to-json'],
    sampleHref: '/samples/iris.parquet',
    cardNote: 'Try it: the sample is a 2.7KB iris.parquet — convert it and check the output.',
  },
  {
    slug: 'csv-to-parquet',
    from: 'CSV',
    to: 'Parquet',
    toKey: 'parquet',
    title: 'CSV to Parquet — Convert .csv to .parquet in your browser | QueryDrop',
    h1: 'CSV to Parquet converter',
    metaDescription:
      'Convert CSV files to Parquet in your browser. Smaller files, faster queries, ready for DuckDB, Polars, pandas and Spark. No upload, no signup.',
    intro: [
      'Converting CSV to Parquet is the standard first step before serious analysis: parquet compresses better than gzip-compressed CSV for most real-world data, stores types explicitly, and lets engines like DuckDB, Polars and Spark scan only the columns they need. A 500MB CSV often becomes a 50-150MB parquet file.',
      'The conversion runs entirely in your browser — DuckDB-WASM reads the CSV with automatic type inference and writes a real parquet file using its native COPY TO (FORMAT PARQUET) writer, the same one used in production DuckDB deployments. Nothing is uploaded, so even CSVs containing confidential data can be converted safely.',
    ],
    faqs: [
      {
        q: 'Why would I convert CSV to Parquet?',
        a: 'Three reasons: size (columnar compression is usually much better than CSV), speed (analytics tools read only the columns a query needs), and correctness (types like dates and decimals are stored explicitly instead of re-inferred on every read).',
      },
      {
        q: 'Will the parquet file be smaller than my CSV?',
        a: 'Usually, yes — often 3-10x smaller than the raw CSV, and typically smaller than a gzip-compressed copy of it. Exact savings depend on how repetitive and how wide your data is.',
      },
      PRIVACY_FAQ,
      {
        q: 'Can I convert the parquet back to CSV?',
        a: 'Yes — use the Parquet to CSV converter on this site. Conversion is lossless at the row level, though CSV cannot represent every type explicitly, so dates and large numbers may need re-inference when read back.',
      },
    ],
    related: ['parquet-to-csv', 'excel-to-parquet', 'csv-to-sqlite'],
    sampleHref: '/samples/iris.csv',
    cardNote: 'Try it: the sample iris.csv converts to a ~2.7KB parquet file.',
  },
  {
    slug: 'excel-to-csv',
    from: 'Excel',
    to: 'CSV',
    toKey: 'csv',
    title: 'Excel to CSV — Convert .xlsx to .csv in your browser | QueryDrop',
    h1: 'Excel to CSV converter',
    metaDescription:
      'Convert Excel .xlsx files to CSV in your browser. No upload, no signup. Great for loading spreadsheets into pandas, databases, or legacy tools. First worksheet converted.',
    intro: [
      'CSV is the interchange format that pandas, databases, and almost every legacy system consume, so converting an Excel workbook to CSV is a daily task in data work. QueryDrop reads the .xlsx file locally — parsing it with SheetJS in your browser — and writes a clean RFC 4180 CSV with properly quoted fields.',
      'Because the conversion happens on your device, there is no upload step: the workbook never leaves your machine, which matters when the sheet contains client lists, payroll, or anything you would not paste into a random website.',
    ],
    faqs: [
      {
        q: 'What happens to multiple sheets in my workbook?',
        a: 'The first worksheet is converted. If you need other sheets, split them into separate files first, or use the SQL Tool to load the workbook and export each sheet individually.',
      },
      {
        q: 'Are formulas evaluated?',
        a: 'The converter reads the values stored in the file — for files saved by Excel, that is the last computed value of each cell. Freshly written files with formulas but no saved results may contain empty cells; re-save the file in Excel first to be safe.',
      },
      PRIVACY_FAQ,
      {
        q: 'Do you support .xls (old Excel) files?',
        a: 'Yes — legacy .xls workbooks are supported too, as are .xlsx files. Password-protected workbooks are not supported.',
      },
    ],
    related: ['csv-to-json', 'excel-to-parquet', 'csv-to-sqlite'],
    sampleHref: '/samples/books.xlsx',
    cardNote: 'Try it: the sample books.xlsx converts to a tidy CSV.',
  },
  {
    slug: 'csv-to-json',
    from: 'CSV',
    to: 'JSON',
    toKey: 'json',
    title: 'CSV to JSON — Convert .csv to .json in your browser | QueryDrop',
    h1: 'CSV to JSON converter',
    metaDescription:
      'Convert CSV to JSON (array of objects) in your browser. Header row becomes keys, types are inferred by DuckDB. No upload, no signup.',
    intro: [
      'JSON is what APIs, JavaScript and TypeScript apps, and document databases expect, so converting a CSV export into JSON is a routine step when wiring data into an application. QueryDrop converts each CSV row into a JSON object: the header row becomes the keys, and DuckDB\u2019s type inference decides whether a value is a number, boolean, or string.',
      'The conversion runs in your browser with no upload step, which makes it practical for larger files and for data you are not allowed to share with a third-party converter.',
    ],
    faqs: [
      {
        q: 'What does the JSON output look like?',
        a: 'A single JSON array of objects, one per CSV row — the standard shape for APIs and JSON payloads. For example a 3-row CSV becomes an array of 3 objects with the header cells as keys.',
      },
      {
        q: 'Are numbers detected correctly?',
        a: 'DuckDB infers types while reading the CSV: integers, floats, and booleans are converted to real JSON numbers/booleans; everything else stays a string. Values that look like numbers but have leading zeros (like zip codes) are kept as strings when the inference is ambiguous.',
      },
      PRIVACY_FAQ,
      {
        q: 'Can I convert very large CSV files?',
        a: 'The file is processed in browser memory, so practical limits are set by your device: hundreds of MB on a desktop, less on a phone. There is no server-side quota because there is no server.',
      },
    ],
    related: ['json-to-csv', 'csv-to-parquet', 'csv-to-sqlite'],
    sampleHref: '/samples/iris.csv',
    cardNote: 'Try it: the sample iris.csv becomes an array of 150 objects.',
  },
  {
    slug: 'json-to-csv',
    from: 'JSON',
    to: 'CSV',
    toKey: 'csv',
    title: 'JSON to CSV — Convert .json to .csv in your browser | QueryDrop',
    h1: 'JSON to CSV converter',
    metaDescription:
      'Convert JSON to CSV in your browser — no upload. Works with arrays of objects and JSON Lines (.ndjson). Nested objects become JSON-string cells. Free, no signup.',
    intro: [
      'Exporting API responses or document data to CSV is the fastest way to get JSON into Excel, Google Sheets, or a database. QueryDrop reads an array of JSON objects — or a JSON Lines file, one object per line — flattens each object into a row, and uses the union of all keys as the columns.',
      'The conversion is fully local: DuckDB-WASM parses the JSON in your browser and the CSV is written to your downloads. Nothing is uploaded, which matters for API dumps that contain customer data.',
    ],
    faqs: [
      {
        q: 'What happens to nested objects and arrays?',
        a: 'Nested values are embedded as JSON strings in the cell — for example an address object becomes {"street":"...","city":"..."} in one cell. This keeps the conversion lossless and the CSV valid; you can re-parse those cells in pandas or Excel later if you need the fields as separate columns.',
      },
      {
        q: 'Do you support JSON Lines (NDJSON)?',
        a: 'Yes — files with one JSON object per line (the .ndjson / .jsonl format used by log exports and streaming pipelines) are supported as input, alongside standard arrays of objects.',
      },
      PRIVACY_FAQ,
      {
        q: 'How are the columns chosen?',
        a: 'The column order follows the keys of the first object, then any additional keys found in later objects are appended. Rows missing a key get an empty cell.',
      },
    ],
    related: ['csv-to-json', 'geojson-to-csv', 'parquet-to-csv'],
    sampleHref: '/samples/books.json',
    cardNote: 'Try it: the sample books.json converts to a 30-row CSV.',
  },
  {
    slug: 'csv-to-sqlite',
    from: 'CSV',
    to: 'SQLite',
    toKey: 'sqlite',
    title: 'CSV to SQLite — Convert .csv to a .sqlite3 database in your browser | QueryDrop',
    h1: 'CSV to SQLite converter',
    metaDescription:
      'Convert CSV to a real SQLite database (.sqlite3) in your browser. No upload, no signup. One table per file, ready for the sqlite3 CLI or any app.',
    intro: [
      'A SQLite database is the most portable way to hand off tabular data: one file, no server, queryable with the sqlite3 CLI, Python, and thousands of applications. QueryDrop builds the .sqlite3 file in your browser — the CSV is loaded into DuckDB, types are inferred, and the data is written into a fresh SQLite database with a single table.',
      'The whole conversion happens locally using sql.js (SQLite compiled to WebAssembly), so your CSV never touches a server. That makes it safe to convert payroll, inventory, or other data you would not upload to a random converter.',
    ],
    faqs: [
      {
        q: 'What is in the resulting .sqlite3 file?',
        a: 'A single database with one table named "result", containing your data with inferred column types (INTEGER, REAL, TEXT). You can rename the table or add more with any SQLite tool afterwards.',
      },
      {
        q: 'Can I combine multiple CSV files into one database?',
        a: 'This converter handles one file at a time. For merging several CSVs into one database, load them into the SQL Tool and export the merged result as SQLite.',
      },
      PRIVACY_FAQ,
      {
        q: 'How large a CSV can I convert?',
        a: 'SQLite and the browser can handle hundreds of thousands of rows comfortably; practical limits are your device\u2019s memory. There is no server-side limit because the conversion happens locally.',
      },
    ],
    related: ['csv-to-json', 'excel-to-csv', 'csv-to-parquet'],
    sampleHref: '/samples/iris.csv',
    cardNote: 'Try it: the sample iris.csv becomes a queryable iris.sqlite3 database.',
  },
  {
    slug: 'parquet-to-excel',
    from: 'Parquet',
    to: 'Excel',
    toKey: 'excel',
    title: 'Parquet to Excel — Convert .parquet to .xlsx in your browser | QueryDrop',
    h1: 'Parquet to Excel converter',
    metaDescription:
      'Convert Parquet files to Excel .xlsx in your browser. No upload, no signup. DuckDB reads the parquet, SheetJS writes the workbook — everything stays on your device.',
    intro: [
      'Parquet files come out of data pipelines that run on Spark, DuckDB, or pandas — but the people who need to review the data usually work in Excel. Converting parquet to .xlsx gives you a normal spreadsheet: columns, types, and values in a format anyone can open.',
      'QueryDrop does this entirely in your browser. DuckDB-WASM reads the parquet file natively, and the workbook is written locally with SheetJS. There is no upload step, which matters when the parquet contains sensitive data from a production pipeline.',
    ],
    faqs: [
      {
        q: 'Why can\u2019t I just open the parquet file in Excel?',
        a: 'Excel does not open parquet files directly (only recent Excel 365 builds have experimental support). Converting to .xlsx is the reliable way to review a parquet dataset in a spreadsheet.',
      },
      {
        q: 'What is the row limit?',
        a: 'Excel worksheets cap out at 1,048,576 rows and 16,384 columns. If your parquet file exceeds that, the export will fail — split the file or summarize it with SQL first.',
      },
      PRIVACY_FAQ,
      {
        q: 'Are data types preserved in the workbook?',
        a: 'Numbers, booleans, dates, and text map to native Excel cell types. Values that Excel cannot represent (like large binary blobs) are stored as text.',
      },
    ],
    related: ['parquet-to-csv', 'excel-to-parquet', 'parquet-to-json'],
    sampleHref: '/samples/iris.parquet',
    cardNote: 'Try it: the sample iris.parquet becomes a 150-row spreadsheet.',
  },
  {
    slug: 'parquet-to-json',
    from: 'Parquet',
    to: 'JSON',
    toKey: 'json',
    title: 'Parquet to JSON — Convert .parquet to .json in your browser | QueryDrop',
    h1: 'Parquet to JSON converter',
    metaDescription:
      'Convert Parquet to JSON (array of objects) in your browser. Struct columns become nested objects, types are preserved. No upload, no signup.',
    intro: [
      'Moving data from a parquet pipeline into a JSON-consuming application (an API, a web app, a document store) is a common integration task. QueryDrop reads the parquet file with DuckDB-WASM and produces a JSON array of objects — one object per row, with column names as keys and types preserved: numbers stay numbers, dates become ISO strings, and nested struct columns become nested JSON objects.',
      'Everything runs in your browser: the parquet file is read from disk, converted in memory, and the JSON is written back to your downloads. No upload step, no server, no signup.',
    ],
    faqs: [
      {
        q: 'What does the JSON output look like?',
        a: 'An array of objects, one per row, with parquet column names as keys. Nested struct columns are rendered as nested objects, and list columns as arrays, so complex parquet schemas survive the trip without flattening.',
      },
      {
        q: 'How are dates and numbers serialized?',
        a: 'Numbers keep their numeric type, booleans stay booleans, and timestamps become ISO 8601 strings. This matches what JSON APIs conventionally emit, so the output is usually drop-in ready.',
      },
      PRIVACY_FAQ,
      {
        q: 'Is this lossless for large parquet files?',
        a: 'The conversion is faithful to the data, but the JSON file will be much larger than the parquet — JSON is a verbose text format. For very large datasets, expect the output to take several times the parquet\u2019s size on disk.',
      },
    ],
    related: ['parquet-to-csv', 'json-to-csv', 'parquet-to-excel'],
    sampleHref: '/samples/iris.parquet',
    cardNote: 'Try it: the sample iris.parquet becomes a 150-object JSON array.',
  },
  {
    slug: 'excel-to-parquet',
    from: 'Excel',
    to: 'Parquet',
    toKey: 'parquet',
    title: 'Excel to Parquet — Convert .xlsx to .parquet in your browser | QueryDrop',
    h1: 'Excel to Parquet converter',
    metaDescription:
      'Convert Excel .xlsx files to Parquet in your browser. Columnar compression, explicit types, ready for DuckDB, Polars and pandas. No upload, no signup.',
    intro: [
      'If a spreadsheet is destined for real analytics work — DuckDB, Polars, pandas, or a data warehouse — converting it to parquet first pays off: parquet is compressed, typed, and columnar, so files are smaller and queries are faster than working with the raw .xlsx.',
      'QueryDrop converts the first worksheet of your workbook into a genuine parquet file using DuckDB\u2019s native writer, all inside your browser. The workbook is parsed locally and never uploaded, so even confidential sheets can be converted.',
    ],
    faqs: [
      {
        q: 'Which sheet is converted?',
        a: 'The first worksheet in the workbook. If your data lives in another sheet, reorder the sheets in Excel first or save that sheet as its own file.',
      },
      {
        q: 'Will formulas be evaluated?',
        a: 'The converter reads the stored values of the workbook — the last computed results saved by Excel. If cells are empty because a formula has never been calculated, open and re-save the file in Excel first.',
      },
      PRIVACY_FAQ,
      {
        q: 'Is Excel row data converted faithfully?',
        a: 'Yes — values, column names, and types are read from the workbook and written into the parquet schema. Text stays text, numbers stay numbers, dates are preserved as timestamps.',
      },
    ],
    related: ['csv-to-parquet', 'parquet-to-excel', 'excel-to-csv'],
    sampleHref: '/samples/books.xlsx',
    cardNote: 'Try it: the sample books.xlsx becomes a small, fast parquet file.',
  },
  {
    slug: 'geojson-to-csv',
    from: 'GeoJSON',
    to: 'CSV',
    toKey: 'csv',
    title: 'GeoJSON to CSV — Convert .geojson to .csv in your browser | QueryDrop',
    h1: 'GeoJSON to CSV converter',
    metaDescription:
      'Convert GeoJSON to CSV in your browser — no upload. Feature properties become columns, geometry becomes a JSON-string column. Free, no signup.',
    intro: [
      'GeoJSON is the standard format for exchanging geographic data, but when the job is reporting, dashboards, or loading into a non-GIS tool, CSV is what the rest of the stack expects. QueryDrop converts each feature\u2019s properties into columns, with the geometry (point, line, or polygon) stored as a JSON string in a "geometry" column — lossless and spreadsheet-friendly.',
      'The conversion runs entirely in your browser: the .geojson file is read locally, converted via DuckDB-WASM, and the CSV is written to your downloads. Nothing is uploaded, so sensitive location data stays on your machine.',
    ],
    faqs: [
      {
        q: 'What happens to the geometry column?',
        a: 'Each feature\u2019s geometry is embedded as a JSON string (e.g. {"type":"Point","coordinates":[77.59,12.97]}) in a "geometry" column. You can re-parse it into GeoJSON later, or use tools like QGIS to convert it back when needed.',
      },
      {
        q: 'Do nested properties become columns?',
        a: 'Top-level properties become columns; nested property objects are embedded as JSON strings in their cell, so no data is lost.',
      },
      PRIVACY_FAQ,
      {
        q: 'Can I convert GeoJSON with polygons and multi-geometries?',
        a: 'Yes — Point, LineString, Polygon, MultiPolygon and all other geometry types are supported; they are simply serialized as JSON strings in the geometry column.',
      },
    ],
    related: ['json-to-csv', 'csv-to-json', 'parquet-to-csv'],
    sampleHref: '/samples/cities.geojson',
    cardNote: 'Try it: the sample cities.geojson converts to a 5-row CSV of Indian cities.',
  },
];

/** slug -> page lookup for related-links resolution. */
export const CONVERTER_BY_SLUG: Record<string, ConverterPage> = Object.fromEntries(
  CONVERTER_PAGES.map((p) => [p.slug, p]),
);
