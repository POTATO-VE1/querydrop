/**
 * Typed query helpers — DuckDB Arrow results → plain JS objects.
 */

import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import * as arrow from 'apache-arrow';
import type { ColumnCategory, ColumnInfo, ColumnStats, FileFormat, PivotSpec, QueryOptions, QueryResult, TableMetadata } from './types';

export type { ColumnCategory };
import { splitStatements } from './split';

const DEFAULT_TIMEOUT_MS = 30_000;
/** Cap on rows materialized into JS — beyond this the tab would OOM. */
const MAX_RESULT_ROWS = 50_000;
/** Skip per-column stats above this row count (SUMMARIZE is a full scan). */
const STATS_MAX_ROWS = 200_000;

/** Generate the SQL needed to read a registered file as a table. */
export function sqlForFile(virtualName: string, format: FileFormat): string {
  const escaped = virtualName.replace(/'/g, "''");
  switch (format) {
    case 'csv':
      return `SELECT * FROM read_csv_auto('${escaped}')`;
    case 'tsv':
      return `SELECT * FROM read_csv_auto('${escaped}', delim='\\t')`;
    case 'json':
      return `SELECT * FROM read_json_auto('${escaped}')`;
    case 'ndjson':
      return `SELECT * FROM read_json_auto('${escaped}', format='newline_delimited')`;
    case 'parquet':
      return `SELECT * FROM read_parquet('${escaped}')`;
    default:
      throw new Error(`Cannot generate SQL for format: ${format}. Use a pre-conversion path (arrow.ts, excel.ts, geojson.ts).`);
  }
}

/** Run each statement in order; return the last one that produced a schema.
 *  Aborts on the first error. */
export async function runQuery(
  conn: AsyncDuckDBConnection,
  sql: string,
  options: QueryOptions = {},
): Promise<QueryResult> {
  const startedAt = performance.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const statements = splitStatements(sql);
  if (statements.length === 0) {
    return emptyResult(startedAt);
  }

  let lastResult: QueryResult | null = null;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] as string;

    // DuckDB-WASM has no AbortSignal; emulate with a timeout race.
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => {
          conn.close().catch(() => {});
          reject(new Error(`Statement ${i + 1} timed out after ${timeoutMs}ms`));
        },
        timeoutMs,
      );
    });

    try {
      const arrowTable = await Promise.race([conn.query(stmt), timeoutPromise]);
      const result = arrowToResult(arrowTable as unknown as arrow.Table, startedAt, options.maxRows);
      // DDL/DML returns a 1x1 "Count" row; prefer a later SELECT's data.
      if (result.columns.length > 0) {
        lastResult = result;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(statementPrefix(i, statements.length) + msg);
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  }

  return lastResult ?? emptyResult(startedAt);
}

function statementPrefix(i: number, total: number): string {
  return total > 1 ? `Statement ${i + 1}/${total}: ` : '';
}

function emptyResult(startedAt: number): QueryResult {
  return {
    columns: [],
    columnTypes: [],
    rows: [],
    rowCount: 0,
    durationMs: Math.round(performance.now() - startedAt),
    bytesScanned: null,
  };
}

/** Generate DuckDB PIVOT SQL for the given spec, capped to top-N column values
 *  (by frequency) so wide-pivots don't explode. Column identifiers are quoted
 *  defensively to handle spaces and reserved words. */
export function generatePivotSQL(source: string, spec: PivotSpec): string {
  const maxCols = spec.maxCols ?? 20;
  const q = quoteIdent;
  return `SELECT * FROM ${q(source)} PIVOT (${spec.aggregation}(${q(spec.valueColumn)}) FOR ${q(spec.colColumn)} IN (
    SELECT ${q(spec.colColumn)} FROM ${q(source)} GROUP BY ${q(spec.colColumn)} ORDER BY COUNT(*) DESC LIMIT ${maxCols}
  )) GROUP BY ${q(spec.rowColumn)}`;
}

/** Materialize a registered virtual file into a real table so it can be
 *  queried by name. duckdb-wasm's registerFileHandle only exposes the file on
 *  the virtual filesystem — it does NOT create a table, so `SELECT * FROM
 *  <name>` fails with "table does not exist". The read_*_auto() functions
 *  sniff content, so they work on extension-less virtual names. temp=true for
 *  throwaway tables (converter), false for session tables (SQL pad). */
export async function materializeFile(
  conn: AsyncDuckDBConnection,
  virtualName: string,
  format: FileFormat,
  targetTable: string = virtualName,
  temp = false,
): Promise<void> {
  const sql = sqlForFile(virtualName, format);
  await conn.query(`CREATE ${temp ? 'TEMP ' : ''}TABLE ${quoteIdent(targetTable)} AS ${sql}`);
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Throw if `name` is not a safe SQL identifier. */
function assertSafeIdent(name: string, ctx: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid ${ctx}: ${JSON.stringify(name)} (must match /^[A-Za-z_][A-Za-z0-9_]*$/)`);
  }
}

/** Convert an Arrow table to our domain QueryResult, capped at maxRows
 *  (default MAX_RESULT_ROWS; rowCount still reports the true total).
 *  Temporal columns become ISO strings — duckdb-wasm hands them back as
 *  raw epoch numbers, which would serialize as garbage in CSV/JSON. */
function arrowToResult(table: arrow.Table, startedAt: number, maxRows?: number): QueryResult {
  const columns = table.schema.fields.map((f) => f.name);
  const columnTypes = table.schema.fields.map((f) => f.type.toString());
  const total = table.numRows;
  const cap = maxRows === undefined ? MAX_RESULT_ROWS : maxRows;
  const temporal = table.schema.fields.map((f) => temporalKind(f.type));
  const rows: Record<string, unknown>[] = [];

  let i = 0;
  for (const row of table) {
    if (i >= cap) break;
    const obj: Record<string, unknown> = {};
    columns.forEach((col, j) => {
      obj[col] = serializeArrowValue(row[col], temporal[j]);
    });
    rows.push(obj);
    i++;
  }

  return {
    columns,
    columnTypes,
    rows,
    rowCount: total,
    truncated: Number.isFinite(cap) && total > rows.length,
    durationMs: Math.round(performance.now() - startedAt),
    bytesScanned: null,
  };
}

/** Arrow date/timestamp types → conversion kind. Matches on the type STRING
 *  (e.g. "date32[day]", "timestamp[ms]") because duckdb-wasm ships its own
 *  apache-arrow copy whose numeric Type enum ids differ from the project's —
 *  matching numbers across versions is a silent bug. DateDay values are days
 *  since epoch; everything else duckdb-wasm returns as epoch milliseconds. */
function temporalKind(type: { toString(): string }): 'date' | 'ts' | null {
  const t = type.toString();
  // arrow toString() yields e.g. "Date32<DAY>", "Date64<MILLISECOND>",
  // "Timestamp<MILLISECOND>" — capital-first, so match case-insensitively.
  if (/^date/i.test(t)) return 'date';
  if (/^timestamp/i.test(t)) return 'ts';
  return null;
}

/** Arrow values can be BigInts, TypedArrays, Date objects, etc. → JSON-safe. */
function serializeArrowValue(value: unknown, temporal: 'date' | 'ts' | null = null): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (temporal && typeof value === 'number') {
    const ms = temporal === 'date' && value < 1e10 ? value * 86_400_000 : value;
    const iso = new Date(ms).toISOString();
    return temporal === 'date' ? iso.slice(0, 10) : iso;
  }
  if (value instanceof Uint8Array) {
    // Truncate to avoid huge base64 in the UI; show first 64 bytes
    const hex = Array.from(value.slice(0, 64))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return value.length > 64 ? `0x${hex}…(${value.length}B)` : `0x${hex}`;
  }
  if (ArrayBuffer.isView(value)) {
    const len = 'length' in value ? (value as any).length : null;
    return len !== null ? `[${len} items]` : `[${value.byteLength}B]`;
  }
  return value;
}

/** Convenience: list all registered tables (read from DuckDB's duckdb_tables()). */
export async function listTables(conn: AsyncDuckDBConnection): Promise<string[]> {
  const result = await runQuery(conn, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'");
  return result.rows.map((r) => String(r['table_name']));
}

/** Map a DuckDB type name to a friendly UI category. */
export function categorizeType(type: string): ColumnCategory {
  const base = type.toUpperCase().trim().replace(/([^)]*)/g, '').trim();
  if (base.includes('[') || base.includes(']')) return 'complex';
  if (/^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT)$/.test(base)) return 'integer';
  if (/^(REAL|DOUBLE|FLOAT|DECIMAL|NUMERIC)$/.test(base)) return 'number';
  if (/^(VARCHAR|TEXT|STRING|BPCHAR|CHAR)$/.test(base)) return 'text';
  if (/^(BOOL|BOOLEAN)$/.test(base)) return 'boolean';
  if (/^DATE$/.test(base)) return 'date';
  if (/^TIMESTAMP/.test(base)) return 'datetime';
  if (/^TIME/.test(base)) return 'time';
  if (/^(JSON|STRUCT|LIST|MAP|UNION|ARRAY)$/.test(base)) return 'complex';
  if (/^(BLOB|BYTES|BYTEA|BINARY)$/.test(base)) return 'blob';
  if (/^UUID$/.test(base)) return 'uuid';
  if (/^NULL$/.test(base)) return 'null';
  return 'other';
}

/** Read a registered table's schema + total row count. tableName must be already registered. */
export async function getTableMetadata(conn: AsyncDuckDBConnection, tableName: string): Promise<TableMetadata> {
  assertSafeIdent(tableName, 'table name');
  const describe = await runQuery(conn, `DESCRIBE ${tableName}`);
  const columns: ColumnInfo[] = describe.rows.map((r) => ({
    name: String(r['column_name']),
    type: String(r['column_type']),
    category: categorizeType(String(r['column_type'])),
    nullable: String(r['null']).toUpperCase() === 'YES',
  }));
  const count = await runQuery(conn, `SELECT COUNT(*) AS n FROM ${tableName}`);
  const totalRowCount = Number(count.rows[0]?.['n'] ?? 0);

  // Stats are a full scan — skip for large tables to keep loads fast.
  let stats: ColumnStats[] | undefined;
  if (totalRowCount <= STATS_MAX_ROWS) {
    try {
      stats = await getColumnStats(conn, tableName);
    } catch (err) {
      console.warn('[queries] getColumnStats failed:', err);
    }
  }

  return { tableName, columns, totalRowCount, stats };
}

/** Get summary statistics (min/max/avg/nulls/uniques) for all columns. */
export async function getColumnStats(conn: AsyncDuckDBConnection, tableName: string): Promise<ColumnStats[]> {
  assertSafeIdent(tableName, 'table name');
  const table = await conn.query(`SUMMARIZE "${tableName.replace(/"/g, '""')}"`);
  const columns = table.schema.fields.map((f) => f.name);
  const rows: any[] = [];
  for (let i = 0; i < table.numRows; i++) {
    const rowObj: any = {};
    columns.forEach((col) => {
      rowObj[col] = table.getChild(col)?.get(i);
    });
    rows.push(rowObj);
  }
  return rows.map((r: any) => ({
    columnName: String(r.column_name || r.name || ''),
    min: r.min !== null && r.min !== undefined ? String(r.min) : 'N/A',
    max: r.max !== null && r.max !== undefined ? String(r.max) : 'N/A',
    approxUnique: typeof r.approx_unique === 'number' ? r.approx_unique : parseInt(String(r.approx_unique || 0), 10),
    avg: r.avg !== null && r.avg !== undefined && r.avg !== 'null' ? Number(r.avg) : null,
    nullPercentage: typeof r.null_percentage === 'number' ? r.null_percentage : parseFloat(String(r.null_percentage || 0)),
  }));
}

/** Fetch the first N rows of a registered table. */
export async function getSample(conn: AsyncDuckDBConnection, tableName: string, limit = 100): Promise<QueryResult> {
  assertSafeIdent(tableName, 'table name');
  if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) {
    throw new Error(`Invalid limit: ${limit} (must be 1-10000)`);
  }
  return runQuery(conn, `SELECT * FROM ${tableName} LIMIT ${limit}`);
}
