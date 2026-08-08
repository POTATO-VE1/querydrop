/**
 * Sample Data Library manifest.
 * Each sample is a small synthetic file shipped under /public/samples/.
 * Click-to-load from the empty state — no upload, no setup, instant "aha".
 */

import type { FileFormat } from './duckdb/types';

export interface Sample {
  id: string;
  name: string;
  description: string;
  filename: string;
  sizeBytes: number;
  format: FileFormat;
  /** Template SQL hint shown in the UI. Note: actual table names may include
   *  a timestamp suffix appended during registration (e.g. `iris_1717700000`),
   *  so these hints are illustrative templates, not exact runnable queries. */
  queryHint: string;
}

export const SAMPLES: Sample[] = [
  {
    id: 'iris',
    name: 'Iris flowers',
    description: '150 rows · 4 measurements · 3 species',
    filename: 'iris.csv',
    sizeBytes: 3859,
    format: 'csv',
    queryHint: 'SELECT species, COUNT(*) FROM iris GROUP BY species',
  },
  {
    id: 'cities',
    name: 'World cities',
    description: '60 cities · population · coordinates',
    filename: 'cities.csv',
    sizeBytes: 2267,
    format: 'csv',
    queryHint: 'SELECT country, SUM(population) FROM cities GROUP BY country ORDER BY 2 DESC',
  },
  {
    id: 'titanic',
    name: 'Titanic passengers',
    description: '220 rows · survival · demographics',
    filename: 'titanic.csv',
    sizeBytes: 15318,
    format: 'csv',
    queryHint: 'SELECT pclass, AVG(age), SUM(survived) FROM titanic GROUP BY pclass',
  },
  {
    id: 'sales',
    name: 'Q1 2024 sales',
    description: '500 orders · revenue · channels',
    filename: 'sales-q1.csv',
    sizeBytes: 40110,
    format: 'csv',
    queryHint: 'SELECT region, SUM(revenue) FROM sales_q1 GROUP BY region ORDER BY 2 DESC',
  },
  {
    id: 'logs',
    name: 'Server logs',
    description: '200 entries · status codes · latency',
    filename: 'server-logs.ndjson',
    sizeBytes: 44218,
    format: 'ndjson',
    queryHint: 'SELECT path, AVG(duration_ms) FROM server_logs WHERE status >= 500 GROUP BY path',
  },
  {
    id: 'books',
    name: 'Project Gutenberg',
    description: '30 public-domain books · metadata',
    filename: 'books.json',
    sizeBytes: 5482,
    format: 'json',
    queryHint: 'SELECT subject, COUNT(*) FROM books GROUP BY subject ORDER BY 2 DESC',
  },
];

export function getSampleByFilename(filename: string): Sample | undefined {
  return SAMPLES.find((s) => s.filename === filename);
}
