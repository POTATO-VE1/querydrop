/**
 * QueryPad — Stage 8.
 * File drop + schema + data table + SQL editor (CodeMirror 6, neon theme, PostgreSQL dialect) +
 * schema-aware column autocomplete + multi-statement execution + query history dropdown +
 * result/error view. Virtualised results ship in Stage 9.
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { detectFormat, getDuckDB, getStatus, onStatusChange, registerFile } from '../../lib/duckdb/client';
import type { AsyncDuckDB, AsyncDuckDBConnection, DuckDBStatus, RegisteredFile } from '../../lib/duckdb/types';
import { generatePivotSQL, getSample, getTableMetadata, listTables, materializeFile, runQuery } from '../../lib/duckdb/queries';
import { categorizeType } from '../../lib/duckdb/queries';
import type { ColumnCategory, ColumnInfo, ColumnStats, FileFormat, PivotSpec, QueryHistoryItem, QueryResult, QuerySnippet, TableMetadata } from '../../lib/duckdb/types';
import { clearHistory, loadHistory, pushHistory } from '../../lib/duckdb/history';
import { deleteSnippet, loadSnippets, renameSnippet, saveSnippet } from '../../lib/duckdb/snippets';
import { splitStatements } from '../../lib/duckdb/split';
import { excelSheetToCsv, parseExcelSheets, type ExcelSheetInfo } from '../../lib/duckdb/excel';
import { insertArrowFile } from '../../lib/duckdb/arrow';
import { geojsonToNdjson } from '../../lib/duckdb/geojson';
import { matchErrorPattern } from '../../lib/errorPatterns';
import { readShareFromSearch, decodeShare, decodeShareResult, type ShareResultPayload } from '../../lib/share';
import { rewriteSqlTableRef, type Workspace, type WorkspaceFile } from '../../lib/workspace';
import { formatBytes, formatSQL } from '../../lib/format';
import { HistoryDropdown } from './HistoryDropdown';
import { ExportMenu } from './ExportMenu';
import { ExcelSheetPicker } from './ExcelSheetPicker';
import { SampleLibrary } from './SampleLibrary';
import { TemplateMenu } from './TemplateMenu';
import { ShareMenu } from './ShareMenu';
import { WorkspaceMenu } from './WorkspaceMenu';
import { MobileRunBar } from './MobileRunBar';
import { SrAnnouncerProvider, useAnnouncer } from '../a11y/SrAnnouncer';
import { Icon } from '../ui/Icon';

const SqlEditor = lazy(() =>
  import('./SqlEditor').then((m) => ({ default: m.SqlEditor })),
);
type SqlEditorHandle = import('./SqlEditor').SqlEditorHandle;
const ChartView = lazy(() =>
  import('./ChartView').then((m) => ({ default: m.ChartView })),
);
const PivotBuilder = lazy(() =>
  import('./PivotBuilder').then((m) => ({ default: m.PivotBuilder })),
);
const FormatConverter = lazy(() =>
  import('./FormatConverter').then((m) => ({ default: m.FormatConverter })),
);
const QueryBuilder = lazy(() =>
  import('./QueryBuilder').then((m) => ({ default: m.QueryBuilder })),
);
const CleanPanel = lazy(() =>
  import('./CleanPanel').then((m) => ({ default: m.CleanPanel })),
);

type FileEntryState =
  | { kind: 'loading' }
  | { kind: 'ready'; metadata: TableMetadata; sample: QueryResult; loadDurationMs: number }
  | { kind: 'error'; message: string };

interface FileEntry {
  id: string;
  registered: RegisteredFile;
  state: FileEntryState;
}

type QueryState =
  | { kind: 'idle' }
  | { kind: 'executing' }
  | { kind: 'result'; result: QueryResult; durationMs: number }
  | { kind: 'error'; message: string };

const TYPE_BADGE: Record<ColumnCategory, string> = {
  integer: 'text-accent-brand border-accent-brand/30',
  number: 'text-accent-brand border-accent-brand/30',
  text: 'text-text-secondary border-border-subtle',
  boolean: 'text-accent-warn border-accent-warn/30',
  date: 'text-accent-success border-accent-success/30',
  datetime: 'text-accent-success border-accent-success/30',
  time: 'text-accent-success border-accent-success/30',
  complex: 'text-accent-warn border-accent-warn/30',
  blob: 'text-text-tertiary border-border-subtle',
  uuid: 'text-accent-brand border-accent-brand/30',
  null: 'text-text-tertiary border-border-subtle',
  other: 'text-text-tertiary border-border-subtle',
};

const TYPE_SHORT: Record<ColumnCategory, string> = {
  integer: 'INT',
  number: 'NUM',
  text: 'TXT',
  boolean: 'BOOL',
  date: 'DATE',
  datetime: 'TS',
  time: 'TIME',
  complex: 'JSON',
  blob: 'BLOB',
  uuid: 'UUID',
  null: 'NULL',
  other: '?',
};

function deriveColumns(result: QueryResult): ColumnInfo[] {
  return result.columns.map((name, i) => {
    const type = result.columnTypes[i] ?? 'unknown';
    return { name, type, category: categorizeType(type), nullable: true };
  });
}

export function QueryPad() {
  const [status, setStatus] = useState<DuckDBStatus>(getStatus());
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [allTables, setAllTables] = useState<string[]>([]);

  const tableColumns = useMemo<{ tableName: string; columns: ColumnInfo[] }[]>(() => {
    const out: { tableName: string; columns: ColumnInfo[] }[] = [];
    for (const f of files) {
      if (f.state.kind === 'ready') {
        out.push({ tableName: f.registered.virtualName, columns: f.state.metadata.columns });
      }
    }
    return out;
  }, [files]);

  const [sqlValue, setSqlValue] = useState<string>('');
  const [queryState, setQueryState] = useState<QueryState>({ kind: 'idle' });
  const [history, setHistory] = useState<QueryHistoryItem[]>(loadHistory);
  const [snippets, setSnippets] = useState<QuerySnippet[]>(loadSnippets);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'info' | 'error' }>>([]);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string; type?: 'success' | 'info' | 'error' }>).detail;
      if (detail && detail.message) {
        showToast(detail.message, detail.type || 'success');
      }
    };
    window.addEventListener('querydrop:toast', handleToastEvent);
    return () => window.removeEventListener('querydrop:toast', handleToastEvent);
  }, [showToast]);
  const [excelPicker, setExcelPicker] = useState<{
    filename: string;
    fileSizeBytes: number;
    file: File;
    sheets: ExcelSheetInfo[];
  } | null>(null);

  const sqlInitializedRef = useRef(false);
  const mountedRef = useRef(true);
  const [sharedPreview, setSharedPreview] = useState<ShareResultPayload | null>(null);
  const [pendingRestore, setPendingRestore] = useState<WorkspaceFile[]>([]);
  const [queryBuilderOpen, setQueryBuilderOpen] = useState(false);
  const [cleanOpen, setCleanOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const announce = useAnnouncer();

  useEffect(() => {
    return onStatusChange(setStatus);
  }, []);

  useEffect(() => {
    const init = () => {
      void getDuckDB().catch((err) => {
        console.error('[QueryPad] DuckDB init failed:', err);
      });
    };
    if (typeof (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback === 'function') {
      window.requestIdleCallback(init, { timeout: 2000 });
    } else {
      setTimeout(init, 150);
    }
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshTables = useCallback(async (conn: AsyncDuckDBConnection) => {
    try {
      setAllTables(await listTables(conn));
    } catch (err) {
      console.warn('[QueryPad] listTables failed:', err);
    }
}, []);

const loadAndRegisterFile = useCallback(
  async (file: File) => {
    if (status.kind !== 'ready') return;
    const db: AsyncDuckDB = status.db;
    const id = `${Date.now()}-${file.name}`;
    const format = detectFormat(file.name, file.type);
    const isArrowLike = format === 'arrow' || format === 'feather';

    const placeholder: FileEntry = {
      id,
      registered: {
        virtualName: '',
        originalName: file.name,
        sizeBytes: file.size,
        format,
      },
      state: { kind: 'loading' },
    };
    setFiles((prev) => [...prev, placeholder]);
    setActiveId(id);

    let conn: AsyncDuckDBConnection | null = null;
    const startedAt = performance.now();
    try {
      let registered: RegisteredFile;
      if (isArrowLike) {
        const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
        registered = {
          virtualName: `${baseName}_${Date.now()}`,
          originalName: file.name,
          sizeBytes: file.size,
          format,
        };
      } else {
        registered = await registerFile(db, file, format);
      }
      if (!mountedRef.current) return;
      conn = await db.connect();

      if (isArrowLike) {
        await insertArrowFile(conn, file, registered.virtualName);
      } else {
        // registerFile only exposes the file on the virtual filesystem; make
        // it a real table so DESCRIBE / SELECT * FROM <name> work (see
        // materializeFile in queries.ts).
        await materializeFile(conn, registered.virtualName, format);
      }

      const [metadata, sample] = await Promise.all([
        getTableMetadata(conn, registered.virtualName),
        getSample(conn, registered.virtualName, 100),
      ]);
      if (!mountedRef.current) return;

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                registered,
                state: {
                  kind: 'ready',
                  metadata,
                  sample,
                  loadDurationMs: Math.round(performance.now() - startedAt),
                },
              }
            : f,
        ),
      );
      announce(
        `Loaded ${file.name}, ${metadata.columns.length} columns, ${metadata.totalRowCount.toLocaleString()} rows`,
      );
      await refreshTables(conn);
    } catch (err) {
      if (!mountedRef.current) return;
      const errMsg = err instanceof Error ? err.message : String(err);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, state: { kind: 'error', message: errMsg } } : f,
        ),
      );
      announce(`Failed to load ${file.name}: ${errMsg.split('\n')[0]}`);
    } finally {
      conn?.close().catch(() => {});
    }
  },
  [status, refreshTables, announce],
);

const onFile = useCallback(
    async (file: File) => {
      if (status.kind !== 'ready') return;
      const format = detectFormat(file.name, file.type);
      if (format === 'geojson') {
        try {
          const ndjsonFile = await geojsonToNdjson(file);
          await loadAndRegisterFile(ndjsonFile);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const id = `${Date.now()}-${file.name}`;
          setFiles((prev) => [
            ...prev,
            {
              id,
              registered: { virtualName: '', originalName: file.name, sizeBytes: file.size, format: 'geojson' },
              state: { kind: 'error', message: `GeoJSON conversion failed: ${message}` },
            },
          ]);
          setActiveId(id);
        }
        return;
      }
      if (format === 'excel') {
        try {
          const { sheets } = await parseExcelSheets(file);
          if (sheets.length === 0) {
            const id = `${Date.now()}-${file.name}`;
            setFiles((prev) => [
              ...prev,
              {
                id,
                registered: { virtualName: '', originalName: file.name, sizeBytes: file.size, format: 'excel' },
                state: { kind: 'error', message: 'Workbook has no sheets' },
              },
            ]);
            setActiveId(id);
            return;
          }
          if (sheets.length === 1) {
            const csvFile = await excelSheetToCsv(file, sheets[0]!.name);
            await loadAndRegisterFile(csvFile);
            return;
          }
          setExcelPicker({ filename: file.name, fileSizeBytes: file.size, file, sheets });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const id = `${Date.now()}-${file.name}`;
          setFiles((prev) => [
            ...prev,
            {
              id,
              registered: { virtualName: '', originalName: file.name, sizeBytes: file.size, format: 'excel' },
              state: { kind: 'error', message: `Failed to parse Excel: ${message}` },
            },
          ]);
          setActiveId(id);
        }
        return;
      }
      await loadAndRegisterFile(file);
    },
    [status, loadAndRegisterFile],
  );

  const openConn = useCallback(async () => {
    if (status.kind !== 'ready') {
      throw new Error('DuckDB not ready');
    }
    const conn = await status.db.connect();
    return { db: status.db, conn };
  }, [status]);

  const handleExcelSheetSelect = useCallback(
    async (sheetName: string) => {
      if (!excelPicker) return;
      const file = excelPicker.file;
      setExcelPicker(null);
      try {
        const csvFile = await excelSheetToCsv(file, sheetName);
        await loadAndRegisterFile(csvFile);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const id = `${Date.now()}-${file.name}`;
        setFiles((prev) => [
          ...prev,
          {
            id,
            registered: { virtualName: '', originalName: file.name, sizeBytes: file.size, format: 'excel' },
            state: { kind: 'error', message: `Excel sheet conversion failed: ${message}` },
          },
        ]);
        setActiveId(id);
      }
    },
    [excelPicker, loadAndRegisterFile],
  );

  const handleExcelPickerCancel = useCallback(() => {
    setExcelPicker(null);
  }, []);

  const removeFile = useCallback(
    async (id: string) => {
      const target = files.find((f) => f.id === id);
      if (!target) return;
      if (typeof window !== 'undefined' && !window.confirm(`Are you sure you want to remove "${target.registered.originalName}"?`)) {
        return;
      }
      if (target.registered.virtualName && status.kind === 'ready') {
        try {
          const conn = await status.db.connect();
          try {
            await conn.query(`DROP TABLE IF EXISTS "${target.registered.virtualName.replace(/"/g, '""')}"`);
          } finally {
            conn.close().catch(() => {});
          }
          const refreshConn = await status.db.connect();
          try {
            await refreshTables(refreshConn);
          } finally {
            refreshConn.close().catch(() => {});
          }
        } catch (err) {
          console.warn('[QueryPad] drop table failed:', err);
        }
      }
      setFiles((prev) => {
        const next = prev.filter((f) => f.id !== id);
        setActiveId((cur) => (cur === id ? (next[0]?.id ?? null) : cur));
        return next;
      });
    },
    [files, status, refreshTables],
  );

  useEffect(() => {
    if (sqlInitializedRef.current) return;
    const { q, r } = readShareFromSearch(window.location.search);
    if (q) {
      void decodeShare(q).then((payload) => {
        if (payload && payload.sql) {
          sqlInitializedRef.current = true;
          setSqlValue(payload.sql);
          if (r) {
            void decodeShareResult(r).then((preview) => {
              if (preview) setSharedPreview(preview);
            });
          }
          const params = new URLSearchParams(window.location.search);
          params.delete('q');
          params.delete('r');
          const s = params.toString();
          window.history.replaceState(null, '', window.location.pathname + (s ? `?${s}` : ''));
        }
      });
      return;
    }
    let autosaved: string | null = null;
    try {
      autosaved = localStorage.getItem('querydrop:autosaved-sql');
    } catch {}
    if (autosaved) {
      sqlInitializedRef.current = true;
      setSqlValue(autosaved);
      return;
    }
    const firstReady = files.find((f) => f.state.kind === 'ready');
    if (!firstReady || firstReady.state.kind !== 'ready') return;
    sqlInitializedRef.current = true;
    setSqlValue(`SELECT * FROM ${firstReady.registered.virtualName} LIMIT 100`);
  }, [files]);

  useEffect(() => {
    if (sqlValue) {
      try {
        localStorage.setItem('querydrop:autosaved-sql', sqlValue);
      } catch {}
    }
  }, [sqlValue]);

  useEffect(() => {
    if (pendingRestore.length === 0) return;
    const consumed = new Set<number>();
    for (const f of files) {
      if (f.state.kind !== 'ready') continue;
      const idx = pendingRestore.findIndex(
        (p, i) => !consumed.has(i) && p.name === f.registered.originalName && p.size === f.registered.sizeBytes,
      );
      if (idx < 0) continue;
      consumed.add(idx);
      const match = pendingRestore[idx];
      if (!match) continue;
      setPendingRestore((prev) => prev.filter((_, j) => j !== idx));
      const newName = f.registered.virtualName;
      if (match.tableName !== newName) {
        setSqlValue((prev) => rewriteSqlTableRef(prev, match.tableName, newName));
      }
    }
  }, [files, pendingRestore]);

  const currentWorkspaceFiles = useMemo<WorkspaceFile[]>(() => {
    return files
      .filter((f): f is FileEntry & { state: { kind: 'ready' } } => f.state.kind === 'ready')
      .map((f) => ({
        name: f.registered.originalName,
        size: f.registered.sizeBytes,
        format: f.registered.format,
        tableName: f.registered.virtualName,
      }));
  }, [files]);

  const handleRestoreWorkspace = useCallback((ws: Workspace) => {
    setSqlValue(ws.sql);
  }, []);

  const handleApplyClean = useCallback(
    async (sql: string) => {
      if (status.kind !== 'ready') return;
      const conn = await status.db.connect();
      try {
        await runQuery(conn, sql);
        await refreshTables(conn);
      } finally {
        conn.close().catch(() => {});
      }
    },
    [status, refreshTables],
  );

  const handleRun = useCallback(async () => {
    if (status.kind !== 'ready') return;
    if (queryState.kind === 'executing') return;
    const sql = sqlValue.trim();
    if (!sql) return;
    let conn: AsyncDuckDBConnection | null = null;
    setSharedPreview(null);
    setQueryState({ kind: 'executing' });
    announce('Running query…');
    const startedAt = performance.now();
    const id = crypto.randomUUID();
    const virtualNames: string[] = [];
    for (const f of files) {
      if (f.state.kind === 'ready') virtualNames.push(f.registered.virtualName);
    }
    try {
      conn = await status.db.connect();
      const result = await runQuery(conn, sql);
      if (!mountedRef.current) return;
      const durationMs = Math.round(performance.now() - startedAt);
      setQueryState({ kind: 'result', result, durationMs });
      announce(`Query completed in ${durationMs} milliseconds, ${result.rowCount.toLocaleString()} rows`);
      setHistory((h) =>
        pushHistory(
          { id, sql, virtualNames, rowCount: result.rowCount, durationMs, ts: Date.now(), success: true },
          h,
        ),
      );
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      const durationMs = Math.round(performance.now() - startedAt);
      setQueryState({ kind: 'error', message });
      announce(`Query failed: ${message.split('\n')[0]}`);
      setHistory((h) =>
        pushHistory(
          { id, sql, virtualNames, rowCount: null, durationMs, ts: Date.now(), success: false, error: message },
          h,
        ),
      );
    } finally {
      conn?.close().catch(() => {});
    }
  }, [status, sqlValue, queryState.kind, files, announce]);

  const handleClearQuery = useCallback(() => {
    setQueryState({ kind: 'idle' });
  }, []);

  const handleSelectHistory = useCallback((sql: string) => {
    setSqlValue(sql);
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    clearHistory();
  }, []);

  const handleSaveSnippet = useCallback(
    (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) return;
      const trimmedSql = sqlValue.trim();
      if (!trimmedSql) return;
      setSnippets((s) => saveSnippet(trimmedName, trimmedSql, s).snippets);
    },
    [sqlValue],
  );

  const handleDeleteSnippet = useCallback((id: string) => {
    setSnippets((s) => deleteSnippet(id, s));
  }, []);

  const handleRenameSnippet = useCallback((id: string, name: string) => {
    setSnippets((s) => renameSnippet(id, name, s));
  }, []);

  const [pivotOpen, setPivotOpen] = useState(false);
  const [pivotExecuting, setPivotExecuting] = useState(false);
const [converterOpen, setConverterOpen] = useState(false);

const active = files.find((f) => f.id === activeId) ?? null;

const pivotSource = useMemo(() => {
    if (!active) return null;
    if (active.state.kind !== 'ready') return null;
    return {
      tableName: active.registered.virtualName,
      originalName: active.registered.originalName,
      columns: active.state.metadata.columns,
    };
  }, [active]);

  const openPivot = useCallback(() => {
    if (!pivotSource) return;
    setPivotOpen(true);
  }, [pivotSource]);

  const closePivot = useCallback(() => {
    setPivotOpen(false);
  }, []);

  const handleBuildPivot = useCallback(
    async (spec: PivotSpec) => {
      if (status.kind !== 'ready') return;
      if (!pivotSource) return;
      const sql = generatePivotSQL(pivotSource.tableName, spec);
      const virtualNames = [pivotSource.tableName];
      let conn: AsyncDuckDBConnection | null = null;
      setPivotExecuting(true);
      setPivotOpen(false);
      setSharedPreview(null);
      setQueryState({ kind: 'executing' });
      const startedAt = performance.now();
      const id = crypto.randomUUID();
    try {
      conn = await status.db.connect();
      const result = await runQuery(conn, sql);
      if (!mountedRef.current) return;
      const durationMs = Math.round(performance.now() - startedAt);
      setQueryState({ kind: 'result', result, durationMs });
      setHistory((h) =>
        pushHistory(
          { id, sql, virtualNames, rowCount: result.rowCount, durationMs, ts: Date.now(), success: true },
          h,
        ),
      );
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      const durationMs = Math.round(performance.now() - startedAt);
      setQueryState({ kind: 'error', message });
      setHistory((h) =>
        pushHistory(
          { id, sql, virtualNames, rowCount: null, durationMs, ts: Date.now(), success: false, error: message },
          h,
        ),
      );
    } finally {
      conn?.close().catch(() => {});
      setPivotExecuting(false);
    }
    },
    [status, pivotSource],
);

const dbReady = status.kind === 'ready';
  const canRun = dbReady && queryState.kind !== 'executing' && sqlValue.trim().length > 0;

  return (
    <SrAnnouncerProvider>
      <div className="flex-1 flex flex-col min-h-[100dvh]">
      <StatusBar status={status} />

      <div className="flex-1 p-4 sm:p-6 pb-20 md:pb-6">
        <div className="max-w-7xl mx-auto">
          {files.length === 0 ? (
            <div className="space-y-4">
              <Dropzone onFile={onFile} disabled={!dbReady} disabledReason={status.kind === 'loading' ? 'Loading DuckDB…' : 'DuckDB not ready'} />
              <SampleLibrary
                onFile={onFile}
                disabled={!dbReady}
                disabledReason={status.kind === 'loading' ? 'Loading DuckDB…' : 'DuckDB not ready'}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRestore.length > 0 && (
                <PendingRestoreBanner
                  pending={pendingRestore}
                  onDismiss={() => setPendingRestore([])}
                />
              )}
              <FileChips
                files={files}
                activeId={activeId}
                onSelect={setActiveId}
                onRemove={removeFile}
                onAddMore={onFile}
                addDisabled={!dbReady}
              />

              <EditorPanel
                value={sqlValue}
                onChange={setSqlValue}
                onRun={handleRun}
                onClear={handleClearQuery}
                canRun={canRun}
                executing={queryState.kind === 'executing'}
                tables={allTables}
                tableColumns={tableColumns}
                activeTable={active?.state.kind === 'ready' ? active.state.metadata.tableName : undefined}
                lastResult={queryState.kind === 'result' ? queryState.result : null}
                hasResult={queryState.kind === 'result' || queryState.kind === 'error'}
                history={history}
                snippets={snippets}
                onSelectHistory={handleSelectHistory}
                onClearHistory={handleClearHistory}
                onSaveSnippet={handleSaveSnippet}
                onDeleteSnippet={handleDeleteSnippet}
                onRenameSnippet={handleRenameSnippet}
                currentFiles={currentWorkspaceFiles}
                onRestoreWorkspace={handleRestoreWorkspace}
                onApplyClean={handleApplyClean}
                queryBuilderOpen={queryBuilderOpen}
                setQueryBuilderOpen={setQueryBuilderOpen}
                cleanOpen={cleanOpen}
                setCleanOpen={setCleanOpen}
                shareOpen={shareOpen}
                setShareOpen={setShareOpen}
                workspaceOpen={workspaceOpen}
                setWorkspaceOpen={setWorkspaceOpen}
              />

              {sharedPreview && queryState.kind === 'idle' && (
                <SharedPreviewBanner
                  preview={sharedPreview}
                  onDismiss={() => setSharedPreview(null)}
                />
              )}

              {active ? (
                <ViewArea
                entry={active}
                queryState={queryState}
                sql={sqlValue}
                onBackToData={handleClearQuery}
                pivotSource={pivotSource}
                pivotOpen={pivotOpen}
                pivotExecuting={pivotExecuting}
                onOpenPivot={openPivot}
                onClosePivot={closePivot}
        onBuildPivot={handleBuildPivot}
        onOpenConverter={() => setConverterOpen(true)}
        sqlValue={sqlValue}
        openConn={openConn}
      />
              ) : (
                <EmptyHint />
              )}

              {allTables.length > 0 && (
                <div className="text-xs mono text-text-tertiary px-1">
                  Tables in DuckDB:{' '}
                  {allTables.map((t) => (
                    <span key={t} className="ml-2 text-accent-brand">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {excelPicker && (
        <ExcelSheetPicker
          filename={excelPicker.filename}
          fileSizeBytes={excelPicker.fileSizeBytes}
          sheets={excelPicker.sheets}
          onSelect={handleExcelSheetSelect}
          onCancel={handleExcelPickerCancel}
        />
      )}
      {converterOpen && (
        <Suspense fallback={null}>
          <FormatConverter
            open={converterOpen}
            onClose={() => setConverterOpen(false)}
            currentResult={queryState.kind === 'result' && queryState.result.rowCount > 0 ? queryState.result : null}
          />
        </Suspense>
      )}
      <MobileRunBar
        onRun={handleRun}
        onOpenBuild={() => setQueryBuilderOpen(true)}
        onOpenClean={() => setCleanOpen(true)}
        onOpenWorkspace={() => setWorkspaceOpen(true)}
        onOpenShare={() => setShareOpen(true)}
        canRun={canRun}
        isRunning={queryState.kind === 'executing'}
        hasFiles={files.length > 0}
        hasQuery={sqlValue.trim().length > 0}
      />
      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg border shadow-lg text-xs font-semibold mono transition-all ${
              toast.type === 'success'
                ? 'bg-bg-1 border-accent-success text-accent-success'
                : toast.type === 'error'
                ? 'bg-bg-1 border-accent-danger text-accent-danger'
                : 'bg-bg-1 border-accent-brand text-accent-brand'
            }`}
          >
            <Icon
              name={toast.type === 'success' ? 'check' : toast.type === 'error' ? 'close' : 'sparkle'}
              size={12}
            />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
      </div>
    </SrAnnouncerProvider>
  );
}

function StatusBar({ status }: { status: DuckDBStatus }) {
  const dot =
    status.kind === 'ready'
      ? { color: 'bg-accent-success', label: `DuckDB ready${status.buildUsed === 'mvp' ? ' · MVP (no pthreads)' : ' · EH (with pthreads)'}` }
      : status.kind === 'loading'
      ? { color: 'bg-accent-warn', label: status.message ?? 'Loading…' }
      : status.kind === 'error'
      ? { color: 'bg-accent-danger', label: 'DuckDB error — reload to retry' }
      : { color: 'bg-text-tertiary', label: 'DuckDB idle' };

  return (
    <div className="h-9 px-3 sm:px-6 border-b border-border-subtle bg-bg-1 flex items-center gap-1 sm:gap-2 text-[11px] sm:text-xs mono">
      <span className={`w-1.5 h-1.5 rounded-full ${dot.color} shrink-0`} />
      <span className="text-text-secondary truncate">{dot.label}</span>
    </div>
  );
}

function Dropzone({
  onFile,
  disabled,
  disabledReason,
}: {
  onFile: (f: File) => void;
  disabled: boolean;
  disabledReason?: string;
}) {
  return (
    <label
      htmlFor="qd-file"
      className={`block bg-bg-1 border-2 border-dashed rounded-xl p-10 sm:p-16 text-center transition-colors ${
        disabled
          ? 'border-border-subtle opacity-50 cursor-not-allowed'
          : 'border-border-default cursor-pointer hover:border-accent-brand hover:bg-bg-2 group'
      }`}
    >
      <div className="w-14 h-14 mx-auto mb-5 rounded-lg bg-bg-2 border border-border-subtle flex items-center justify-center text-accent-brand group-hover:bg-bg-2 transition-shadow">
        <Icon name="upload" size={28} />
      </div>
      <div className="text-lg font-semibold text-text-primary mb-1.5">
        {disabled ? (disabledReason ?? 'Loading…') : 'Drop a file here, or click to browse'}
      </div>
      <div className="text-sm text-text-secondary mb-6">
        CSV · TSV · JSON · NDJSON · Parquet · Excel · Arrow · Feather · GeoJSON — up to 100 MB. Your file never leaves this browser.
      </div>
      <input
        id="qd-file"
        type="file"
        accept=".csv,.tsv,.json,.ndjson,.xlsx,.xls,.parquet,.feather,.arrow,.ipc,.geojson,.avro,.orc,.nc,.netcdf"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function FileChips({
  files,
  activeId,
  onSelect,
  onRemove,
  onAddMore,
  addDisabled,
}: {
  files: FileEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAddMore: (f: File) => void;
  addDisabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {files.map((f) => {
        const isActive = f.id === activeId;
        const statusDot =
          f.state.kind === 'loading'
            ? 'bg-accent-warn animate-spin'
            : f.state.kind === 'error'
            ? 'bg-accent-danger'
            : 'bg-accent-success';
        return (
          <div
            key={f.id}
            className={`flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md border text-xs mono ${
              isActive
                ? 'bg-bg-2 border-accent-brand/50 text-text-primary'
                : 'bg-bg-1 border-border-subtle text-text-secondary hover:border-border-default'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(f.id)}
              className="flex items-center gap-1.5"
              title={f.registered.originalName}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
              <span className="max-w-[200px] truncate">{f.registered.originalName}</span>
              <span className="text-text-tertiary">{f.state.kind === 'ready' ? formatBytes(f.registered.sizeBytes) : '…'}</span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(f.id)}
              className="ml-1 w-4 h-4 rounded-sm flex items-center justify-center text-text-tertiary hover:text-accent-danger hover:bg-accent-danger/10"
              aria-label={`Remove ${f.registered.originalName}`}
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        );
      })}
      <label
        htmlFor="qd-add-more"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dashed text-xs mono ${
          addDisabled
            ? 'border-border-subtle text-text-tertiary cursor-not-allowed'
            : 'border-border-default text-text-secondary cursor-pointer hover:border-accent-brand hover:text-accent-brand'
        }`}
      >
        <Icon name="plus" size={12} />
        <span>Add another</span>
        <input
          id="qd-add-more"
          type="file"
          accept=".csv,.tsv,.json,.ndjson,.xlsx,.xls,.parquet,.avro,.feather,.arrow,.orc,.geojson,.nc,.netcdf"
          className="sr-only"
          disabled={addDisabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAddMore(f);
          }}
        />
      </label>
    </div>
  );
}

function EditorPanel({
  value,
  onChange,
  onRun,
  onClear,
  canRun,
  executing,
  tables,
  tableColumns,
  activeTable,
  lastResult,
  hasResult,
  history,
  snippets,
  onSelectHistory,
  onClearHistory,
  onSaveSnippet,
  onDeleteSnippet,
  onRenameSnippet,
  currentFiles,
  onRestoreWorkspace,
  onApplyClean,
  queryBuilderOpen,
  setQueryBuilderOpen,
  cleanOpen,
  setCleanOpen,
  shareOpen,
  setShareOpen,
  workspaceOpen,
  setWorkspaceOpen,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  onClear: () => void;
  canRun: boolean;
  executing: boolean;
  tables: string[];
  tableColumns: { tableName: string; columns: ColumnInfo[] }[];
  activeTable: string | undefined;
  lastResult: QueryResult | null;
  hasResult: boolean;
  history: QueryHistoryItem[];
  snippets: QuerySnippet[];
  onSelectHistory: (sql: string) => void;
  onClearHistory: () => void;
  onSaveSnippet: (name: string) => void;
  onDeleteSnippet: (id: string) => void;
  onRenameSnippet: (id: string, name: string) => void;
  currentFiles: WorkspaceFile[];
  onRestoreWorkspace: (ws: Workspace) => void;
  onApplyClean: (sql: string) => Promise<void>;
  queryBuilderOpen: boolean;
  setQueryBuilderOpen: (v: boolean) => void;
  cleanOpen: boolean;
  setCleanOpen: (v: boolean) => void;
  shareOpen: boolean;
  setShareOpen: (v: boolean) => void;
  workspaceOpen: boolean;
  setWorkspaceOpen: (v: boolean) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<SqlEditorHandle>(null);

  const handleFormat = () => {
    if (!value.trim()) return;
    const formatted = formatSQL(value);
    onChange(formatted);
    editorRef.current?.setValue?.(formatted);
  };

  const openSave = () => {
    setSaveName('');
    setIsSaving(true);
    queueMicrotask(() => inputRef.current?.focus());
  };

  const commitSave = () => {
    const name = saveName.trim();
    if (name && value.trim()) onSaveSnippet(name);
    setIsSaving(false);
    setSaveName('');
  };

  const cancelSave = () => {
    setIsSaving(false);
    setSaveName('');
  };

  const canSave = value.trim().length > 0;

  return (
    <div className="bg-bg-1 border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-[10px] mono uppercase tracking-wider text-text-tertiary">SQL Editor</div>
          <HistoryDropdown
            history={history}
            snippets={snippets}
            onSelectHistory={onSelectHistory}
            onClearHistory={onClearHistory}
            onDeleteSnippet={onDeleteSnippet}
            onRenameSnippet={onRenameSnippet}
          />
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setQueryBuilderOpen(true)}
            disabled={tables.length === 0}
            aria-label="Open visual query builder"
            className="flex items-center gap-1.5 px-2.5 py-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 justify-center sm:justify-start text-xs mono text-text-secondary hover:text-accent-brand disabled:opacity-40 disabled:cursor-not-allowed"
            title="Open visual query builder"
          >
            <Icon name="code" size={12} />
            <span className="hidden sm:inline">Build</span>
          </button>
          <button
            type="button"
            onClick={() => setCleanOpen(true)}
            disabled={tables.length === 0}
            aria-label="Open data cleaning panel"
            className="flex items-center gap-1.5 px-2.5 py-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 justify-center sm:justify-start text-xs mono text-text-secondary hover:text-accent-brand disabled:opacity-40 disabled:cursor-not-allowed"
            title="Open data cleaning panel"
          >
            <Icon name="clean" size={12} />
            <span className="hidden sm:inline">Clean</span>
          </button>
          <TemplateMenu
            activeTable={activeTable}
            onInsert={(sql) => editorRef.current?.insertText(sql)}
          />
          <button
            type="button"
            onClick={handleFormat}
            disabled={!value.trim()}
            aria-label="Prettify SQL"
            className="flex items-center gap-1.5 px-2.5 py-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 justify-center sm:justify-start text-xs mono text-text-secondary hover:text-accent-brand disabled:opacity-40 disabled:cursor-not-allowed"
            title="Format SQL"
          >
            <Icon name="sparkle" size={12} className="text-accent-brand" />
            <span className="hidden sm:inline">Format</span>
          </button>
          <WorkspaceMenu
            currentFiles={currentFiles}
            currentSql={value}
            onRestore={onRestoreWorkspace}
            open={workspaceOpen}
            onOpenChange={setWorkspaceOpen}
          />
          <button
            type="button"
            onClick={onClear}
            disabled={!hasResult}
            aria-label="Clear query result"
            className="px-2.5 py-1 min-h-[44px] sm:min-h-0 text-xs text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="hidden sm:inline">Clear result</span>
            <Icon name="trash" size={12} className="sm:hidden" />
          </button>
          {isSaving ? (
            <input
              ref={inputRef}
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitSave();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelSave();
                }
              }}
              onBlur={commitSave}
              maxLength={50}
              placeholder="Snippet name"
              className="px-2 py-1 text-xs mono bg-bg-0 border border-accent-warn/50 rounded-md text-text-primary focus:outline-none focus:border-accent-warn w-36"
            />
          ) : (
            <button
              type="button"
              onClick={openSave}
              disabled={!canSave}
              aria-label="Save current query as named snippet"
              className="flex items-center gap-1.5 px-2.5 py-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 justify-center sm:justify-start text-xs mono text-text-secondary hover:text-accent-warn disabled:opacity-40 disabled:cursor-not-allowed"
              title="Save current query as named snippet"
            >
              <Icon name="pin" size={12} />
              <span className="hidden sm:inline">Save</span>
            </button>
          )}
          <ShareMenu
            sql={value}
            activeTable={activeTable}
            lastResult={lastResult}
            open={shareOpen}
            onOpenChange={setShareOpen}
          />
          <button
            type="button"
            onClick={onRun}
            disabled={!canRun}
            aria-label={executing ? 'Query running' : 'Run query'}
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              canRun
                ? 'bg-accent-brand/10 border border-accent-brand/40 text-accent-brand hover:bg-accent-brand/20'
                : 'bg-bg-2 border border-border-subtle text-text-tertiary cursor-not-allowed'
            }`}
          >
            {executing ? (
              <>
                <span className="inline-block w-3 h-3 border border-accent-brand border-t-transparent rounded-full animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Icon name="play" size={12} />
                Run <kbd className="ml-1 px-1 py-0.5 text-[10px] mono bg-bg-0 border border-border-subtle rounded">⌘↵</kbd>
              </>
            )}
          </button>
        </div>
      </div>
      <Suspense fallback={<SqlEditorFallback />}>
        <SqlEditor
          ref={editorRef}
          value={value}
          onChange={onChange}
          onRun={onRun}
          tables={tables}
          tableColumns={tableColumns}
          minHeight="140px"
        />
      </Suspense>
      {queryBuilderOpen && (
        <Suspense fallback={null}>
          <QueryBuilder
            open={queryBuilderOpen}
            onClose={() => setQueryBuilderOpen(false)}
            tables={tables}
            tableColumns={tableColumns}
            defaultTable={activeTable}
            onInsert={(sql) => editorRef.current?.insertText(sql)}
            onRun={onRun}
          />
        </Suspense>
      )}
      {cleanOpen && (
        <Suspense fallback={null}>
          <CleanPanel
            open={cleanOpen}
            onClose={() => setCleanOpen(false)}
            tables={tables}
            tableColumns={tableColumns}
            defaultTable={activeTable}
            onInsert={(sql) => editorRef.current?.insertText(sql)}
            onApply={onApplyClean}
          />
        </Suspense>
      )}
    </div>
  );
}

function SqlEditorFallback() {
  return (
    <div className="h-[140px] flex items-center justify-center bg-bg-0 text-text-tertiary text-xs mono">
      <span className="inline-block w-3 h-3 border border-accent-brand border-t-transparent rounded-full animate-spin mr-2" />
      Loading editor…
    </div>
  );
}

function ViewArea({
  entry,
  queryState,
  sql,
  onBackToData,
  pivotSource,
  pivotOpen,
  pivotExecuting,
  onOpenPivot,
  onClosePivot,
  onBuildPivot,
  onOpenConverter,
  sqlValue,
  openConn,
}: {
  entry: FileEntry;
  queryState: QueryState;
  sql: string;
  onBackToData: () => void;
  pivotSource: { tableName: string; originalName: string; columns: ColumnInfo[] } | null;
  pivotOpen: boolean;
  pivotExecuting: boolean;
  onOpenPivot: () => void;
  onClosePivot: () => void;
  onBuildPivot: (spec: PivotSpec) => void;
  onOpenConverter: () => void;
  sqlValue: string;
  openConn: () => Promise<{ db: AsyncDuckDB; conn: AsyncDuckDBConnection }>;
}) {
  if (entry.state.kind === 'loading') {
    return (
      <div className="bg-bg-1 border border-accent-warn/30 rounded-xl p-6 text-center">
        <div className="text-xs mono text-accent-warn inline-flex items-center gap-2">
          <span className="inline-block w-3 h-3 border border-accent-warn border-t-transparent rounded-full animate-spin" />
          Loading {entry.registered.originalName}…
        </div>
      </div>
    );
  }
  if (entry.state.kind === 'error') {
    return (
      <div className="bg-bg-1 border border-accent-danger/40 rounded-xl p-6">
        <div className="text-xs mono text-accent-danger mb-2 font-semibold">Failed to load {entry.registered.originalName}</div>
        <pre className="text-xs mono text-text-secondary whitespace-pre-wrap break-words">{entry.state.message}</pre>
      </div>
    );
  }
  // entry.state.kind === 'ready'
  if (queryState.kind === 'result') {
    return (
      <ResultView
        result={queryState.result}
        durationMs={queryState.durationMs}
        sql={sql}
        onBackToData={onBackToData}
        pivotSource={pivotSource}
        pivotOpen={pivotOpen}
        pivotExecuting={pivotExecuting}
      onOpenPivot={onOpenPivot}
          onClosePivot={onClosePivot}
          onBuildPivot={onBuildPivot}
          onOpenConverter={onOpenConverter}
          sqlValue={sqlValue}
          openConn={openConn}
        />
    );
  }
  if (queryState.kind === 'error') {
    return <ErrorView message={queryState.message} sql={sql} onBackToData={onBackToData} />;
  }
  return (
    <SourcePreview
      name={entry.registered.originalName}
      format={entry.registered.format}
      sizeBytes={entry.registered.sizeBytes}
      metadata={entry.state.metadata}
      sample={entry.state.sample}
      loadDurationMs={entry.state.loadDurationMs}
    />
  );
}

function SourcePreview({
  name,
  format,
  sizeBytes,
  metadata,
  sample,
  loadDurationMs,
}: {
  name: string;
  format: FileFormat;
  sizeBytes: number;
  metadata: TableMetadata;
  sample: QueryResult;
  loadDurationMs: number;
}) {
  const showingRows = Math.min(sample.rowCount, 100);
  const truncated = sample.rowCount > 100;
  return (
    <div className="bg-bg-1 border border-border-subtle rounded-xl overflow-hidden">
      <FileSummary
        name={name}
        format={format}
        sizeBytes={sizeBytes}
        totalRows={metadata.totalRowCount}
        columns={metadata.columns.length}
        loadDurationMs={loadDurationMs}
      />
      <SchemaPanel columns={metadata.columns} stats={metadata.stats} />
      <DataTable
        sample={sample}
        columns={metadata.columns}
        showingRows={showingRows}
        truncated={truncated}
        caption="Source preview"
      />
    </div>
  );
}

function FileSummary({
  name,
  format,
  sizeBytes,
  totalRows,
  columns,
  loadDurationMs,
}: {
  name: string;
  format: string;
  sizeBytes: number;
  totalRows: number;
  columns: number;
  loadDurationMs: number;
}) {
  return (
    <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-3 flex-wrap text-xs mono">
      <span className="text-text-primary font-semibold truncate max-w-[40ch]" title={name}>
        {name}
      </span>
      <span className="text-text-tertiary">·</span>
      <span className="text-text-secondary">{format.toUpperCase()}</span>
      <span className="text-text-tertiary">·</span>
      <span className="text-text-secondary">{formatBytes(sizeBytes)}</span>
      <span className="text-text-tertiary">·</span>
      <span className="text-text-primary">{formatNumber(totalRows)}</span>
      <span className="text-text-tertiary">rows</span>
      <span className="text-text-tertiary">·</span>
      <span className="text-text-primary">{columns}</span>
      <span className="text-text-tertiary">columns</span>
      <span className="text-text-tertiary">·</span>
      <span className="text-text-secondary">{loadDurationMs}ms</span>
    </div>
  );
}

function SchemaPanel({ columns, stats }: { columns: ColumnInfo[]; stats?: ColumnStats[] }) {
  const [expandedCol, setExpandedCol] = useState<string | null>(null);

  return (
    <div className="px-4 py-3 border-b border-border-subtle">
      <div className="text-[10px] mono uppercase tracking-wider text-text-tertiary mb-2 flex items-center justify-between">
        <span>Schema</span>
        {stats && <span className="text-[9px] text-text-tertiary/60 lowercase normal-case">click column to see stats</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {columns.map((c) => {
          const s = stats?.find((st) => st.columnName === c.name);
          const isExpanded = expandedCol === c.name;

          return (
            <div key={c.name} className="flex flex-col">
              <button
                type="button"
                onClick={() => setExpandedCol(isExpanded ? null : c.name)}
                disabled={!s}
                className={`inline-flex items-center gap-1.5 px-2 py-1 bg-bg-2 border rounded text-xs mono hover:border-accent-brand transition-colors text-left ${TYPE_BADGE[c.category]} ${isExpanded ? 'border-accent-brand' : ''}`}
                title={s ? `${c.name}: ${c.type}. Uniques: ${s.approxUnique}, Nulls: ${s.nullPercentage}%. Click to toggle details.` : `${c.name}: ${c.type}${c.nullable ? ' (nullable)' : ''}`}
              >
                <span className="text-text-primary">{c.name}</span>
                <span className="text-text-tertiary">:</span>
                <span className="font-semibold">{TYPE_SHORT[c.category]}</span>
                {!c.nullable && <span className="text-text-tertiary text-[10px]">NN</span>}
              </button>
              {isExpanded && s && (
                <div className="mt-1 p-2 bg-bg-1 border border-border-subtle rounded text-[10px] mono text-text-secondary space-y-0.5 max-w-xs z-10 shadow-md">
                  <div><span className="text-text-tertiary font-semibold">min:</span> {s.min}</div>
                  <div><span className="text-text-tertiary font-semibold">max:</span> {s.max}</div>
                  {s.avg !== null && <div><span className="text-text-tertiary font-semibold">mean:</span> {s.avg.toFixed(2)}</div>}
                  <div><span className="text-text-tertiary font-semibold">uniques:</span> {s.approxUnique.toLocaleString()}</div>
                  <div><span className="text-text-tertiary font-semibold">nulls:</span> {s.nullPercentage.toFixed(1)}%</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DataTable({
  sample,
  columns,
  showingRows,
  truncated,
  caption,
}: {
  sample: QueryResult;
  columns: ColumnInfo[];
  showingRows: number;
  truncated: boolean;
  caption?: string;
}) {
  const typeByCol = useMemo(() => {
    const m = new Map<string, ColumnInfo>();
    for (const c of columns) m.set(c.name, c);
    return m;
  }, [columns]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sample.rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 8,
  });

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const first = items[0];
  const last = items[items.length - 1];
  const paddingTop = items.length > 0 && first ? first.start : 0;
  const paddingBottom = items.length > 0 && last ? totalSize - last.start - last.size : 0;

  return (
    <div>
      {caption && (
        <div className="px-4 py-1.5 border-b border-border-subtle bg-bg-0/40 text-[10px] mono uppercase tracking-wider text-text-tertiary">
          {caption}
        </div>
      )}
      <div ref={parentRef} className="max-h-[60vh] overflow-auto">
        <table className="w-full text-xs mono border-collapse">
          <thead className="sticky top-0 z-10 bg-bg-0 border-b border-border-default">
            <tr>
              <th className="text-left px-3 py-2 text-text-tertiary font-normal w-10">#</th>
              {columns.map((c) => (
                <th
                  key={c.name}
                  className="text-left px-3 py-2 text-text-primary font-semibold whitespace-nowrap border-l border-border-subtle"
                >
                  {c.name}
                  <span className={`ml-1.5 text-[10px] font-normal ${TYPE_BADGE[c.category].split(' ')[0]}`}>
                    {TYPE_SHORT[c.category]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sample.rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-text-tertiary">
                  No rows.
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr aria-hidden="true" style={{ height: `${paddingTop}px` }}>
                    <td colSpan={columns.length + 1} style={{ padding: 0, border: 0 }} />
                  </tr>
                )}
                {items.map((virtualRow) => {
                  const row = sample.rows[virtualRow.index];
                  if (!row) return null;
                  return (
                    <tr
                      key={virtualRow.key}
                      className="border-b border-border-subtle hover:bg-bg-2/50"
                      style={{ height: `${virtualRow.size}px` }}
                    >
                      <td className="px-3 py-1.5 text-text-tertiary text-right tabular-nums">
                        {virtualRow.index + 1}
                      </td>
                      {columns.map((c) => {
                        const cat = typeByCol.get(c.name)?.category ?? 'other';
                        return <Cell key={c.name} value={row[c.name]} category={cat} />;
                      })}
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr aria-hidden="true" style={{ height: `${paddingBottom}px` }}>
                    <td colSpan={columns.length + 1} style={{ padding: 0, border: 0 }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
        {truncated && (
          <div className="px-3 py-1.5 text-[10px] mono text-text-tertiary border-t border-border-subtle bg-bg-0/40">
            Showing first {showingRows} rows.
          </div>
        )}
      </div>
    </div>
  );
}

function ResultView({
  result,
  durationMs,
  sql,
  onBackToData,
  pivotSource,
  pivotOpen,
  pivotExecuting,
  onOpenPivot,
  onClosePivot,
  onBuildPivot,
  onOpenConverter,
  sqlValue,
  openConn,
}: {
  result: QueryResult;
  durationMs: number;
  sql: string;
  onBackToData: () => void;
  pivotSource: { tableName: string; originalName: string; columns: ColumnInfo[] } | null;
  pivotOpen: boolean;
  pivotExecuting: boolean;
  onOpenPivot: () => void;
  onClosePivot: () => void;
  onBuildPivot: (spec: PivotSpec) => void;
  onOpenConverter: () => void;
  sqlValue: string;
  openConn: () => Promise<{ db: AsyncDuckDB; conn: AsyncDuckDBConnection }>;
}) {
  const columns = deriveColumns(result);
  const showingRows = Math.min(result.rowCount, 100);
  const truncated = result.rowCount > 100;
  const statementCount = splitStatements(sql).length;

  return (
    <div className="bg-bg-1 border border-accent-brand/30 rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-border-subtle flex items-center gap-3 flex-wrap text-xs mono">
        <span className="inline-flex items-center gap-1.5 text-accent-success font-semibold">
          <Icon name="check" size={14} />
          Query result
        </span>
        <span className="text-text-tertiary">·</span>
        <span className="text-text-primary">{formatNumber(result.rowCount)}</span>
        <span className="text-text-tertiary">rows</span>
        <span className="text-text-tertiary">·</span>
        <span className="text-text-primary">{columns.length}</span>
        <span className="text-text-tertiary">columns</span>
        <span className="text-text-tertiary">·</span>
        <span className="text-text-secondary">{durationMs}ms</span>
        {statementCount > 1 && (
          <>
            <span className="text-text-tertiary">·</span>
            <span className="text-accent-brand">{statementCount} statements</span>
          </>
        )}
        <span className="ml-auto" />
        <button
          type="button"
          onClick={onOpenPivot}
          disabled={!pivotSource || pivotExecuting}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs mono text-text-secondary hover:text-accent-brand disabled:opacity-40 disabled:cursor-not-allowed"
          title={pivotSource ? `Pivot ${pivotSource.tableName}` : 'No active file to pivot'}
        >
          <Icon name="pivot" size={12} />
          Pivot
        </button>
        <button
          type="button"
          onClick={onOpenConverter}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs mono text-text-secondary hover:text-accent-brand"
          title="Convert a file to another format"
        >
          <Icon name="shuffle" size={12} />
          Convert
        </button>
        <ExportMenu result={result} durationMs={durationMs} sql={sqlValue} openConn={openConn} />
        <button type="button" onClick={onBackToData} className="text-text-tertiary hover:text-text-primary text-xs">
          ← Back to source
        </button>
      </div>
      {pivotOpen && pivotSource && (
        <Suspense fallback={null}>
          <PivotBuilder
            key={pivotSource.tableName}
            sourceTable={pivotSource.tableName}
            originalName={pivotSource.originalName}
            columns={pivotSource.columns}
            onBuild={onBuildPivot}
            onCancel={onClosePivot}
            executing={pivotExecuting}
          />
        </Suspense>
      )}
      <DataTable sample={result} columns={columns} showingRows={showingRows} truncated={truncated} />
      <Suspense fallback={<ChartFallback />}>
        <ChartView result={result} />
      </Suspense>
    </div>
  );
}

function ChartFallback() {
  return (
    <div className="border-t border-border-subtle px-4 py-6 text-xs mono text-text-tertiary flex items-center gap-2">
      <span className="inline-block w-3 h-3 border border-accent-brand border-t-transparent rounded-full animate-spin" />
      Loading chart…
    </div>
  );
}

function ErrorView({ message, sql, onBackToData }: { message: string; sql: string; onBackToData: () => void }) {
  const statementCount = splitStatements(sql).length;
  const matched = matchErrorPattern(message);
  const [showWhy, setShowWhy] = useState(true);
  return (
    <div className="bg-bg-1 border border-accent-danger/40 rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-accent-danger/30 flex items-center gap-3 flex-wrap text-xs mono">
        <span className="inline-flex items-center gap-1.5 text-accent-danger font-semibold">
          <Icon name="bolt" size={14} />
          Query error
        </span>
        {statementCount > 1 && (
          <>
            <span className="text-text-tertiary">·</span>
            <span className="text-accent-brand">{statementCount} statements</span>
          </>
        )}
        <span className="ml-auto" />
        <button type="button" onClick={onBackToData} className="text-text-tertiary hover:text-text-primary text-xs">
          ← Back to source
        </button>
      </div>
      <div className="p-4 space-y-3">
        <pre className="text-xs mono text-text-secondary whitespace-pre-wrap break-words">{message}</pre>
        {matched && (
          <div className="border border-accent-warn/30 rounded-md bg-accent-warn/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-accent-warn/10 transition-colors text-left"
              aria-expanded={showWhy}
            >
              <span className="flex items-center gap-2 text-[11px] mono font-semibold text-accent-warn">
                <Icon name="sparkle" size={12} />
                {matched.pattern.title}
              </span>
              <Icon name={showWhy ? 'minus' : 'plus'} size={11} className="text-text-tertiary" />
            </button>
            {showWhy && (
              <div className="px-3 pb-3 space-y-2 border-t border-accent-warn/20">
                <p className="text-[11px] text-text-secondary leading-relaxed pt-2">{matched.pattern.explanation}</p>
                <pre className="text-[11px] mono text-accent-brand/90 bg-bg-0 border border-border-subtle rounded p-2 whitespace-pre-wrap break-words leading-relaxed">
{matched.pattern.fix}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PendingRestoreBanner({
  pending,
  onDismiss,
}: {
  pending: WorkspaceFile[];
  onDismiss: () => void;
}) {
  return (
    <div className="bg-bg-1 border border-accent-success/40 rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-accent-success/30 flex items-center gap-3 flex-wrap text-xs mono">
        <span className="inline-flex items-center gap-1.5 text-accent-success font-semibold">
          <Icon name="database" size={14} />
          Restoring workspace
        </span>
        <span className="text-text-tertiary">
          Drop the {pending.length} file{pending.length === 1 ? '' : 's'} below to populate the session.
          SQL references will be rewritten automatically.
        </span>
        <span className="ml-auto" />
        <button
          type="button"
          onClick={onDismiss}
          className="text-text-tertiary hover:text-text-primary"
        >
          ✕ Cancel
        </button>
      </div>
      <ul className="px-4 py-2 flex flex-wrap gap-1.5 text-[10px] mono">
        {pending.map((p, i) => (
          <li
            key={`${p.name}-${p.size}-${i}`}
            className="px-2 py-0.5 rounded border border-dashed border-accent-success/40 bg-accent-success/5 text-accent-success"
          >
            <Icon name="upload" size={9} className="inline mr-1 -mt-0.5" />
            {p.name}
            <span className="ml-1 text-text-tertiary">{(p.size / 1024).toFixed(1)} KB</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SharedPreviewBanner({
  preview,
  onDismiss,
}: {
  preview: ShareResultPayload;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-bg-1 border border-accent-brand/40 rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-accent-brand/30 flex items-center gap-3 flex-wrap text-xs mono">
        <span className="inline-flex items-center gap-1.5 text-accent-brand font-semibold">
          <Icon name="share" size={14} />
          Shared result preview
        </span>
        <span className="text-text-tertiary">
          {preview.rows.length} row{preview.rows.length === 1 ? '' : 's'} from the shared link
        </span>
        <span className="ml-auto" />
        <button
          type="button"
          onClick={onDismiss}
          className="text-text-tertiary hover:text-text-primary text-xs"
          aria-label="Dismiss preview"
        >
          ✕ Dismiss
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs mono">
          <thead>
            <tr className="border-b border-border-subtle">
              {preview.cols.map((c) => (
                <th
                  key={c.name}
                  className="px-3 py-1.5 text-left font-semibold text-text-tertiary uppercase tracking-wider text-[10px] border-l border-border-subtle"
                >
                  {c.name}
                  <span className="ml-1.5 text-text-tertiary/60 normal-case">{c.type}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, i) => (
              <tr key={i} className="border-b border-border-subtle/50 last:border-b-0 hover:bg-bg-2/50">
                {preview.cols.map((c) => {
                  const v = row[c.name];
                  const display =
                    v === null || v === undefined
                      ? 'NULL'
                      : typeof v === 'string' && v.length > 80
                      ? `${v.slice(0, 77)}…`
                      : typeof v === 'object'
                      ? JSON.stringify(v)
                      : String(v);
                  const isNull = v === null || v === undefined;
                  return (
                    <td
                      key={c.name}
                      className={[
                        'px-3 py-1.5 border-l border-border-subtle text-text-secondary',
                        isNull ? 'italic text-text-tertiary' : '',
                      ].join(' ')}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-1.5 text-[10px] mono text-text-tertiary border-t border-border-subtle">
        This is what the query returned when shared. Run it against your own data to see live results.
      </div>
    </div>
  );
}

function Cell({ value, category }: { value: unknown; category: ColumnCategory }) {
  if (value === null || value === undefined) {
    return <td className="px-3 py-1.5 italic text-text-tertiary border-l border-border-subtle">NULL</td>;
  }
  const display = String(value);
  const truncated = display.length > 80 ? `${display.slice(0, 77)}…` : display;

  let className = 'px-3 py-1.5 border-l border-border-subtle text-text-secondary';
  if (category === 'integer' || category === 'number' || category === 'date' || category === 'datetime' || category === 'time') {
    className += ' tabular-nums text-right text-text-primary';
  } else if (category === 'boolean') {
    className += value ? ' text-accent-success' : ' text-accent-danger';
  } else if (category === 'complex') {
    className += ' text-accent-warn';
  } else if (category === 'uuid') {
    className += ' text-accent-brand';
  }

  return (
    <td className={className} title={display}>
      {truncated}
    </td>
  );
}

function EmptyHint() {
  return (
    <div className="bg-bg-1 border border-border-subtle rounded-xl p-10 text-center text-text-tertiary text-sm">
      Select a file above to view its data.
    </div>
  );
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}
