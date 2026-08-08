import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import type { QueryHistoryItem, QuerySnippet } from '../../lib/duckdb/types';

interface HistoryDropdownProps {
  history: QueryHistoryItem[];
  snippets: QuerySnippet[];
  onSelectHistory: (sql: string) => void;
  onClearHistory: () => void;
  onDeleteSnippet: (id: string) => void;
  onRenameSnippet: (id: string, name: string) => void;
}

function formatRelative(ts: number, now: number): string {
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function truncateSql(sql: string, max = 100): string {
  return sql.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function HistoryDropdown({
  history,
  snippets,
  onSelectHistory,
  onClearHistory,
  onDeleteSnippet,
  onRenameSnippet,
}: HistoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [open]);

  const disabled = history.length === 0 && snippets.length === 0;
  const now = Date.now();
  const total = history.length + snippets.length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
        title={disabled ? 'No saved queries' : `History · ${total}`}
      >
        <Icon name="clock" size={12} />
        <span className="tabular-nums">{total}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[calc(100vw-2rem)] max-w-[24rem] sm:w-96 max-h-[28rem] overflow-y-auto bg-bg-1 border border-border-subtle rounded-lg ">
          <div className="sticky top-0 bg-bg-1 px-3 py-2 border-b border-border-subtle flex items-center justify-between z-10">
            <span className="text-[10px] mono uppercase tracking-wider text-text-tertiary">
              Saved &amp; History · {total}
            </span>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to clear your query history?')) {
                  return;
                }
                onClearHistory();
                setOpen(false);
              }}
              disabled={history.length === 0}
              className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-accent-warn disabled:opacity-30 disabled:cursor-not-allowed"
              title="Clear history"
            >
              <Icon name="trash" size={10} />
              Clear
            </button>
          </div>

          {snippets.length > 0 && (
            <div>
              <div className="px-3 py-1.5 bg-bg-0 border-b border-border-subtle text-[10px] mono uppercase tracking-wider text-accent-warn flex items-center gap-1.5">
                <Icon name="pin" size={10} />
                Saved · {snippets.length}
              </div>
              {snippets.map((s) => (
                <SavedItem
                  key={s.id}
                  snippet={s}
                  onLoad={(sql) => {
                    onSelectHistory(sql);
                    setOpen(false);
                  }}
                  onDelete={() => onDeleteSnippet(s.id)}
                  onRename={(name) => onRenameSnippet(s.id, name)}
                />
              ))}
            </div>
          )}

          {history.length > 0 && (
            <div>
              <div className="px-3 py-1.5 bg-bg-0 border-b border-border-subtle text-[10px] mono uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
                <Icon name="clock" size={10} />
                Recent · {history.length}
              </div>
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectHistory(item.sql);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-bg-2 border-b border-border-subtle last:border-b-0 group"
                  title={item.sql}
                >
                  <div className="mono text-[11px] text-text-primary truncate group-hover:text-accent-brand">
                    {truncateSql(item.sql)}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-text-tertiary">
                    <span>{formatRelative(item.ts, now)}</span>
                    <span>·</span>
                    {item.success ? (
                      <span className="text-accent-success">
                        {item.rowCount ?? 0} rows · {item.durationMs}ms
                      </span>
                    ) : (
                      <span className="text-accent-warn" title={item.error}>
                        error
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SavedItem({
  snippet,
  onLoad,
  onDelete,
  onRename,
}: {
  snippet: QuerySnippet;
  onLoad: (sql: string) => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(snippet.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(snippet.name);
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== snippet.name) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(snippet.name);
    setEditing(false);
  };

  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 border-b border-border-subtle last:border-b-0 hover:bg-bg-2 cursor-pointer"
      onClick={() => !editing && onLoad(snippet.sql)}
    >
      <Icon name="pin" size={10} className="text-accent-warn shrink-0" />
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          onBlur={commit}
          maxLength={50}
          autoFocus
          className="flex-1 min-w-0 bg-bg-0 border border-accent-warn/50 rounded px-1.5 py-0.5 text-xs mono text-text-primary focus:outline-none focus:border-accent-warn"
        />
      ) : (
        <span
          className="flex-1 min-w-0 text-xs mono text-text-primary truncate group-hover:text-accent-brand"
          onDoubleClick={(e) => {
            e.stopPropagation();
            startEdit();
          }}
        >
          {snippet.name}
        </span>
      )}
      {!editing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            startEdit();
          }}
          className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-accent-warn transition-opacity"
          title="Rename"
        >
          <Icon name="edit" size={10} />
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-accent-warn transition-opacity"
        title="Delete snippet"
      >
        <Icon name="close" size={10} />
      </button>
    </div>
  );
}
