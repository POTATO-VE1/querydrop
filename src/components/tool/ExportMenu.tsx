/**
 * ExportMenu — dropdown with 9 export formats for the current query result:
 * CSV, JSON, NDJSON, Markdown, HTML, SQL (text); Excel, Parquet (binary);
 * SQLite (database). Sync formats compute size via Blob; binary/database
 * formats use heuristic estimates to avoid running the export twice. Async
 * formats (Excel, Parquet, SQLite) show a per-row busy state during export.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import type { QueryResult } from '../../lib/duckdb/types';
import {
  downloadBlob,
  estimateExcelBytes,
  estimateParquetBytes,
  estimateSQLiteBytes,
  serializeCSV,
  serializeExcel,
  serializeHTML,
  serializeJSON,
  serializeMarkdown,
  serializeNDJSON,
  serializeParquet,
  serializeSQL,
  serializeSQLite,
} from '../../lib/export';
import { Icon } from '../ui/Icon';
import { formatBytes, toast } from '../../lib/format';

type ExportFormat =
  | 'csv'
  | 'json'
  | 'ndjson'
  | 'markdown'
  | 'html'
  | 'sql'
  | 'excel'
  | 'parquet'
  | 'sqlite';

const EXTENSIONS: Record<ExportFormat, string> = {
  csv: 'csv',
  json: 'json',
  ndjson: 'ndjson',
  markdown: 'md',
  html: 'html',
  sql: 'sql',
  excel: 'xlsx',
  parquet: 'parquet',
  sqlite: 'sqlite',
};

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  json: 'application/json;charset=utf-8',
  ndjson: 'application/x-ndjson;charset=utf-8',
  markdown: 'text/markdown;charset=utf-8',
  html: 'text/html;charset=utf-8',
  sql: 'application/sql;charset=utf-8',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  parquet: 'application/vnd.apache.parquet',
  sqlite: 'application/x-sqlite3',
};

interface FormatEntry {
  key: ExportFormat;
  label: string;
  hint: string;
  group: 'text' | 'binary';
}

const FORMATS: FormatEntry[] = [
  { key: 'csv', label: 'CSV', hint: 'RFC 4180', group: 'text' },
  { key: 'json', label: 'JSON', hint: 'with schema', group: 'text' },
  { key: 'ndjson', label: 'NDJSON', hint: 'one per line', group: 'text' },
  { key: 'markdown', label: 'Markdown', hint: 'pipe table', group: 'text' },
  { key: 'html', label: 'HTML', hint: 'standalone', group: 'text' },
  { key: 'sql', label: 'SQL', hint: 'CREATE + INSERT', group: 'text' },
  { key: 'excel', label: 'Excel', hint: 'xlsx workbook', group: 'binary' },
  { key: 'parquet', label: 'Parquet', hint: 'columnar', group: 'binary' },
  { key: 'sqlite', label: 'SQLite', hint: '.sqlite3 db', group: 'binary' },
];

interface ExportMenuProps {
  result: QueryResult;
  durationMs: number;
  sql?: string;
  openConn?: () => Promise<{ db: AsyncDuckDB; conn: AsyncDuckDBConnection }>;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function ExportMenu({ result, durationMs, sql, openConn }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sizes = useMemo<Record<ExportFormat, number>>(
    () => {
      if (!open) return { csv: 0, json: 0, ndjson: 0, markdown: 0, html: 0, sql: 0, excel: 0, parquet: 0, sqlite: 0 };
      const colCount = result.columns.length;
      const rowCount = result.rowCount;
      const cellCount = colCount * rowCount;
      return {
        csv: colCount * 8 + cellCount * 10,
        json: 120 + cellCount * 22,
        ndjson: cellCount * 20,
        markdown: colCount * 12 + cellCount * 14,
        html: 500 + cellCount * 30,
        sql: 200 + colCount * 30 + cellCount * 25,
        excel: estimateExcelBytes(result),
        parquet: estimateParquetBytes(result),
        sqlite: estimateSQLiteBytes(result),
      };
    },
    [result, durationMs, open],
  );

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (busy) return;
      const base = `querydrop-${timestamp()}`;
      const filename = `${base}.${EXTENSIONS[format]}`;

      try {
        if (format === 'csv') {
          downloadBlob(new Blob([serializeCSV(result)], { type: MIME_TYPES.csv }), filename);
        } else if (format === 'json') {
          downloadBlob(new Blob([serializeJSON(result, durationMs)], { type: MIME_TYPES.json }), filename);
        } else if (format === 'ndjson') {
          downloadBlob(new Blob([serializeNDJSON(result)], { type: MIME_TYPES.ndjson }), filename);
        } else if (format === 'markdown') {
          downloadBlob(new Blob([serializeMarkdown(result)], { type: MIME_TYPES.markdown }), filename);
        } else if (format === 'html') {
          downloadBlob(new Blob([serializeHTML(result)], { type: MIME_TYPES.html }), filename);
        } else if (format === 'sql') {
          downloadBlob(new Blob([serializeSQL(result)], { type: MIME_TYPES.sql }), filename);
        } else if (format === 'excel') {
          setBusy('excel');
          const blob = await serializeExcel(result);
          downloadBlob(blob, filename);
        } else if (format === 'parquet') {
          if (!openConn || !sql) {
            setError('Parquet export requires a fresh query run');
            return;
          }
          setBusy('parquet');
          const { db, conn } = await openConn();
          try {
            const blob = await serializeParquet(db, conn, sql);
            downloadBlob(blob, filename);
          } finally {
            await conn.close().catch(() => {});
          }
        } else if (format === 'sqlite') {
          setBusy('sqlite');
          const blob = await serializeSQLite(result);
          downloadBlob(blob, filename);
        }
        toast(`Exported as ${format.toUpperCase()} successfully`, 'success');
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [busy, result, durationMs, sql, openConn],
  );

  const textFormats = FORMATS.filter((f) => f.group === 'text');
  const binaryFormats = FORMATS.filter((f) => f.group === 'binary');

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs mono text-text-tertiary hover:text-accent-brand transition-colors"
        title="Export result"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Icon name="download" size={12} />
        Export
        <Icon name="chevron-down" size={10} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-50 w-72 bg-bg-1 border border-border-subtle rounded-lg  overflow-hidden"
        >
          {result.truncated && (
            <div className="px-3 py-2 border-b border-accent-danger/30 bg-accent-danger/5 text-[10px] mono text-accent-danger">
              Only the first {result.rows.length.toLocaleString()} of {result.rowCount.toLocaleString()} rows
              are loaded — exports will be partial. Add a LIMIT or filter to export everything.
            </div>
          )}
          <div className="px-3 py-2 border-b border-border-subtle text-[10px] mono uppercase tracking-wider text-text-tertiary">
            Export {result.rowCount.toLocaleString()} {result.rowCount === 1 ? 'row' : 'rows'}
          </div>
          {textFormats.map((f) => (
            <ExportOption
              key={f.key}
              label={f.label}
              hint={f.hint}
              size={sizes[f.key]}
              disabled={busy !== null}
              busy={busy === f.key}
              onClick={() => handleExport(f.key)}
            />
          ))}
          <div className="px-3 py-1.5 border-y border-border-subtle text-[10px] mono uppercase tracking-wider text-text-tertiary/70">
            Binary / Database
          </div>
          {binaryFormats.map((f) => (
            <ExportOption
              key={f.key}
              label={f.label}
              hint={f.hint}
              size={sizes[f.key]}
              disabled={busy !== null}
              busy={busy === f.key}
              onClick={() => handleExport(f.key)}
            />
          ))}
          {error && (
            <div className="px-3 py-2 border-t border-border-subtle text-[10px] mono text-accent-danger">
              {error}
            </div>
          )}
          <div className="px-3 py-1.5 border-t border-border-subtle text-[10px] mono text-text-tertiary/70">
            Includes all {result.rowCount.toLocaleString()} rows
          </div>
        </div>
      )}
    </div>
  );
}

function ExportOption({
  label,
  hint,
  size,
  onClick,
  disabled,
  busy,
}: {
  label: string;
  hint: string;
  size: number;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-full text-left px-3 py-2 flex items-center justify-between gap-3',
        'hover:bg-bg-2 group transition-colors',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-text-primary text-xs mono font-semibold">{label}</span>
        <span className="text-text-tertiary text-[10px] mono">{hint}</span>
        {busy && (
          <span className="text-[10px] mono text-accent-brand">generating…</span>
        )}
      </div>
      <span className="text-text-tertiary text-[10px] mono group-hover:text-accent-brand shrink-0">
        {formatBytes(size)}
      </span>
    </button>
  );
}
