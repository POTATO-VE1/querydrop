/**
 * FormatConverter — modal that converts a dropped file (or current query
 * result) into one of 9 output formats. Parquet uses DuckDB `COPY TO
 * (FORMAT PARQUET)` so it streams without loading rows into JS; other
 * formats run `SELECT * FROM <tempTable>` and call the JS serializers from
 * `src/lib/export.ts`. Temp table is dropped in `finally` to keep the
 * DuckDB session clean.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { formatBytes } from '../../lib/format';
import {
  detectFormat,
  getDuckDB,
  registerFile,
} from '../../lib/duckdb/client';
import { insertArrowFile } from '../../lib/duckdb/arrow';
import { geojsonToNdjson } from '../../lib/duckdb/geojson';
import {
  excelSheetToCsv,
  parseExcelSheets,
} from '../../lib/duckdb/excel';
import {
  getTableMetadata,
  materializeFile,
  runQuery,
} from '../../lib/duckdb/queries';
import type {
  FileFormat,
  QueryResult,
} from '../../lib/duckdb/types';
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
  serializeSQL,
  serializeSQLite,
} from '../../lib/export';
import { Icon } from '../ui/Icon';

type OutputFormat =
  | 'csv'
  | 'json'
  | 'ndjson'
  | 'markdown'
  | 'html'
  | 'sql'
  | 'excel'
  | 'parquet'
  | 'sqlite';

export type { OutputFormat };

export const EXTENSIONS: Record<OutputFormat, string> = {
  csv: 'csv',
  json: 'json',
  ndjson: 'jsonl',
  markdown: 'md',
  html: 'html',
  sql: 'sql',
  excel: 'xlsx',
  parquet: 'parquet',
  sqlite: 'db',
};

const FORMATS: { key: OutputFormat; label: string; hint: string; group: 'text' | 'binary' }[] = [
  { key: 'csv', label: 'CSV', hint: 'RFC 4180', group: 'text' },
  { key: 'json', label: 'JSON', hint: 'with schema', group: 'text' },
  { key: 'ndjson', label: 'NDJSON', hint: 'one per line', group: 'text' },
  { key: 'markdown', label: 'Markdown', hint: 'pipe table', group: 'text' },
  { key: 'html', label: 'HTML', hint: 'standalone', group: 'text' },
  { key: 'sql', label: 'SQL', hint: 'CREATE + INSERT', group: 'text' },
  { key: 'excel', label: 'Excel', hint: 'xlsx workbook', group: 'binary' },
  { key: 'parquet', label: 'Parquet', hint: 'columnar (fast)', group: 'binary' },
  { key: 'sqlite', label: 'SQLite', hint: '.sqlite3 db', group: 'binary' },
];

interface ConverterSourceFile {
  kind: 'file';
  file: File;
  format: FileFormat;
  virtualName: string;
  columns: string[];
  rowCount: number;
}

export type { ConverterSourceFile };

export type ConverterSource =
  | ConverterSourceFile
  | { kind: 'result'; columns: string[]; rowCount: number };

interface FormatConverterProps {
  open: boolean;
  onClose: () => void;
  currentResult: QueryResult | null;
}

export function FormatConverter({ open, onClose, currentResult }: FormatConverterProps) {
  const [source, setSource] = useState<ConverterSource | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('csv');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let activeVirtualName: string | null = null;
    if (source && source.kind === 'file') {
      activeVirtualName = source.virtualName;
    }

    return () => {
      if (activeVirtualName) {
        const nameToDrop = activeVirtualName;
        void (async () => {
          try {
            const db = await getDuckDB();
            const conn = await db.connect();
            try {
              const safeName = '"' + nameToDrop.replace(/"/g, '""') + '"';
              await conn.query(`DROP TABLE IF EXISTS ${safeName}`);
            } finally {
              await conn.close().catch(() => {});
            }
          } catch {
            // best-effort cleanup
          }
        })();
      }
    };
  }, [source]);

  useEffect(() => {
    if (!open) {
      setSource(null);
      setError(null);
      setBusy(false);
      setDragOver(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open, onClose]);
  useEscapeKey(onClose, open);
  useFocusTrap(dialogRef, open);

  const loadFile = useCallback(async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const loaded = await loadFileAsTempTable(file);
      setSource({ kind: 'file', file, ...loaded });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void loadFile(file);
    },
    [loadFile],
  );

  const handleConvert = useCallback(async () => {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await convertSourceToBlob(source, outputFormat, currentResult);
      const base = source.kind === 'file'
        ? source.file.name.replace(/\.[^.]+$/, '')
        : 'querydrop_result';
      const filename = `${base}.${EXTENSIONS[outputFormat]}`;
      downloadBlob(blob, filename);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [source, outputFormat, currentResult, onClose]);

  const textFormats = useMemo(() => FORMATS.filter((f) => f.group === 'text'), []);
  const binaryFormats = useMemo(() => FORMATS.filter((f) => f.group === 'binary'), []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="converter-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl bg-bg-1 border border-border-subtle rounded-lg  flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 id="converter-title" className="text-sm font-semibold text-text-primary">
            Format Converter
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary"
            aria-label="Close converter"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {!source ? (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={[
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  dragOver
                    ? 'border-accent-brand bg-bg-2'
                    : 'border-border-subtle hover:border-text-tertiary',
                ].join(' ')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <Icon name="upload" size={28} className="mx-auto text-text-tertiary mb-2" />
                <p className="text-sm text-text-primary">Drop a file or click to browse</p>
                <p className="text-[10px] mono text-text-tertiary mt-2">
                  CSV · TSV · JSON · NDJSON · Excel · Parquet · Feather · Arrow · GeoJSON
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.json,.ndjson,.xlsx,.xls,.parquet,.feather,.arrow,.ipc,.geojson"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void loadFile(file);
                  }}
                />
              </div>

              {currentResult && currentResult.rowCount > 0 && (
                <div className="border border-border-subtle rounded-lg p-3 bg-bg-2">
                  <p className="text-[10px] mono uppercase tracking-wider text-text-tertiary mb-2">
                    Or use current query result
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setSource({
                        kind: 'result',
                        columns: currentResult.columns,
                        rowCount: currentResult.rowCount,
                      })
                    }
                    className="text-xs mono text-accent-brand hover:underline"
                  >
                    {currentResult.rowCount.toLocaleString()} rows × {currentResult.columns.length}{' '}
                    {currentResult.columns.length === 1 ? 'column' : 'columns'} →
                  </button>
                </div>
              )}

              {busy && (
                <p className="text-xs text-text-tertiary text-center">Loading file…</p>
              )}

              {error && (
                <p className="text-[10px] mono text-accent-danger border border-accent-danger/30 rounded p-2 bg-accent-danger/5" role="alert">
                  {error}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="border border-border-subtle rounded-lg p-3 bg-bg-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary font-semibold truncate">
                      {source.kind === 'file' ? source.file.name : 'Current query result'}
                    </p>
                    <p className="text-[10px] mono text-text-tertiary mt-1">
                      {source.kind === 'file'
                        ? `${source.format.toUpperCase()} · ${formatBytes(source.file.size)} · ${source.rowCount.toLocaleString()} rows × ${source.columns.length} cols`
                        : `${source.rowCount.toLocaleString()} rows × ${source.columns.length} cols`}
                    </p>
                  </div>
                  {source.kind === 'file' && (
                    <button
                      type="button"
                      onClick={() => setSource(null)}
                      className="text-[10px] mono text-text-tertiary hover:text-text-primary shrink-0"
                    >
                      Change
                    </button>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] mono uppercase tracking-wider text-text-tertiary mb-2">
                  Output format
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {textFormats.map((f) => (
                    <FormatTile
                      key={f.key}
                      label={f.label}
                      hint={f.hint}
                      selected={outputFormat === f.key}
                      onClick={() => setOutputFormat(f.key)}
                    />
                  ))}
                </div>
                <p className="text-[10px] mono uppercase tracking-wider text-text-tertiary mt-3 mb-2">
                  Binary / Database
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {binaryFormats.map((f) => (
                    <FormatTile
                      key={f.key}
                      label={f.label}
                      hint={f.hint}
                      selected={outputFormat === f.key}
                      onClick={() => setOutputFormat(f.key)}
                    />
                  ))}
                </div>
              </div>

              {source.kind === 'result' && outputFormat === 'parquet' && (
                <p className="text-[10px] mono text-text-tertiary">
                  Parquet export from query result is not supported here. Use the
                  Export menu in the result panel, or load a file and convert.
                </p>
              )}

              {error && (
                <p className="text-[10px] mono text-accent-danger border border-accent-danger/30 rounded p-2 bg-accent-danger/5">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs mono text-text-tertiary hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConvert()}
                  disabled={busy || (source.kind === 'result' && outputFormat === 'parquet')}
                  className="px-4 py-1.5 text-xs mono bg-accent-brand text-bg-0 font-semibold rounded hover:bg-accent-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? 'Converting…' : 'Convert & Download'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FormatTile({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-2 rounded text-left text-xs mono transition-colors',
        selected
          ? 'bg-bg-3 border border-accent-brand text-text-primary'
          : 'bg-bg-2 border border-border-subtle text-text-secondary hover:border-text-tertiary',
      ].join(' ')}
    >
      <div className="font-semibold">{label}</div>
      <div className="text-[10px] text-text-tertiary">{hint}</div>
    </button>
  );
}

export async function loadFileAsTempTable(
  file: File,
): Promise<{ format: FileFormat; virtualName: string; columns: string[]; rowCount: number }> {
  const format = detectFormat(file.name, file.type);
  const db = await getDuckDB();
  const conn = await db.connect();
  const ts = Date.now();
  const baseName = (file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_') || 'converted').slice(0, 40);
  const virtualName = `__conv_${baseName}_${ts}`;
  const safeName = '"' + virtualName.replace(/"/g, '""') + '"';

  try {
    if (format === 'arrow' || format === 'feather') {
      await insertArrowFile(conn, file, virtualName);
    } else if (format === 'excel') {
      const { sheets } = await parseExcelSheets(file);
      if (sheets.length === 0) throw new Error('Empty Excel workbook');
      const csvFile = await excelSheetToCsv(file, sheets[0]!.name);
      const registered = await registerFile(db, csvFile, 'csv');
      await materializeFile(conn, registered.virtualName, 'csv', virtualName);
    } else if (format === 'geojson') {
      const ndjsonFile = await geojsonToNdjson(file);
      const registered = await registerFile(db, ndjsonFile, 'ndjson');
      await materializeFile(conn, registered.virtualName, 'ndjson', virtualName);
    } else if (format === 'csv' || format === 'tsv' || format === 'json' || format === 'ndjson' || format === 'parquet') {
      const registered = await registerFile(db, file, format);
      await materializeFile(conn, registered.virtualName, format, virtualName);
    } else {
      throw new Error(`Unsupported input format: ${format}. Use one of: csv, tsv, json, ndjson, xlsx, parquet, feather, arrow, geojson.`);
    }

    const metadata = await getTableMetadata(conn, virtualName);
    return {
      format,
      virtualName,
      columns: metadata.columns.map((c) => c.name),
      rowCount: metadata.totalRowCount,
    };
  } catch (e) {
    try {
      await conn.query(`DROP TABLE IF EXISTS ${safeName}`);
    } catch {
      // best-effort cleanup
    }
    throw e;
  } finally {
    await conn.close().catch(() => {});
  }
}

export async function convertSourceToBlob(
  source: ConverterSource,
  output: OutputFormat,
  currentResult: QueryResult | null,
): Promise<Blob> {
  if (source.kind === 'result') {
    if (!currentResult) throw new Error('No current result available');
    return serializeToBlobFromResult(currentResult, output);
  }

  if (output === 'parquet') {
    return convertFileToParquet(source.virtualName);
  }

  const db = await getDuckDB();
  const conn = await db.connect();
  const safeName = '"' + source.virtualName.replace(/"/g, '""') + '"';
  try {
    const result = await runQuery(conn, `SELECT * FROM ${safeName}`);
    return await serializeToBlobFromResult(result, output);
  } finally {
    try {
      await conn.query(`DROP TABLE IF EXISTS ${safeName}`);
    } catch {
      // best-effort cleanup
    }
    await conn.close().catch(() => {});
  }
}

async function serializeToBlobFromResult(
  result: QueryResult,
  output: OutputFormat,
): Promise<Blob> {
  if (output === 'csv') {
    return new Blob([serializeCSV(result)], { type: 'text/csv;charset=utf-8' });
  }
  if (output === 'json') {
    return new Blob([serializeJSON(result, result.durationMs)], { type: 'application/json;charset=utf-8' });
  }
  if (output === 'ndjson') {
    return new Blob([serializeNDJSON(result)], { type: 'application/x-ndjson;charset=utf-8' });
  }
  if (output === 'markdown') {
    return new Blob([serializeMarkdown(result)], { type: 'text/markdown;charset=utf-8' });
  }
  if (output === 'html') {
    return new Blob([serializeHTML(result)], { type: 'text/html;charset=utf-8' });
  }
  if (output === 'sql') {
    return new Blob([serializeSQL(result)], { type: 'application/sql;charset=utf-8' });
  }
  if (output === 'excel') {
    return await serializeExcel(result);
  }
  if (output === 'sqlite') {
    return await serializeSQLite(result);
  }
  if (output === 'parquet') {
    throw new Error('Parquet output requires a file source, not a query result');
  }
  throw new Error(`Unsupported output format: ${output}`);
}

async function convertFileToParquet(virtualName: string): Promise<Blob> {
  const db = await getDuckDB();
  const conn = await db.connect();
  const ts = Date.now();
  const virtualFile = `__conv_${ts}_out.parquet`;
  const safeName = '"' + virtualName.replace(/"/g, '""') + '"';

  try {
    await db.registerFileBuffer(virtualFile, new Uint8Array(0));
    await conn.query(`COPY ${safeName} TO '${virtualFile}' (FORMAT PARQUET)`);
    const buf = await db.copyFileToBuffer(virtualFile);
    return new Blob([new Uint8Array(buf)], { type: 'application/vnd.apache.parquet' });
  } finally {
    try {
      await conn.query(`DROP TABLE IF EXISTS ${safeName}`);
    } catch {
      // best-effort cleanup
    }
    try {
      await db.dropFile(virtualFile);
    } catch {
      // best-effort cleanup
    }
    await conn.close().catch(() => {});
  }
}

export function estimateConvertSize(
  source: ConverterSource,
  output: OutputFormat,
  currentResult: QueryResult | null,
): number {
  const colCount = source.columns.length;
  const rowCount = source.rowCount;
  const cellCount = colCount * rowCount;

  if (output === 'csv') {
    return colCount * 8 + cellCount * 10;
  }
  if (output === 'json') {
    return 120 + cellCount * 22;
  }
  if (output === 'ndjson') {
    return cellCount * 20;
  }
  if (output === 'markdown') {
    return colCount * 12 + cellCount * 14;
  }
  if (output === 'html') {
    return 500 + cellCount * 30;
  }
  if (output === 'sql') {
    return 200 + colCount * 30 + cellCount * 25;
  }
  if (output === 'excel') {
    return 5120 + cellCount * 3;
  }
  if (output === 'sqlite') {
    return 2048 + cellCount * 12;
  }
  if (output === 'parquet') {
    return 1024 + cellCount * 4;
  }
  return 0;
}
