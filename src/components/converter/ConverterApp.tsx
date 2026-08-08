/**
 * ConverterApp — standalone, page-embedded file converter for the per-format
 * SEO pages (/convert/parquet-to-csv etc). Unlike the FormatConverter modal
 * (which lives inside the SQL tool), this is a self-contained card: drop a
 * file, optionally preset the output format from the page, convert, download.
 * Reuses the same DuckDB-WASM pipeline as the modal (loadFileAsTempTable /
 * convertSourceToBlob) so behavior is identical, not a second implementation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryResult } from '../../lib/duckdb/types';
import { formatBytes } from '../../lib/format';
import { downloadBlob } from '../../lib/export';
import {
  EXTENSIONS,
  convertSourceToBlob,
  estimateConvertSize,
  loadFileAsTempTable,
  type ConverterSource,
  type ConverterSourceFile,
  type OutputFormat,
} from '../tool/FormatConverter';
import { Icon } from '../ui/Icon';

const ACCEPT =
  '.csv,.tsv,.json,.ndjson,.xlsx,.xls,.parquet,.feather,.arrow,.ipc,.geojson';

const FORMAT_TILES: { key: OutputFormat; label: string; hint: string }[] = [
  { key: 'csv', label: 'CSV', hint: 'RFC 4180' },
  { key: 'json', label: 'JSON', hint: 'with schema' },
  { key: 'ndjson', label: 'NDJSON', hint: 'one per line' },
  { key: 'markdown', label: 'Markdown', hint: 'pipe table' },
  { key: 'html', label: 'HTML', hint: 'standalone' },
  { key: 'sql', label: 'SQL', hint: 'CREATE + INSERT' },
  { key: 'excel', label: 'Excel', hint: 'xlsx workbook' },
  { key: 'parquet', label: 'Parquet', hint: 'columnar' },
  { key: 'sqlite', label: 'SQLite', hint: '.sqlite3 db' },
];

interface ConverterAppProps {
  /** Output format preselected by the page (e.g. 'csv' on /convert/parquet-to-csv). */
  presetOutput?: OutputFormat;
  /** Sample file the user can load with one click to try the converter. */
  sampleHref?: string;
}

export function ConverterApp({ presetOutput = 'csv', sampleHref }: ConverterAppProps) {
  const [source, setSource] = useState<ConverterSource | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(presetOutput);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drop the converter's table + registered file when the source changes or
  // the component unmounts. TEMP tables are connection-scoped in DuckDB, so
  // the converter uses main-schema tables — these must be cleaned up here and
  // after each conversion.
  useEffect(() => {
    const active = source?.kind === 'file' ? source.virtualName : null;
    return () => {
      if (!active) return;
      const nameToDrop = active;
      void (async () => {
        try {
          const { getDuckDB } = await import('../../lib/duckdb/client');
          const db = await getDuckDB();
          const conn = await db.connect();
          try {
            const safeName = '"' + nameToDrop.replace(/"/g, '""') + '"';
            await conn.query(`DROP TABLE IF EXISTS ${safeName}`);
          } finally {
            await conn.close().catch(() => {});
          }
          try {
            await db.dropFile(nameToDrop);
          } catch {
            // file may not exist
          }
        } catch {
          // best-effort cleanup
        }
      })();
    };
  }, [source]);

  const loadFile = useCallback(async (file: File) => {
    setError(null);
    setDone(false);
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

  const loadSample = useCallback(async () => {
    if (!sampleHref) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(sampleHref);
      if (!res.ok) throw new Error(`Sample download failed (${res.status})`);
      const blob = await res.blob();
      const name = sampleHref.split('/').pop() ?? 'sample.csv';
      await loadFile(new File([blob], name, { type: blob.type || 'text/csv' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [sampleHref, loadFile]);

  const handleConvert = useCallback(async () => {
    if (!source) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const blob = await convertSourceToBlob(source, outputFormat, null);
      const base = (source as ConverterSourceFile).file.name.replace(/\.[^.]+$/, '');
      downloadBlob(blob, `${base}.${EXTENSIONS[outputFormat]}`);
      setDone(true);
      setSource(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [source, outputFormat]);

  const reset = useCallback(() => {
    setSource(null);
    setError(null);
    setDone(false);
    setOutputFormat(presetOutput);
  }, [presetOutput]);

  const estimatedBytes =
    source && source.kind === 'file'
      ? estimateConvertSize(source, outputFormat, null)
      : null;

  return (
    <div className="bg-bg-1 border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="shuffle" size={14} className="text-accent-brand" />
          <span className="text-sm font-semibold text-text-primary">Browser converter</span>
        </div>
        <span className="text-[10px] mono text-text-tertiary">100% local · nothing uploaded</span>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
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
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={[
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                dragOver
                  ? 'border-accent-brand bg-bg-2'
                  : 'border-border-subtle hover:border-text-tertiary',
              ].join(' ')}
            >
              <Icon name="upload" size={28} className="mx-auto text-text-tertiary mb-2" />
              <p className="text-sm text-text-primary">Drop a file here or click to browse</p>
              <p className="text-[10px] mono text-text-tertiary mt-2">
                CSV · TSV · JSON · NDJSON · Excel · Parquet · Feather · Arrow · GeoJSON
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void loadFile(file);
                  // Allow re-selecting the same file.
                  e.target.value = '';
                }}
              />
            </div>

            {sampleHref && (
              <button
                type="button"
                onClick={() => void loadSample()}
                disabled={busy}
                className="text-xs mono text-accent-brand hover:underline disabled:opacity-50"
              >
                No file handy? Try the sample dataset →
              </button>
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
                <button
                  type="button"
                  onClick={reset}
                  className="text-[10px] mono text-text-tertiary hover:text-text-primary shrink-0"
                >
                  Change
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] mono uppercase tracking-wider text-text-tertiary mb-2">
                Output format
              </p>
              <div className="grid grid-cols-3 gap-2">
                {FORMAT_TILES.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setOutputFormat(f.key)}
                    className={[
                      'px-3 py-2 rounded text-left text-xs mono transition-colors',
                      outputFormat === f.key
                        ? 'bg-bg-3 border border-accent-brand text-text-primary'
                        : 'bg-bg-2 border border-border-subtle text-text-secondary hover:border-text-tertiary',
                    ].join(' ')}
                  >
                    <div className="font-semibold">{f.label}</div>
                    <div className="text-[10px] text-text-tertiary">{f.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {estimatedBytes !== null && (
              <p className="text-[10px] mono text-text-tertiary">
                Estimated output: ~{formatBytes(estimatedBytes)}
              </p>
            )}

            {error && (
              <p className="text-[10px] mono text-accent-danger border border-accent-danger/30 rounded p-2 bg-accent-danger/5">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={reset}
                className="px-3 py-1.5 text-xs mono text-text-tertiary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConvert()}
                disabled={busy}
                className="px-4 py-1.5 text-xs mono bg-accent-brand text-bg-0 font-semibold rounded hover:bg-accent-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? 'Converting…' : `Convert to ${outputFormat.toUpperCase()} & download`}
              </button>
            </div>
          </>
        )}

        {done && (
          <div className="border border-accent-success/30 bg-accent-success/5 rounded-lg p-3 text-center">
            <p className="text-xs text-text-primary font-semibold">
              ✓ Downloaded. Your file was never uploaded.
            </p>
            <button
              type="button"
              onClick={reset}
              className="text-[10px] mono text-accent-brand hover:underline mt-1"
            >
              Convert another file
            </button>
          </div>
        )}

        {error && (
          <p className="text-[10px] mono text-accent-danger border border-accent-danger/30 rounded p-2 bg-accent-danger/5" role="alert">
            {error}
          </p>
        )}

        {busy && !source && (
          <p className="text-xs text-text-tertiary text-center">Loading file…</p>
        )}
      </div>
    </div>
  );
}
