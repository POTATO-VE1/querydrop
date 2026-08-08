/**
 * DuckDB-WASM singleton client.
 *
 * Strategy:
 * - Lazy init: nothing loaded until first call to `getDuckDB()`.
 * - EH build primary, MVP build fallback for older browsers.
 * - Engine binaries served from the jsdelivr CDN (see below).
 *
 * Usage:
 *   const db = await getDuckDB();
 *   const conn = await db.connect();
 *   const result = await runQuery(conn, 'SELECT 1');
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import type { AsyncDuckDB, DuckDBStatus, FileFormat, RegisteredFile } from './types';

// Engine bundles come from the jsdelivr CDN (the official duckdb-wasm
// distribution). Self-hosting is impossible on Cloudflare Pages, which
// rejects files over 25MB — the wasm binaries are 36-41MB. jsdelivr sends
// CORS headers, so the blob worker can fetch them, and sw.js caches them
// for offline use. CDN URLs are absolute, which also avoids the blob-worker
// relative-path resolution failure (`new Request('/x')` breaks inside a
// blob: URL).
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${duckdb.PACKAGE_VERSION}/dist/`;

const EH_BUNDLE: duckdb.DuckDBBundle = {
  mainModule: `${CDN_BASE}duckdb-eh.wasm`,
  mainWorker: `${CDN_BASE}duckdb-browser-eh.worker.js`,
  pthreadWorker: null,
};

const MVP_BUNDLE: duckdb.DuckDBBundle = {
  mainModule: `${CDN_BASE}duckdb-mvp.wasm`,
  mainWorker: `${CDN_BASE}duckdb-browser-mvp.worker.js`,
  pthreadWorker: null,
};

let initPromise: Promise<AsyncDuckDB> | null = null;
let listeners: Set<(status: DuckDBStatus) => void> = new Set();
let currentStatus: DuckDBStatus = { kind: 'idle' };

/** True if the page is cross-origin isolated (COOP+COEP active). */
export function isCrossOriginIsolated(): boolean {
  return typeof globalThis !== 'undefined' && (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
}

/** Subscribe to status changes. Returns unsubscribe. */
export function onStatusChange(listener: (status: DuckDBStatus) => void): () => void {
  listeners.add(listener);
  listener(currentStatus);
  return () => {
    listeners.delete(listener);
  };
}

function setStatus(next: DuckDBStatus): void {
  currentStatus = next;
  for (const l of listeners) {
    try {
      l(next);
    } catch (err) {
      console.error('[duckdb] status listener threw:', err);
    }
  }
}

/** Returns the current status (snapshot, no subscription). */
export function getStatus(): DuckDBStatus {
  return currentStatus;
}

/**
 * Get (or create) the singleton DuckDB instance.
 * First call triggers loading; subsequent calls return the same promise.
 */
export async function getDuckDB(): Promise<AsyncDuckDB> {
  if (initPromise) return initPromise;
  initPromise = initialize();
  return initPromise;
}

async function initialize(): Promise<AsyncDuckDB> {
  setStatus({ kind: 'loading', message: 'Loading DuckDB engine' });

  // Pick the bundle: prefer EH if cross-origin isolated AND SharedArrayBuffer exists
  const useEh = isCrossOriginIsolated() && typeof SharedArrayBuffer !== 'undefined';
  const bundle = useEh ? EH_BUNDLE : MVP_BUNDLE;
  const buildUsed: 'eh' | 'mvp' = useEh ? 'eh' : 'mvp';

  setStatus({
    kind: 'loading',
    message: useEh ? 'Loading EH build (with pthreads)' : 'Loading MVP build (single-threaded)',
  });

  try {
    const worker = await duckdb.createWorker(bundle.mainWorker);
    const logger = new duckdb.VoidLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);

    const instantiatePromise = db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DuckDB instantiate timed out after 60s')), 60000)
    );
    await Promise.race([instantiatePromise, timeoutPromise]);

    setStatus({ kind: 'ready', db, buildUsed });
    return db;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    setStatus({ kind: 'error', error });
    initPromise = null; // allow retry
    throw error;
  }
}

/**
 * Register a File (from <input> or drop event) into DuckDB's virtual filesystem.
 * Returns the virtual name to use in SQL.
 */
export async function registerFile(db: AsyncDuckDB, file: File, format: FileFormat): Promise<RegisteredFile> {
  // Strip extension and sanitize for DuckDB table name conventions
  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
  const virtualName = `${baseName}_${Date.now()}`;

  // DuckDB's registerFileHandle accepts a File or Blob directly
  await db.registerFileHandle(virtualName, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);

  return {
    virtualName,
    originalName: file.name,
    sizeBytes: file.size,
    format,
  };
}

/** Sniff format from filename + MIME type. Defaults to 'unknown' (user can pick). */
export function detectFormat(filename: string, mimeType?: string): FileFormat {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.tsv') || lower.endsWith('.tab')) return 'tsv';
  if (lower.endsWith('.ndjson') || lower.endsWith('.jsonl')) return 'ndjson';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'excel';
  if (lower.endsWith('.parquet') || lower.endsWith('.pq')) return 'parquet';
  if (lower.endsWith('.feather')) return 'feather';
  if (lower.endsWith('.arrow') || lower.endsWith('.ipc')) return 'arrow';
  if (lower.endsWith('.geojson')) return 'geojson';

  // MIME fallback
  if (mimeType === 'text/csv') return 'csv';
  if (mimeType === 'application/json') return 'json';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'excel';

  return 'unknown';
}

/** Reset the singleton — used by "Restart DuckDB" UI button. */
export async function resetDuckDB(): Promise<void> {
  const oldPromise = initPromise;
  initPromise = null;
  setStatus({ kind: 'idle' });
  if (oldPromise) {
    try {
      const db = await oldPromise;
      db.terminate();
    } catch {
      // already failed; nothing to terminate
    }
  }
}
