/**
 * DuckDB-WASM type contracts for QueryDrop.
 * Keep this file framework-agnostic — no React/DOM imports.
 */

import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

/** Status of the DuckDB client lifecycle. */
export type DuckDBStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; progress?: number; message?: string }
  | { kind: 'ready'; db: AsyncDuckDB; buildUsed: 'eh' | 'mvp' }
  | { kind: 'error'; error: Error };

/** A query result in our domain — Arrow table → plain JS rows. */
export interface QueryResult<TRow = Record<string, unknown>> {
  columns: string[];
  columnTypes: string[];
  rows: TRow[];
  /** Total rows in the result set. */
  rowCount: number;
  /** True when rows were capped (see MAX_RESULT_ROWS in queries.ts). */
  truncated?: boolean;
  durationMs: number;
  bytesScanned: number | null;
}

/** Options for query execution. */
export interface QueryOptions {
  /** Hard timeout in ms. Query is cancelled after this. Default 30_000. */
  timeoutMs?: number;
  /** Max rows to materialize into JS. Default MAX_RESULT_ROWS. Pass
   *  Infinity for paths that must serialize the full result (converter). */
  maxRows?: number;
}

/** A registered file (handle) inside DuckDB. */
export interface RegisteredFile {
  /** Virtual filename inside DuckDB (e.g., 'data.csv'). */
  virtualName: string;
  /** Original filename as dropped by the user. */
  originalName: string;
  /** Size in bytes. */
  sizeBytes: number;
  /** Detected format. */
  format: FileFormat;
}

/** All file formats we support. DuckDB-WASM has no read_avro/read_orc/read_netcdf,
 *  so those are omitted. arrow/feather use apache-arrow + insertArrowTable, excel
 *  is pre-converted via SheetJS, geojson is flattened to NDJSON. */
export type FileFormat =
  | 'csv'
  | 'tsv'
  | 'json'
  | 'ndjson'
  | 'excel'
  | 'parquet'
  | 'feather'
  | 'arrow'
  | 'geojson'
  | 'unknown';

/** Human-friendly column type categories for UI coloring. */
export type ColumnCategory =
  | 'integer'
  | 'number'
  | 'text'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'complex'
  | 'blob'
  | 'uuid'
  | 'null'
  | 'other';

/** A single column's metadata. */
export interface ColumnInfo {
  name: string;
  /** Raw DuckDB type name (e.g., 'VARCHAR', 'BIGINT', 'TIMESTAMP'). */
  type: string;
  /** Friendly category for UI styling. */
  category: ColumnCategory;
  nullable: boolean;
}

export interface ColumnStats {
  columnName: string;
  min: string;
  max: string;
  approxUnique: number;
  avg: number | null;
  nullPercentage: number;
}

/** Schema + stats for a registered table. */
export interface TableMetadata {
  tableName: string;
  columns: ColumnInfo[];
  totalRowCount: number;
  stats?: ColumnStats[];
}

/** A recorded query for the history dropdown (persisted in localStorage). */
export interface QueryHistoryItem {
  /** Stable unique id (crypto.randomUUID). */
  id: string;
  /** The SQL the user executed. */
  sql: string;
  /** Virtual table names that were loaded when this query ran. */
  virtualNames: string[];
  /** Row count (null on error or pure DDL). */
  rowCount: number | null;
  /** Wall-clock duration in ms. */
  durationMs: number;
  /** Epoch ms when the query finished. */
  ts: number;
  /** True if the query completed without error. */
  success: boolean;
  /** Error message when success is false. */
  error?: string;
}

/** A user-saved named query (persisted in localStorage, separate from history). */
export interface QuerySnippet {
  /** Stable unique id (crypto.randomUUID). */
  id: string;
  /** User-provided short name (1-50 chars). */
  name: string;
  /** The SQL the user saved. */
  sql: string;
  /** Epoch ms when the snippet was first created. */
  createdAt: number;
  /** Epoch ms when the snippet was last renamed. */
  updatedAt: number;
}

/** Aggregation function for a pivot operation. */
export type PivotAggregation = 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX';

/** A user-specified pivot configuration (UI → SQL). */
export interface PivotSpec {
  /** Column whose unique values become pivot rows. */
  rowColumn: string;
  /** Column whose top-N unique values become pivot columns. */
  colColumn: string;
  /** Column to aggregate. */
  valueColumn: string;
  /** Aggregation function applied to valueColumn. */
  aggregation: PivotAggregation;
  /** Max unique values of colColumn to pivot (top-N by frequency). Default 20. */
  maxCols?: number;
}

export type { AsyncDuckDB, AsyncDuckDBConnection };
