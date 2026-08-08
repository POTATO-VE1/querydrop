/**
 * ExcelSheetPicker — modal that lets the user pick which sheet to load
 * from a multi-sheet Excel workbook. Shown by QueryPad after a .xlsx/.xls
 * file is dropped and the sheets have been enumerated.
 *
 * Solid backdrop (no glass / blur) per the project's design rules.
 */

import { useEffect, useRef } from 'react';
import { Icon } from '../ui/Icon';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { formatBytes } from '../../lib/format';
import type { ExcelSheetInfo } from '../../lib/duckdb/excel';

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function ExcelSheetPicker({
  filename,
  fileSizeBytes,
  sheets,
  onSelect,
  onCancel,
}: {
  filename: string;
  fileSizeBytes: number;
  sheets: ExcelSheetInfo[];
  onSelect: (sheetName: string) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(dialogRef, true);
  useEscapeKey(onCancel, true);

  useEffect(() => {
    // Auto-focus first sheet for keyboard / screen-reader users
    firstButtonRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="excel-picker-title"
        className="bg-bg-1 border border-accent-brand/40 rounded-xl w-full max-w-md mx-4 "
      >
        <div className="px-4 py-3 border-b border-border-subtle flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-accent-success/10 border border-accent-success/40 flex items-center justify-center text-accent-success flex-shrink-0">
            <Icon name="file" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] mono uppercase tracking-wider text-text-tertiary">Excel workbook</div>
            <div id="excel-picker-title" className="text-sm font-semibold text-text-primary truncate" title={filename}>
              {filename}
            </div>
            <div className="text-xs mono text-text-tertiary mt-0.5">
              {sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'} · {formatBytes(fileSizeBytes)}
            </div>
          </div>
        </div>
        <div className="px-4 py-2 border-b border-border-subtle text-[10px] mono text-text-tertiary uppercase tracking-wider">
          Select a sheet to load
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              ref={i === 0 ? firstButtonRef : undefined}
              type="button"
              onClick={() => onSelect(s.name)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-sm mono text-text-primary hover:bg-bg-2 hover:border-accent-brand/30 border border-transparent transition-colors focus:outline-none focus:border-accent-brand/50 focus:bg-bg-2"
            >
              <span className="truncate flex items-center gap-2">
                <Icon name="file" size={14} className="text-text-tertiary" />
                {s.name}
              </span>
              <span className="text-text-tertiary text-xs flex-shrink-0">
                {s.rowCount > 0 ? `${formatNumber(s.rowCount)} rows` : 'empty'}
              </span>
            </button>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-border-subtle flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs mono text-text-secondary hover:text-text-primary border border-border-subtle hover:border-border-default rounded-md"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
