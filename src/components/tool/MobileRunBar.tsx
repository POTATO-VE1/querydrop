/**
 * MobileRunBar — sticky bottom action bar for mobile (<md).
 * Provides a primary Run button (always at thumb reach) and an overflow
 * "More" menu that surfaces Build / Clean / Workspace / Share.
 * Templates, History, Save, Clear remain in the EditorPanel toolbar.
 *
 * The bar respects iOS safe-area-inset-bottom via env().
 * Padding-bottom is pushed onto the QueryPad main column so the
 * last row of results is never hidden behind the bar.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { useEscapeKey } from '../../lib/useEscapeKey';

export interface MobileRunBarProps {
  onRun: () => void;
  onOpenBuild: () => void;
  onOpenClean: () => void;
  onOpenWorkspace: () => void;
  onOpenShare: () => void;
  canRun: boolean;
  isRunning: boolean;
  hasFiles: boolean;
  hasQuery: boolean;
}

export function MobileRunBar({
  onRun,
  onOpenBuild,
  onOpenClean,
  onOpenWorkspace,
  onOpenShare,
  canRun,
  isRunning,
  hasFiles,
  hasQuery,
}: MobileRunBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useFocusTrap(sheetRef, menuOpen);
  useEscapeKey(() => setMenuOpen(false), menuOpen);

  const close = () => setMenuOpen(false);

  const runLabel = isRunning ? 'Running…' : 'Run';
  const runDisabled = !canRun || isRunning;
  const runHint = !hasFiles
    ? 'Add a file to run'
    : !hasQuery
      ? 'Write a query to run'
      : undefined;

  return (
    <>
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-bg-0/95 "
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch gap-2 px-3 py-2">
          <button
            type="button"
            onClick={onRun}
            disabled={runDisabled}
            title={runHint}
            aria-label={runLabel}
            className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-md bg-accent-brand text-bg-0 font-semibold text-sm hover:bg-accent-brand/90 disabled:bg-bg-3 disabled:text-text-tertiary disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            <Icon name={isRunning ? 'spinner' : 'play'} size={16} />
            {runLabel}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="More actions"
            aria-expanded={menuOpen}
            className="inline-flex items-center justify-center h-12 w-12 rounded-md border border-border-subtle bg-bg-1 text-text-primary hover:bg-bg-2 transition-colors min-h-[44px] min-w-[44px]"
          >
            <Icon name="more" size={18} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/70 flex items-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="More actions"
        >
          <div
            ref={sheetRef}
            className="w-full bg-bg-1 border-t border-border-subtle rounded-t-xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <span className="text-sm font-semibold text-text-primary">More actions</span>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="inline-flex items-center justify-center h-9 w-9 rounded-md text-text-secondary hover:bg-bg-2 min-h-[44px] min-w-[44px]"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="py-2">
              <SheetItem icon="build" label="Visual query builder" onClick={() => { onOpenBuild(); close(); }} />
              <SheetItem icon="clean" label="Clean data" onClick={() => { onOpenClean(); close(); }} />
              <SheetItem icon="workspace" label="Workspaces" onClick={() => { onOpenWorkspace(); close(); }} />
              <SheetItem icon="share" label="Share link" onClick={() => { onOpenShare(); close(); }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SheetItem({ icon, label, onClick }: { icon: 'build' | 'clean' | 'workspace' | 'share'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-text-primary hover:bg-bg-2 transition-colors min-h-[44px]"
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}
