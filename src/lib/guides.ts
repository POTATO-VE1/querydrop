/**
 * Guide data — one entry per article under /guides/[slug].
 * These are the content pages AdSense reviewers (and Google) judge the site
 * on, so the copy is written to be useful first: real steps, honest limits,
 * no padding.
 */

export interface GuideSection {
  heading: string;
  paragraphs: string[];
}

export interface Guide {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  intro: string[];
  sections: GuideSection[];
  faqs: { q: string; a: string }[];
  /** Slugs of converter pages to link from the guide. */
  relatedConverters: string[];
  /** Epoch ms — set to the publish date. */
  updatedAt: string;
}

export const GUIDES: Guide[] = [
  {
    slug: 'how-to-open-parquet-files',
    title: 'How to Open a Parquet File (7 Ways, No Install) | QueryDrop',
    metaDescription:
      'Parquet files can\'t be opened in a text editor or Excel. Here are 7 ways to open, view, and query them — including browser tools that never upload your file.',
    h1: 'How to open a Parquet file',
    intro: [
      'Parquet is the most common format in modern data pipelines, but it is also one of the least friendly to open. A .parquet file is binary, columnar, and compressed — double-clicking it does nothing useful, and opening it in a text editor shows garbage. This guide covers every practical way to open one, from zero-install browser tools to the command line.',
    ],
    sections: [
      {
        heading: 'Why parquet files are hard to open',
        paragraphs: [
          'Parquet stores data column-by-column, not row-by-row like CSV. That design makes it fast to scan and small on disk, but it means the file needs a library or engine to decode it. Excel cannot read parquet directly (only very recent Excel 365 builds have partial support), and text editors show compressed binary data.',
        ],
      },
      {
        heading: '1. In your browser with QueryDrop (zero install)',
        paragraphs: [
          'The fastest way to look inside a parquet file is a browser tool that reads it locally. QueryDrop runs DuckDB-WASM in your browser tab: drop the .parquet file, and the engine reads it without uploading it anywhere. You get a table preview immediately, and you can run SQL on it or convert it to CSV, Excel, or JSON with one click.',
          'Because the file never leaves your device, this also works for the files you are not allowed to upload — client data, internal exports, anything confidential.',
        ],
      },
      {
        heading: '2. DuckDB CLI',
        paragraphs: [
          'If you have a terminal, DuckDB is the easiest local option: `duckdb` then `SELECT * FROM \'data.parquet\' LIMIT 10;`. DuckDB reads parquet natively, no schema declaration needed, and it is a single binary on every platform.',
        ],
      },
      {
        heading: '3. Python (pandas + pyarrow)',
        paragraphs: [
          'Python users can open a parquet file in three lines: `import pandas as pd; df = pd.read_parquet(\'data.parquet\')`. That needs pyarrow installed, but pandas then gives you the usual dataframe workflow, and `df.to_csv()` converts the file in one call.',
        ],
      },
      {
        heading: '4. Polars',
        paragraphs: [
          'Polars reads parquet natively and is significantly faster than pandas on large files: `pl.read_parquet(\'data.parquet\')`. If your parquet files are in the hundreds of megabytes, Polars is the comfortable option.',
        ],
      },
      {
        heading: '5. parquet-tools (command line)',
        paragraphs: [
          'Apache\'s parquet-tools can inspect schema and dump rows: `parquet-tools show data.parquet`. It is not the prettiest output, but it is useful for quick checks of schema and row counts.',
        ],
      },
      {
        heading: '6. Spark or a data warehouse',
        paragraphs: [
          'If the parquet file lives in a data lake, Spark (Databricks, EMR) and warehouses like BigQuery, Snowflake, or Redshift all read parquet directly. For a one-off file this is overkill, but if the file is part of a pipeline you already run, it is where the data already lives.',
        ],
      },
      {
        heading: '7. Convert it to CSV and open in Excel',
        paragraphs: [
          'When the goal is a spreadsheet, converting to CSV is the pragmatic path: use QueryDrop\'s parquet-to-csv converter (no upload), or `df.to_csv()` in pandas, then open the CSV in Excel or Google Sheets.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is there a Windows or macOS parquet viewer?',
        a: 'There is no mainstream double-click viewer for parquet. Browser tools like QueryDrop work on any OS with zero install; on the command line, DuckDB or parquet-tools cover both Windows and macOS.',
      },
      {
        q: 'Why is my parquet file so much smaller than the CSV?',
        a: 'Parquet compresses each column using type-specific encodings. Real-world data compresses 3-10x smaller than CSV, which is a large part of why pipelines use it.',
      },
      {
        q: 'Can I open parquet in Excel?',
        a: 'Standard Excel does not open parquet. Convert the file to CSV first (which preserves the data, though Excel will re-infer types), or use Power Query in recent Excel 365 versions, which has experimental parquet support.',
      },
    ],
    relatedConverters: ['parquet-to-csv', 'parquet-to-excel', 'parquet-to-json'],
    updatedAt: '2026-08-08',
  },
  {
    slug: 'parquet-vs-csv',
    title: 'Parquet vs CSV: Which Format Should You Use? | QueryDrop',
    metaDescription:
      'CSV is universal but wasteful. Parquet is fast and small but opaque. A practical comparison of size, speed, types, and tooling — and when each one wins.',
    h1: 'Parquet vs CSV: which format should you use?',
    intro: [
      'Every data worker eventually faces this choice. CSV has been the universal interchange format for decades; parquet is the format modern analytics engines prefer. The right answer depends on what you are doing with the file, so this is a practical comparison — storage size, query speed, data types, and who can open the result.',
    ],
    sections: [
      {
        heading: 'The core difference: rows vs columns',
        paragraphs: [
          'CSV stores data row by row, like a printed table. Parquet stores each column as a separate, compressed block. That single structural difference drives everything else: columnar storage lets an engine read only the columns a query touches, which is why parquet queries are dramatically faster on wide tables.',
        ],
      },
      {
        heading: 'Size',
        paragraphs: [
          'Parquet typically compresses to 10-30% of the CSV size, often beating gzipped CSV. The exact ratio depends on the data — repetitive values compress best — but for any real dataset, parquet wins on disk space.',
        ],
      },
      {
        heading: 'Speed',
        paragraphs: [
          'For analytics (aggregations, filters over a subset of columns), parquet is routinely 10-100x faster than CSV because the engine skips entire columns and can use per-block statistics to skip chunks of rows. For single-row lookups or small files, the difference is negligible.',
        ],
      },
      {
        heading: 'Types',
        paragraphs: [
          'CSV has no types — every value is text until something parses it, and parsers guess. Parquet stores explicit types (int64, timestamp, decimal), so data read back is exactly what was written. This eliminates a whole class of bugs around dates, leading zeros, and large numbers.',
        ],
      },
      {
        heading: 'Human readability and tooling',
        paragraphs: [
          'CSV wins here, decisively. You can open it in Notepad, Excel, or any script in any language. Parquet needs an engine: DuckDB, pandas, Polars, Spark, or a browser tool like QueryDrop. For interchange with non-technical people, CSV remains the safe choice.',
        ],
      },
      {
        heading: 'When to use which',
        paragraphs: [
          'Use parquet when: the file is large, you will query it repeatedly, it feeds an analytics pipeline, or you need types preserved. Use CSV when: you are exchanging data with people or tools that only read CSV, the file is small, or it is a one-time handoff. When in doubt, keep the source of truth in parquet and generate CSV exports on demand.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is parquet always smaller than CSV?',
        a: 'Almost always, yes — usually 3-10x smaller. Tiny files (a few KB) may not shrink much because of parquet\'s per-file overhead.',
      },
      {
        q: 'Can I edit a parquet file by hand?',
        a: 'No. Parquet is a binary format; you edit it through an engine. The practical workflow is to query or transform with DuckDB/pandas and write a new file.',
      },
      {
        q: 'Which format does pandas prefer?',
        a: 'pandas works with both, but read_parquet is faster and preserves types. If your data lives in pandas, parquet is the better storage format and CSV is the better export format.',
      },
    ],
    relatedConverters: ['parquet-to-csv', 'csv-to-parquet'],
    updatedAt: '2026-08-08',
  },
  {
    slug: 'query-csv-with-sql-online',
    title: 'How to Query a CSV with SQL (Without Uploading It) | QueryDrop',
    metaDescription:
      'Run real SQL on CSV files in your browser — no upload, no database setup. Step-by-step with example queries, including joining two CSVs.',
    h1: 'How to query a CSV file with SQL',
    intro: [
      'Excel filters work until they do not — and for real questions, SQL is faster to write and faster to run. You do not need a database server or even an upload step: modern WebAssembly engines run the query in your browser on the file you already have.',
    ],
    sections: [
      {
        heading: 'Why SQL instead of Excel filters',
        paragraphs: [
          'SQL answers questions in one statement: group by a column and sum another, join two files on a key, rank rows, compute running totals. Doing the same in a spreadsheet is multiple steps and easy to get wrong. SQL is also reproducible — the query is documentation of what you did.',
        ],
      },
      {
        heading: 'The upload problem',
        paragraphs: [
          'Most online SQL tools make you upload your CSV to their server first. That is slow for big files and a non-starter for anything with personal or business data in it. QueryDrop runs DuckDB in your browser instead: the file is read from your disk, queried locally, and nothing is transmitted.',
        ],
      },
      {
        heading: 'Step by step',
        paragraphs: [
          'Open the QueryDrop tool, drop your CSV, and a table is registered with the file\'s name. The editor is preloaded with `SELECT * FROM <file> LIMIT 100` so you can see the shape of the data, then you replace it with your real query and hit Run. Results render in a table and can be exported to CSV, Excel, JSON, SQLite, or Parquet.',
        ],
      },
      {
        heading: 'Example queries that cover most use cases',
        paragraphs: [
          'Totals per group: `SELECT region, SUM(revenue) FROM sales GROUP BY region ORDER BY 2 DESC`. Filtering: `SELECT * FROM orders WHERE status = \'shipped\' AND total > 1000`. Joining two CSVs: `SELECT * FROM customers c JOIN orders o ON c.id = o.customer_id` — just drop both files first. Window functions, pivots, and date bucketing all work the same way.',
        ],
      },
      {
        heading: 'Other browser options',
        paragraphs: [
          'The DuckDB official shell (shell.duckdb.org) runs the same engine without file-upload tooling around it, and SQLite-based tools like sqliteonline.com cover SQLite-flavored SQL. QueryDrop adds file conversion, charts, and export to nine formats on top.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can I join two CSV files?',
        a: 'Yes. Drop both files, then write a JOIN using the registered table names — the same SQL you would write against a database.',
      },
      {
        q: 'Is the query actually free and unlimited?',
        a: 'Yes. The engine runs on your device, so there is no server quota. Very large result sets are capped at 50,000 rows in the table view to protect your browser\'s memory; exports warn you if a result was truncated.',
      },
      {
        q: 'What SQL features are supported?',
        a: 'The full DuckDB dialect: joins, aggregations, window functions, CTEs, pivot, date/time functions, JSON functions, and more.',
      },
    ],
    relatedConverters: ['csv-to-json', 'csv-to-parquet', 'csv-to-sqlite'],
    updatedAt: '2026-08-08',
  },
  {
    slug: 'excel-to-csv-what-carries-over',
    title: 'Excel to CSV: What Carries Over and What Doesn\'t | QueryDrop',
    metaDescription:
      'Formulas become values, formatting vanishes, only the first sheet converts. What survives, what doesn\'t, and how to convert safely.',
    h1: 'Excel to CSV: what carries over and what doesn\'t',
    intro: [
      'CSV is the lingua franca of data — pandas, databases, and legacy systems all want it. But converting an Excel workbook to CSV is not lossless, and the surprises usually show up after the file is gone. Here is exactly what survives, what does not, and how to convert without losing data.',
    ],
    sections: [
      {
        heading: 'What survives the conversion',
        paragraphs: [
          'Cell values, row and column positions, and text encoding survive. Numbers stay numbers (Excel\'s numeric precision is preserved as text), dates become text in most converters, and empty cells become empty values. Column headers carry over as the first row, which is what makes the CSV useful to tools like pandas.',
        ],
      },
      {
        heading: 'What does not survive',
        paragraphs: [
          'Formulas are gone — CSV stores the last computed value, not the formula. Formatting is gone (colors, fonts, column widths, merged cells). Charts, images, pivot tables, macros, and data validation are gone entirely. If any of those matter, keep the .xlsx as the master file and treat the CSV as an export.',
        ],
      },
      {
        heading: 'The first-sheet rule',
        paragraphs: [
          'Most converters, QueryDrop included, convert the first worksheet only. If your data lives on the second or third sheet, reorder the sheets in Excel first, or save the target sheet as its own workbook before converting.',
        ],
      },
      {
        heading: 'The leading-zero trap',
        paragraphs: [
          'Values like zip codes or employee IDs that start with zero are the classic CSV casualty. Excel may store them as numbers (dropping the zero), or a converter may emit them as numbers, and the receiving system then misreads them. If your data has leading-zero identifiers, check them in the output — and consider exporting from Excel with the column explicitly formatted as text.',
        ],
      },
      {
        heading: 'How to convert safely',
        paragraphs: [
          'QueryDrop converts the first sheet in your browser with no upload: drop the .xlsx, choose CSV, download. For files with sensitive data, that no-upload property is the point — the workbook never leaves your machine. After converting, open the CSV and spot-check the rows that are likely to break: dates, leading zeros, and long numbers.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Do formulas convert to their results?',
        a: 'CSV stores values, not formulas. You get the last computed value Excel saved in the file. If cells are empty because a formula was never calculated, re-save the workbook in Excel first.',
      },
      {
        q: 'What happens to my multiple sheets?',
        a: 'Only the first worksheet is converted. Move the sheet you need to the first position, or convert each sheet separately.',
      },
      {
        q: 'Will I lose leading zeros in IDs?',
        a: 'Possibly — it depends on how Excel stored them. Check ID columns in the output; if zeros are missing, format the column as text in Excel and re-export.',
      },
    ],
    relatedConverters: ['excel-to-csv', 'excel-to-parquet', 'csv-to-json'],
    updatedAt: '2026-08-08',
  },
  {
    slug: 'sqlite-vs-duckdb',
    title: 'SQLite vs DuckDB: Which Is Right for Your Data? | QueryDrop',
    metaDescription:
      'Both are embedded SQL engines with zero setup, built for different jobs: SQLite for apps, DuckDB for analytics on big files. A practical comparison.',
    h1: 'SQLite vs DuckDB: which is right for your data?',
    intro: [
      'SQLite and DuckDB are both embedded SQL engines — no server, no installation, just a library (or a file) that speaks SQL. Beyond that they diverge sharply. This guide explains the difference in plain terms and when to reach for each.',
    ],
    sections: [
      {
        heading: 'The one-paragraph difference',
        paragraphs: [
          'SQLite is a row-oriented OLTP database: built for many small reads and writes, transactions, and being embedded inside applications. DuckDB is a column-oriented OLAP engine: built for analytical queries over large files, where you scan millions of rows and aggregate. Same SQL syntax family, opposite workloads.',
        ],
      },
      {
        heading: 'SQLite\'s strengths',
        paragraphs: [
          'SQLite is the most widely deployed database in the world — it is inside phones, browsers, and desktop apps. It handles concurrent writers, has rock-solid transactions, and its single-file format is a portable standard you can hand to almost any tool. For application storage — settings, user data, a small app database — SQLite is the answer.',
        ],
      },
      {
        heading: 'DuckDB\'s strengths',
        paragraphs: [
          'DuckDB reads Parquet natively, runs aggregations over hundreds of millions of rows on a laptop, and is designed for exactly the work data analysts do: querying CSV, Parquet, and JSON files that live on disk, without loading them into a database first. Columnar storage makes its GROUP BY and JOIN queries orders of magnitude faster than SQLite on the same data.',
        ],
      },
      {
        heading: 'How to choose',
        paragraphs: [
          'Choose SQLite when: the data is your application\'s working state, you need transactions, or you are shipping a database inside software. Choose DuckDB when: the data is a file you analyze (CSV, Parquet, Excel), the queries are aggregations, or the file is too big for a spreadsheet. Many projects legitimately use both — SQLite for the app, DuckDB for the analytics.',
        ],
      },
      {
        heading: 'Both run in your browser',
        paragraphs: [
          'QueryDrop embeds DuckDB for querying and converting files, and uses SQLite (compiled to WebAssembly) for the CSV-to-SQLite export — so you can try both engines on your own files with zero installs and zero uploads.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can DuckDB read SQLite files?',
        a: 'Yes — DuckDB has an SQLite extension that attaches and queries .sqlite3 files directly. In QueryDrop, the SQLite direction works the other way: you export query results as a .sqlite3 database.',
      },
      {
        q: 'Is DuckDB a drop-in replacement for SQLite?',
        a: 'No. The SQL is similar but not identical, and DuckDB is not designed for high-concurrency writes. Think of them as different tools that share a language.',
      },
      {
        q: 'Which is faster for large CSV files?',
        a: 'DuckDB, by a wide margin — columnar storage and parallel scanning make aggregations over large files dramatically faster than SQLite\'s row-oriented engine.',
      },
    ],
    relatedConverters: ['csv-to-sqlite', 'csv-to-parquet', 'parquet-to-csv'],
    updatedAt: '2026-08-08',
  },
];

export const GUIDE_BY_SLUG: Record<string, Guide> = Object.fromEntries(
  GUIDES.map((g) => [g.slug, g]),
);
