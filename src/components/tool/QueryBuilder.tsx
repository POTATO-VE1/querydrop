/**
 * Visual Query Builder — slide-over panel for non-SQL users. Builds a SQL
 * string from a structured form (table, columns, where, group by, order by,
 * limit) and either inserts it into the editor or runs it directly.
 *
 * Schema is injected via the `tables` and `tableColumns` props (same shape
 * the SQL editor uses for autocomplete). Operator visibility is filtered by
 * column category (numeric vs string vs date).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import type { ColumnInfo } from '../../lib/duckdb/types';
import { categorizeType, type ColumnCategory } from '../../lib/duckdb/queries';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';

type AggKind = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
type Op = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'like' | 'isnull' | 'isnotnull' | 'in';
type Combinator = 'AND' | 'OR';

interface SelectedColumn {
  name: string;
  agg: AggKind | null;
}

interface WhereRow {
  id: string;
  column: string;
  op: Op;
  value: string;
  combinator: Combinator;
}

interface OrderByRow {
  id: string;
  column: string;
  dir: 'ASC' | 'DESC';
}

interface QueryBuilderProps {
  open: boolean;
  onClose: () => void;
  tables: string[];
  tableColumns: Array<{ tableName: string; columns: ColumnInfo[] }>;
  defaultTable: string | undefined;
  onInsert: (sql: string) => void;
  onRun: (sql: string) => void;
}

const AGG_OPTIONS: Array<{ value: AggKind | null; label: string; numericOnly: boolean }> = [
  { value: null, label: 'no aggregate', numericOnly: false },
  { value: 'COUNT', label: 'COUNT', numericOnly: false },
  { value: 'SUM', label: 'SUM', numericOnly: true },
  { value: 'AVG', label: 'AVG', numericOnly: true },
  { value: 'MIN', label: 'MIN', numericOnly: false },
  { value: 'MAX', label: 'MAX', numericOnly: false },
];

const OP_OPTIONS: Array<{ value: Op; label: string; needsValue: boolean; numeric: boolean; stringOnly?: boolean }> = [
  { value: 'eq', label: '=', needsValue: true, numeric: true },
  { value: 'neq', label: '≠', needsValue: true, numeric: true },
  { value: 'lt', label: '<', needsValue: true, numeric: true },
  { value: 'lte', label: '≤', needsValue: true, numeric: true },
  { value: 'gt', label: '>', needsValue: true, numeric: true },
  { value: 'gte', label: '≥', needsValue: true, numeric: true },
  { value: 'like', label: 'LIKE', needsValue: true, numeric: false, stringOnly: true },
  { value: 'in', label: 'IN', needsValue: true, numeric: true },
  { value: 'isnull', label: 'IS NULL', needsValue: false, numeric: true },
  { value: 'isnotnull', label: 'IS NOT NULL', needsValue: false, numeric: true },
];

function genId(): string {
  return `qb_${crypto.randomUUID()}`;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function quoteValue(v: string): string {
  const t = v.trim();
  if (t === '') return "''";
  if (t.toUpperCase() === 'NULL') return 'NULL';
  if (t === 'true' || t === 'false') return t;
  if (t === 'TRUE' || t === 'FALSE') return t;
  if (/^-?\d+(\.\d+)?$/.test(t)) return t;
  return `'${t.replace(/'/g, "''")}'`;
}

function generateWhere(row: WhereRow): string {
  const col = quoteIdent(row.column);
  const v = row.value.trim();
  switch (row.op) {
    case 'eq': return `${col} = ${quoteValue(v)}`;
    case 'neq': return `${col} != ${quoteValue(v)}`;
    case 'lt': return `${col} < ${quoteValue(v)}`;
    case 'lte': return `${col} <= ${quoteValue(v)}`;
    case 'gt': return `${col} > ${quoteValue(v)}`;
    case 'gte': return `${col} >= ${quoteValue(v)}`;
    case 'like': return `${col} LIKE ${quoteValue(v)}`;
    case 'isnull': return `${col} IS NULL`;
    case 'isnotnull': return `${col} IS NOT NULL`;
    case 'in': {
      const items = v.split(',').map((s) => s.trim()).filter(Boolean);
      if (items.length === 0) return '1 = 1';
      return `${col} IN (${items.map(quoteValue).join(', ')})`;
    }
  }
}

function generateSQL(args: {
  table: string;
  selectAll: boolean;
  distinct: boolean;
  selected: SelectedColumn[];
  where: WhereRow[];
  groupBy: string[];
  orderBy: OrderByRow[];
  limit: number;
}): string {
  const { table, selectAll, distinct, selected, where, groupBy, orderBy, limit } = args;
  if (!table) return '-- Pick a table to start';
  const parts: string[] = [];
  parts.push('SELECT');
  if (distinct) parts.push('DISTINCT');
  if (selectAll || selected.length === 0) {
    parts.push('*');
  } else {
    const cols = selected.map((s) => {
      if (!s.name) return '*';
      return s.agg ? `${s.agg}(${quoteIdent(s.name)})` : quoteIdent(s.name);
    });
    parts.push(cols.join(', '));
  }
  parts.push(`FROM ${quoteIdent(table)}`);
  if (where.length > 0) {
    const first = generateWhere(where[0]);
    const rest = where.slice(1).map((w) => ` ${w.combinator} ${generateWhere(w)}`);
    parts.push(`WHERE ${first}${rest.join('')}`);
  }
  if (groupBy.length > 0) {
    parts.push(`GROUP BY ${groupBy.map(quoteIdent).join(', ')}`);
  }
  if (orderBy.length > 0) {
    parts.push(`ORDER BY ${orderBy.map((o) => `${quoteIdent(o.column)} ${o.dir}`).join(', ')}`);
  }
  if (limit > 0) {
    parts.push(`LIMIT ${limit}`);
  }
  return parts.join(' ');
}

export function QueryBuilder({
  open,
  onClose,
  tables,
  tableColumns,
  defaultTable,
  onInsert,
  onRun,
}: QueryBuilderProps) {
  const [table, setTable] = useState<string>(defaultTable ?? tables[0] ?? '');
  const [selectAll, setSelectAll] = useState(true);
  const [distinct, setDistinct] = useState(false);
  const [selected, setSelected] = useState<SelectedColumn[]>([]);
  const [where, setWhere] = useState<WhereRow[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [orderBy, setOrderBy] = useState<OrderByRow[]>([]);
  const [limit, setLimit] = useState<number>(100);

  useEffect(() => {
    if (open) {
      setTable(defaultTable ?? tables[0] ?? '');
      setSelectAll(true);
      setDistinct(false);
      setSelected([]);
      setWhere([]);
      setGroupBy([]);
      setOrderBy([]);
      setLimit(100);
    }
  }, [open, defaultTable, tables]);

  const schemaCols = useMemo(() => {
    const found = tableColumns.find((tc) => tc.tableName === table);
    return found?.columns ?? [];
  }, [tableColumns, table]);

  const colByName = useMemo(() => {
    const m = new Map<string, ColumnInfo>();
    for (const c of schemaCols) m.set(c.name, c);
    return m;
  }, [schemaCols]);

  const categoryFor = useCallback(
    (name: string): ColumnCategory => {
      const c = colByName.get(name);
      if (!c) return 'text';
      return categorizeType(c.type);
    },
    [colByName],
  );

  const sql = useMemo(
    () => generateSQL({ table, selectAll, distinct, selected, where, groupBy, orderBy, limit }),
    [table, selectAll, distinct, selected, where, groupBy, orderBy, limit],
  );

  const toggleSelected = useCallback(
    (colName: string, on: boolean) => {
      setSelectAll(false);
      if (on) {
        setSelected((prev) => {
          if (prev.some((s) => s.name === colName)) return prev;
          return [...prev, { name: colName, agg: null }];
        });
      } else {
        setSelected((prev) => prev.filter((s) => s.name !== colName));
      }
    },
    [],
  );

  const setAgg = useCallback((colName: string, agg: AggKind | null) => {
    setSelected((prev) => prev.map((s) => (s.name === colName ? { ...s, agg } : s)));
  }, []);

  const addWhere = useCallback(() => {
    const firstCol = schemaCols[0]?.name ?? '';
    setWhere((prev) => [
      ...prev,
      { id: genId(), column: firstCol, op: 'eq', value: '', combinator: 'AND' },
    ]);
  }, [schemaCols]);

  const updateWhere = useCallback((id: string, patch: Partial<WhereRow>) => {
    setWhere((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }, []);

  const removeWhere = useCallback((id: string) => {
    setWhere((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const toggleGroupBy = useCallback((colName: string, on: boolean) => {
    setGroupBy((prev) => (on ? [...new Set([...prev, colName])] : prev.filter((c) => c !== colName)));
  }, []);

  const addOrderBy = useCallback(() => {
    const firstCol = schemaCols[0]?.name ?? '';
    setOrderBy((prev) => [...prev, { id: genId(), column: firstCol, dir: 'ASC' }]);
  }, [schemaCols]);

  const updateOrderBy = useCallback((id: string, patch: Partial<OrderByRow>) => {
    setOrderBy((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, []);

  const removeOrderBy = useCallback((id: string) => {
    setOrderBy((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const handleInsert = useCallback(() => {
    onInsert(sql);
    onClose();
  }, [sql, onInsert, onClose]);

  const handleRun = useCallback(() => {
    onRun(sql);
    onClose();
  }, [sql, onRun, onClose]);

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
        aria-labelledby="qb-title"
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-bg-0 border-l border-border-subtle  flex flex-col"
      >
        <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between gap-3 shrink-0">
          <h2 id="qb-title" className="text-sm font-semibold text-text-primary">
            <Icon name="code" size={14} className="inline mr-1.5 -mt-0.5 text-accent-brand" />
            Build query
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
          <Section title="From">
            <select
              value={table}
              onChange={(e) => setTable(e.target.value)}
              className="w-full px-2 py-1.5 mono bg-bg-1 border border-border-subtle rounded text-text-primary focus:outline-none focus:border-accent-brand"
            >
              {tables.length === 0 && <option value="">— load a file first —</option>}
              {tables.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Section>

          <Section
            title="Select"
            right={
              <label className="flex items-center gap-1 text-[10px] mono text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => {
                    setSelectAll(e.target.checked);
                    if (e.target.checked) setSelected([]);
                  }}
                  className="accent-accent-brand"
                />
                *
              </label>
            }
          >
            <label className="flex items-center gap-1 text-[10px] mono text-text-secondary cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={distinct}
                onChange={(e) => setDistinct(e.target.checked)}
                className="accent-accent-brand"
              />
              DISTINCT
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {schemaCols.length === 0 ? (
                <p className="text-[10px] mono text-text-tertiary py-2">No columns — pick a table first</p>
              ) : (
                schemaCols.map((c) => {
                  const sel = selected.find((s) => s.name === c.name);
                  const cat = categorizeType(c.type);
                  const isNumeric = cat === 'integer' || cat === 'number';
                  return (
                    <div key={c.name} className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!sel}
                          onChange={(e) => toggleSelected(c.name, e.target.checked)}
                          disabled={selectAll}
                          className="accent-accent-brand shrink-0"
                        />
                        <span className="mono text-text-primary truncate">{c.name}</span>
                        <span className="text-text-tertiary text-[10px] truncate">{c.type}</span>
                      </label>
                      {sel && (
                        <select
                          value={sel.agg ?? ''}
                          onChange={(e) => setAgg(c.name, (e.target.value || null) as AggKind | null)}
                          className="px-1 py-0.5 text-[10px] mono bg-bg-1 border border-border-subtle rounded text-text-primary"
                        >
                          {AGG_OPTIONS.filter((o) => !o.numericOnly || isNumeric).map((o) => (
                            <option key={o.label} value={o.value ?? ''}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Section>

          <Section
            title="Where"
            right={
              <button
                type="button"
                onClick={addWhere}
                disabled={schemaCols.length === 0}
                className="text-[10px] mono text-accent-brand hover:underline disabled:opacity-40"
              >
                + condition
              </button>
            }
          >
            {where.length === 0 ? (
              <p className="text-[10px] mono text-text-tertiary">No filters — click + condition to add</p>
            ) : (
              <div className="space-y-1.5">
                {where.map((w, i) => {
                  const cat = categoryFor(w.column);
                  const isNumeric = cat === 'integer' || cat === 'number';
                  const opOptions = OP_OPTIONS.filter((o) => {
                    if (o.stringOnly && isNumeric) return false;
                    if (o.numeric && !isNumeric && !o.stringOnly) return false;
                    return true;
                  });
                  const opDef = opOptions.find((o) => o.value === w.op);
                  const needsValue = opDef?.needsValue ?? true;
                  return (
                    <div key={w.id} className="border border-border-subtle rounded p-2 bg-bg-1 space-y-1">
                      {i > 0 && (
                        <select
                          value={w.combinator}
                          onChange={(e) => updateWhere(w.id, { combinator: e.target.value as Combinator })}
                          className="px-1 py-0.5 text-[10px] mono bg-bg-0 border border-border-subtle rounded text-accent-brand"
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                      )}
                      <div className="flex items-center gap-1">
                        <select
                          value={w.column}
                          onChange={(e) => updateWhere(w.id, { column: e.target.value, op: 'eq', value: '' })}
                          className="flex-1 min-w-0 px-1 py-0.5 text-[11px] mono bg-bg-0 border border-border-subtle rounded text-text-primary"
                        >
                          {schemaCols.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={w.op}
                          onChange={(e) => updateWhere(w.id, { op: e.target.value as Op })}
                          className="px-1 py-0.5 text-[11px] mono bg-bg-0 border border-border-subtle rounded text-text-primary"
                        >
                          {opOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeWhere(w.id)}
                          className="text-text-tertiary hover:text-accent-danger"
                          aria-label="Remove condition"
                        >
                          <Icon name="x" size={11} />
                        </button>
                      </div>
                      {needsValue && (
                        <input
                          type="text"
                          value={w.value}
                          onChange={(e) => updateWhere(w.id, { value: e.target.value })}
                          placeholder={
                            w.op === 'in'
                              ? 'value1, value2, value3'
                              : w.op === 'like'
                              ? '%pattern%'
                              : isNumeric
                              ? 'number'
                              : 'value'
                          }
                          className="w-full px-2 py-1 text-[11px] mono bg-bg-0 border border-border-subtle rounded text-text-primary"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Group by">
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {schemaCols.length === 0 ? (
                <p className="text-[10px] mono text-text-tertiary">No columns</p>
              ) : (
                schemaCols.map((c) => (
                  <label key={c.name} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupBy.includes(c.name)}
                      onChange={(e) => toggleGroupBy(c.name, e.target.checked)}
                      className="accent-accent-brand"
                    />
                    <span className="mono text-text-primary text-[11px]">{c.name}</span>
                    <span className="text-text-tertiary text-[10px]">{c.type}</span>
                  </label>
                ))
              )}
            </div>
          </Section>

          <Section
            title="Order by"
            right={
              <button
                type="button"
                onClick={addOrderBy}
                disabled={schemaCols.length === 0}
                className="text-[10px] mono text-accent-brand hover:underline disabled:opacity-40"
              >
                + column
              </button>
            }
          >
            {orderBy.length === 0 ? (
              <p className="text-[10px] mono text-text-tertiary">No ordering — click + column to add</p>
            ) : (
              <div className="space-y-1.5">
                {orderBy.map((o) => (
                  <div key={o.id} className="flex items-center gap-1">
                    <select
                      value={o.column}
                      onChange={(e) => updateOrderBy(o.id, { column: e.target.value })}
                      className="flex-1 min-w-0 px-1 py-0.5 text-[11px] mono bg-bg-1 border border-border-subtle rounded text-text-primary"
                    >
                      {schemaCols.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={o.dir}
                      onChange={(e) => updateOrderBy(o.id, { dir: e.target.value as 'ASC' | 'DESC' })}
                      className="px-1 py-0.5 text-[11px] mono bg-bg-1 border border-border-subtle rounded text-text-primary"
                    >
                      <option value="ASC">ASC</option>
                      <option value="DESC">DESC</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeOrderBy(o.id)}
                      className="text-text-tertiary hover:text-accent-danger"
                      aria-label="Remove order"
                    >
                      <Icon name="x" size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Limit">
            <input
              type="number"
              min={0}
              value={limit}
              onChange={(e) => setLimit(Math.max(0, Number(e.target.value) || 0))}
              className="w-24 px-2 py-1 text-[11px] mono bg-bg-1 border border-border-subtle rounded text-text-primary"
            />
          </Section>
        </div>

        <div className="border-t border-border-subtle p-3 space-y-2 shrink-0 bg-bg-1">
          <label className="block text-[10px] mono uppercase tracking-wider text-text-tertiary">
            SQL preview
          </label>
          <pre className="text-[11px] mono text-accent-brand bg-bg-0 border border-border-subtle rounded p-2 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
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
              onClick={handleRun}
              className="flex-1 px-3 py-1.5 text-xs mono font-semibold rounded bg-bg-2 border border-border-subtle text-text-primary hover:border-accent-brand hover:text-accent-brand"
            >
              Run
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[10px] mono uppercase tracking-wider text-text-tertiary">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}
