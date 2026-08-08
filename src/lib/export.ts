/**
 * Export helpers — CSV/JSON/NDJSON/Markdown/HTML/SQL/Excel/Parquet/SQLite
 * serialization and browser download trigger. CSV follows RFC 4180: fields
 * containing comma, double-quote, or newline are wrapped in double quotes and
 * internal quotes are doubled. Binary formats (Excel, Parquet, SQLite) are
 * returned as Blobs. Parquet uses DuckDB's native `COPY ... TO ... (FORMAT
 * PARQUET)` after materializing the result into a temp table; SQLite uses
 * sql.js (lazy-loaded) to build a .sqlite3 file in-memory.
 */

import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import type { QueryResult } from './duckdb/types';

const RFC4180_DELIM = ',';
const RFC4180_EOL = '\r\n';

export function serializeCSV(result: QueryResult): string {
  const lines: string[] = [];
  lines.push(result.columns.map(csvEscapeField).join(RFC4180_DELIM));
  for (const row of result.rows) {
    const cells = result.columns.map((col) => csvEscapeField(row[col]));
    lines.push(cells.join(RFC4180_DELIM));
  }
  return lines.join(RFC4180_EOL) + RFC4180_EOL;
}

export interface JSONEnvelope {
  columns: string[];
  columnTypes: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  exportedAt: string;
}

export function serializeJSON(result: QueryResult, durationMs: number): string {
  const envelope: JSONEnvelope = {
    columns: result.columns,
    columnTypes: result.columnTypes,
    rows: result.rows,
    rowCount: result.rowCount,
    durationMs,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(envelope, null, 2);
}

export function serializeNDJSON(result: QueryResult): string {
  const lines: string[] = [];
  for (const row of result.rows) {
    lines.push(JSON.stringify(row));
  }
  return lines.join('\n') + (lines.length > 0 ? '\n' : '');
}

export function serializeMarkdown(result: QueryResult): string {
  const lines: string[] = [];
  lines.push(`| ${result.columns.map(c => mdEscapeCell(c)).join(' | ')} |`);
  lines.push(`| ${result.columns.map(() => '---').join(' | ')} |`);
  for (const row of result.rows) {
    const cells = result.columns.map((c) => mdEscapeCell(row[c]));
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return lines.join('\n') + '\n';
}

export function serializeHTML(result: QueryResult): string {
  const lines: string[] = [];
  lines.push('<!DOCTYPE html>');
  lines.push('<html><head><meta charset="utf-8"><title>QueryDrop export</title>');
  lines.push('<style>body{font-family:system-ui,sans-serif;margin:24px}table{border-collapse:collapse}th,td{border:1px solid #444;padding:4px 8px;text-align:left}th{background:#222;color:#fff}</style>');
  lines.push('</head><body>');
  lines.push(`<table><thead><tr>${result.columns.map((c) => `<th>${htmlEscape(c)}</th>`).join('')}</tr></thead><tbody>`);
  for (const row of result.rows) {
    const cells = result.columns.map((c) => `<td>${htmlEscape(row[c])}</td>`);
    lines.push(`<tr>${cells.join('')}</tr>`);
  }
  lines.push('</tbody></table></body></html>');
  return lines.join('\n');
}

export function serializeSQL(result: QueryResult, tableName = 'result'): string {
  const safe = tableName.replace(/[^a-zA-Z0-9_]/g, '_') || 'result';
  const lines: string[] = [];
  const colDefs = result.columns.map((col, i) => {
    const t = sqlTypeFromDuckDB(result.columnTypes[i] ?? 'VARCHAR');
    return `  ${sqlIdent(col)} ${t}`;
  });
  lines.push(`CREATE TABLE ${sqlIdent(safe)} (`);
  lines.push(colDefs.join(',\n'));
  lines.push(');');
  for (const row of result.rows) {
    const values = result.columns.map((c) => sqlValue(row[c])).join(', ');
    lines.push(`INSERT INTO ${sqlIdent(safe)} VALUES (${values});`);
  }
  return lines.join('\n') + '\n';
}

export async function serializeExcel(result: QueryResult): Promise<Blob> {
  const XLSX = await import('xlsx');
  const aoa: unknown[][] = [result.columns];
  for (const row of result.rows) {
    aoa.push(result.columns.map((c) => normalizeForExcel(row[c])));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export async function serializeParquet(
  db: AsyncDuckDB,
  conn: AsyncDuckDBConnection,
  sql: string,
): Promise<Blob> {
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
      try {
        await conn.query(`DROP TABLE ${tempTable}`);
      } catch {
        // best-effort cleanup
      }
    }
    try {
      await db.dropFile(virtualFile);
    } catch {
      // best-effort cleanup
    }
  }
}

export async function serializeSQLite(
  result: QueryResult,
  tableName = 'result',
): Promise<Blob> {
  // @ts-expect-error - sql.js does not have official types installed
  const initSqlJs = (await import('sql.js')).default;
  const SQL = await initSqlJs({
    locateFile: (file: string) => `/sql-wasm/${file}`,
  });
  const db = new SQL.Database();
  try {
    const safe = tableName.replace(/[^a-zA-Z0-9_]/g, '_') || 'result';
    const colDefs = result.columns.map((col, i) => {
      const t = sqliteTypeFromDuckDB(result.columnTypes[i] ?? 'VARCHAR');
      return `${sqliteIdent(col)} ${t}`;
    });
    db.run(`CREATE TABLE ${sqliteIdent(safe)} (${colDefs.join(', ')})`);

    if (result.rows.length > 0) {
      const placeholders = result.columns.map(() => '?').join(', ');
      const stmt = db.prepare(
        `INSERT INTO ${sqliteIdent(safe)} VALUES (${placeholders})`,
      );
      try {
        for (const row of result.rows) {
          stmt.run(result.columns.map((c) => normalizeForSQLite(row[c])));
        }
      } finally {
        stmt.free();
      }
    }

    const buf = db.export();
    return new Blob([buf], { type: 'application/x-sqlite3' });
  } finally {
    db.close();
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function csvEscapeField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = stringifyCell(value);
  if (s.includes(RFC4180_DELIM) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Render a cell value as text. Objects/arrays (nested JSON, DuckDB structs)
 *  become compact JSON instead of "[object Object]". Dates are ISO strings. */
function stringifyCell(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array || ArrayBuffer.isView(value)) {
    return value instanceof Uint8Array ? `0x${Array.from(value.slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join('')}` : '[binary]';
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function mdEscapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return stringifyCell(value).replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/\r/g, '');
}

function htmlEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  return stringifyCell(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sqlIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'NULL';
    return String(value);
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'object' && !(value instanceof Date)) return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlTypeFromDuckDB(type: string): string {
  const t = type.toUpperCase();
  if (/\bINT\b|INTEGER|BIGINT|SMALLINT|TINYINT|HUGEINT/.test(t)) return 'BIGINT';
  if (/^(REAL|DOUBLE|FLOAT|DECIMAL|NUMERIC)$/.test(t)) return 'DOUBLE PRECISION';
  if (/^(BOOL|BOOLEAN)$/.test(t)) return 'BOOLEAN';
  if (/^TIMESTAMP/.test(t)) return 'TIMESTAMP';
  if (/^DATE$/.test(t)) return 'DATE';
  if (/^TIME/.test(t)) return 'TIME';
  if (/^(JSON|STRUCT|LIST|MAP|ARRAY)$/.test(t)) return 'JSON';
  if (/^(BLOB|BYTES)$/.test(t)) return 'BYTEA';
  if (/^UUID$/.test(t)) return 'UUID';
  return 'TEXT';
}

function normalizeForExcel(value: unknown): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value;
  if (value instanceof Uint8Array || ArrayBuffer.isView(value)) return '[binary]';
  return JSON.stringify(value);
}

function sqliteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function sqliteTypeFromDuckDB(type: string): string {
  const t = type.toUpperCase();
  if (/INT/.test(t)) return 'INTEGER';
  if (/^(REAL|DOUBLE|FLOAT|DECIMAL|NUMERIC)$/.test(t)) return 'REAL';
  if (/^(BOOL|BOOLEAN)$/.test(t)) return 'INTEGER';
  if (/^(BLOB|BYTES)$/.test(t)) return 'BLOB';
  return 'TEXT';
}

function normalizeForSQLite(
  value: unknown,
): null | number | string | Uint8Array {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : value.toString();
  }
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return value;
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export function estimateParquetBytes(result: QueryResult): number {
  let bytes = 1024;
  const cell = result.columns.length * result.rowCount;
  bytes += Math.floor(cell * 4);
  return bytes;
}

export function estimateExcelBytes(result: QueryResult): number {
  let bytes = 5120;
  const cell = result.columns.length * result.rowCount;
  bytes += Math.floor(cell * 3);
  return bytes;
}

export function estimateSQLiteBytes(result: QueryResult): number {
  let bytes = 2048;
  const cell = result.columns.length * result.rowCount;
  bytes += Math.floor(cell * 12);
  return bytes;
}
