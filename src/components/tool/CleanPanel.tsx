/**
 * Data Cleaning panel — slide-over that builds cleanup SQL from a list of
 * ops + columns. Mirrors the QueryBuilder pattern (slide-over right edge,
 * live preview, "Insert to editor" / "Apply" actions).
 *
 * Op behavior:
 *   - trim / emptyToNull / dropEmptyRows: per-column, no-op if no cols picked
 *   - dropDuplicates: no column list, always operates on all rows
 *
 * Apply runs the SQL via the parent's onApply callback, which is expected to
 * dispatch through the existing multi-statement runner.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import type { ColumnInfo } from '../../lib/duckdb/types';
import { CLEAN_OP_LABELS, generateCleanSQL, type CleanOp } from '../../lib/cleaning';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';

interface CleanPanelProps {
  open: boolean;
  onClose: () => void;
  tables: string[];
  tableColumns: Array<{ tableName: string; columns: ColumnInfo[] }>;
  defaultTable: string | undefined;
  onInsert: (sql: string) => void;
  onApply: (sql: string) => Promise<void>;
}

const ALL_OPS: CleanOp[] = ['trim', 'emptyToNull', 'dropEmptyRows', 'dropDuplicates'];

export function CleanPanel({
  open,
  onClose,
  tables,
  tableColumns,
  defaultTable,
  onInsert,
  onApply,
}: CleanPanelProps) {
  const [table, setTable] = useState<string>(defaultTable ?? tables[0] ?? '');
  const [ops, setOps] = useState<Set<CleanOp>>(new Set(['trim']));
  const [cols, setCols] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTable(defaultTable ?? tables[0] ?? '');
      setOps(new Set(['trim']));
      setCols([]);
      setApplying(false);
      setApplyError(null);
    }
  }, [open, defaultTable, tables]);

  const schemaCols = useMemo(() => {
    const found = tableColumns.find((tc) => tc.tableName === table);
    return found?.columns ?? [];
  }, [tableColumns, table]);

  useEffect(() => {
    if (open && schemaCols.length > 0 && cols.length === 0) {
      const textCols = schemaCols.filter((c) => c.category === 'text').map((c) => c.name);
      setCols(textCols);
    }
  }, [open, schemaCols, cols.length]);

  const sql = useMemo(
    () => generateCleanSQL({ table, ops, cols }),
    [table, ops, cols],
  );

  const needsColumns = useMemo(() => {
    for (const op of ops) {
      if (op !== 'dropDuplicates') return true;
    }
    return false;
  }, [ops]);

  const toggleOp = (op: CleanOp, on: boolean) => {
    setOps((prev) => {
      const next = new Set(prev);
      if (on) next.add(op);
      else next.delete(op);
      return next;
    });
  };

  const toggleCol = (name: string, on: boolean) => {
    setCols((prev) => (on ? [...new Set([...prev, name])] : prev.filter((c) => c !== name)));
  };

  const selectAllCols = () => setCols(schemaCols.filter((c) => c.category === 'text').map((c) => c.name));
  const clearAllCols = () => setCols([]);

  const handleInsert = () => {
    onInsert(sql);
    onClose();
  };

  const handleApply = async () => {
    if (!sql || sql.startsWith('--')) return;
    setApplying(true);
    setApplyError(null);
    try {
      await onApply(sql);
      onClose();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  };

  const dialogRef = useRef<HTMLDivElement>(null);
  useEscapeKey(onClose, open);
  useFocusTrap(dialogRef, open);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clean-title"
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-bg-0 border-l border-border-subtle  flex flex-col"
      >
        <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between gap-3 shrink-0">
          <h2 id="clean-title" className="text-sm font-semibold text-text-primary">
            <Icon name="clean" size={14} className="inline mr-1.5 -mt-0.5 text-accent-brand" />
            Clean data
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary"
            aria-label="Close"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          <div>
            <h3 className="text-[10px] mono uppercase tracking-wider text-text-tertiary mb-1.5">Table</h3>
            <select
              value={table}
              onChange={(e) => {
                setTable(e.target.value);
                setCols([]);
              }}
              className="w-full px-2 py-1.5 mono bg-bg-1 border border-border-subtle rounded text-text-primary focus:outline-none focus:border-accent-brand"
            >
              {tables.length === 0 && <option value="">— load a file first —</option>}
              {tables.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h3 className="text-[10px] mono uppercase tracking-wider text-text-tertiary mb-1.5">Operations</h3>
            <div className="space-y-2">
              {ALL_OPS.map((op) => (
                <label
                  key={op}
                  className="flex items-start gap-2 cursor-pointer border border-border-subtle rounded p-2 bg-bg-1 hover:border-accent-brand/30"
                >
                  <input
                    type="checkbox"
                    checked={ops.has(op)}
                    onChange={(e) => toggleOp(op, e.target.checked)}
                    className="mt-0.5 accent-accent-brand shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="mono text-text-primary text-[12px]">{CLEAN_OP_LABELS[op].title}</div>
                    <div className="text-text-tertiary text-[10px] leading-snug mt-0.5">
                      {CLEAN_OP_LABELS[op].hint}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {needsColumns && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-[10px] mono uppercase tracking-wider text-text-tertiary">
                  Apply to columns
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllCols}
                    className="text-[10px] mono text-accent-brand hover:underline"
                  >
                    all
                  </button>
                  <button
                    type="button"
                    onClick={clearAllCols}
                    className="text-[10px] mono text-text-tertiary hover:underline"
                  >
                    none
                  </button>
                </div>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto border border-border-subtle rounded p-2 bg-bg-1">
                {schemaCols.length === 0 ? (
                  <p className="text-[10px] mono text-text-tertiary py-1">No columns — pick a table first</p>
                ) : (
                  schemaCols.map((c) => {
                    const isText = c.category === 'text';
                    return (
                      <label
                        key={c.name}
                        className={`flex items-center gap-2 ${
                          isText ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={cols.includes(c.name)}
                          disabled={!isText}
                          onChange={(e) => toggleCol(c.name, e.target.checked)}
                          className="accent-accent-brand shrink-0"
                        />
                        <span className="mono text-text-primary text-[11px] truncate flex-1">{c.name}</span>
                        <span className="text-text-tertiary text-[10px]">{c.type}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {applyError && (
            <div className="border border-accent-danger/40 bg-accent-danger/5 rounded p-2 text-[11px] mono text-accent-danger break-words">
              {applyError}
            </div>
          )}
        </div>

        <div className="border-t border-border-subtle p-3 space-y-2 shrink-0 bg-bg-1">
          <label className="block text-[10px] mono uppercase tracking-wider text-text-tertiary">
            SQL preview
          </label>
          <pre className="text-[11px] mono text-accent-brand bg-bg-0 border border-border-subtle rounded p-2 whitespace-pre-wrap break-words max-h-32 overflow-y-auto min-h-[3rem]">
{sql}
          </pre>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInsert}
              className="flex-1 px-3 py-1.5 text-xs mono font-semibold rounded bg-accent-brand/10 border border-accent-brand/40 text-accent-brand hover:bg-accent-brand/20"
            >
              Insert to editor
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || !sql || sql.startsWith('--')}
              className="flex-1 px-3 py-1.5 text-xs mono font-semibold rounded bg-bg-2 border border-border-subtle text-text-primary hover:border-accent-brand hover:text-accent-brand disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {applying ? (
                <>
                  <span className="inline-block w-3 h-3 border border-accent-brand border-t-transparent rounded-full animate-spin" />
                  Applying…
                </>
              ) : (
                'Apply'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
