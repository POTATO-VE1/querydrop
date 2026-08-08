import { useEffect, useMemo, useState } from 'react';
import type { ColumnInfo, PivotAggregation, PivotSpec } from '../../lib/duckdb/types';
import { Icon } from '../ui/Icon';
import { useEscapeKey } from '../../lib/useEscapeKey';

interface PivotBuilderProps {
  sourceTable: string;
  originalName?: string;
  columns: ColumnInfo[];
  onBuild: (spec: PivotSpec) => void;
  onCancel: () => void;
  executing: boolean;
}

const AGGREGATIONS: PivotAggregation[] = ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX'];

function isNumericType(typeName: string): boolean {
  return /INT|DOUBLE|FLOAT|DECIMAL|NUMERIC|REAL/.test(typeName.toUpperCase());
}

export function PivotBuilder({ sourceTable, originalName, columns, onBuild, onCancel, executing }: PivotBuilderProps) {
  const allColNames = useMemo(() => columns.map((c) => c.name), [columns]);
  const numericColNames = useMemo(
    () => columns.filter((c) => isNumericType(c.type)).map((c) => c.name),
    [columns],
  );

  const [rowColumn, setRowColumn] = useState<string>(allColNames[0] ?? '');
  const [colColumn, setColColumn] = useState<string>(
    allColNames.find((n) => !numericColNames.includes(n)) ?? allColNames[1] ?? allColNames[0] ?? '',
  );
  const [valueColumn, setValueColumn] = useState<string>(numericColNames[0] ?? allColNames[0] ?? '');
  const [aggregation, setAggregation] = useState<PivotAggregation>('SUM');

  useEffect(() => {
    setRowColumn(allColNames[0] ?? '');
    setColColumn(
      allColNames.find((n) => !numericColNames.includes(n)) ?? allColNames[1] ?? allColNames[0] ?? '',
    );
    setValueColumn(numericColNames[0] ?? allColNames[0] ?? '');
  }, [allColNames, numericColNames]);

  const canBuild =
    rowColumn.length > 0 &&
    colColumn.length > 0 &&
    valueColumn.length > 0 &&
    rowColumn !== colColumn &&
    !executing;

  const handleBuild = () => {
    if (!canBuild) return;
    onBuild({ rowColumn, colColumn, valueColumn, aggregation });
  };

  useEscapeKey(() => { if (!executing) onCancel(); }, true);

  const displayName = originalName || sourceTable;

  return (
    <div
      role="region"
      aria-label={`Pivot builder for ${displayName}`}
      className="bg-bg-0 border-t border-border-subtle p-3 space-y-3"
    >
      <div className="flex items-center gap-2 text-text-tertiary">
        <Icon name="pivot" size={12} className="text-accent-brand" />
        <span className="text-[10px] mono uppercase tracking-wider">
          Pivot · {displayName} · {columns.length} columns
        </span>
        {numericColNames.length === 0 && (
          <span className="text-[10px] mono text-accent-warn">No numeric columns for value</span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <PivotSelect label="Rows" value={rowColumn} onChange={setRowColumn} options={allColNames} accent="accent-brand" />
        <PivotSelect label="Columns" value={colColumn} onChange={setColColumn} options={allColNames} accent="accent-warn" />
        <PivotSelect
          label="Value"
          value={valueColumn}
          onChange={setValueColumn}
          options={numericColNames.length > 0 ? numericColNames : allColNames}
          accent="accent-success"
          hint={numericColNames.length > 0 ? `${numericColNames.length} numeric` : 'all'}
        />
        <PivotSelect
          label="Aggregate"
          value={aggregation}
          onChange={(v) => setAggregation(v as PivotAggregation)}
          options={AGGREGATIONS}
          accent="accent-danger"
        />
      </div>
      <div className="flex items-center gap-2 text-[10px] mono text-text-tertiary">
        <span>Top 20 unique values of</span>
        <code className="px-1.5 py-0.5 bg-bg-1 border border-border-subtle rounded text-accent-warn">
          {colColumn || '—'}
        </code>
        <span>become columns; rows are unique</span>
        <code className="px-1.5 py-0.5 bg-bg-1 border border-border-subtle rounded text-accent-brand">
          {rowColumn || '—'}
        </code>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleBuild}
          disabled={!canBuild}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-accent-brand/10 border border-accent-brand/40 text-accent-brand hover:bg-accent-brand/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {executing ? (
            <>
              <span className="inline-block w-3 h-3 border border-accent-brand border-t-transparent rounded-full animate-spin" />
              Building…
            </>
          ) : (
            <>
              <Icon name="pivot" size={12} />
              Build pivot
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={executing}
          className="px-3 py-1 text-xs text-text-tertiary hover:text-text-primary disabled:opacity-40"
        >
          Cancel
        </button>
        {rowColumn === colColumn && (
          <span className="text-[10px] mono text-accent-danger">Row and Column must be different</span>
        )}
      </div>
    </div>
  );
}

function PivotSelect({
  label,
  value,
  onChange,
  options,
  accent,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  accent: 'accent-brand' | 'accent-warn' | 'accent-success' | 'accent-danger';
  hint?: string;
}) {
  const focusClass: Record<typeof accent, string> = {
    'accent-brand': 'focus:border-accent-brand',
    'accent-warn': 'focus:border-accent-warn',
    'accent-success': 'focus:border-accent-success',
    'accent-danger': 'focus:border-accent-danger',
  };
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[10px] mono uppercase tracking-wider text-text-tertiary mb-1">
        <span>{label}</span>
        {hint && <span className="text-text-tertiary/60 normal-case tracking-normal">{hint}</span>}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-bg-1 border border-border-subtle rounded-md px-2 py-1 text-xs mono text-text-primary focus:outline-none ${focusClass[accent]}`}
      >
        {options.length === 0 ? (
          <option value="">—</option>
        ) : (
          options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))
        )}
      </select>
    </label>
  );
}
