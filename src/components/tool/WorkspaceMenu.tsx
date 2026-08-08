/**
 * WorkspaceMenu — modal for saving, listing, restoring, exporting, and
 * importing saved workspaces. Workspaces hold file metadata + SQL only
 * (never the file contents themselves). Restore puts the user back into the
 * exact same "I have these files, I'm writing this query" state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  exportWorkspaceToFile,
  importWorkspaceFromFile,
  loadWorkspaces,
  saveWorkspace,
  workspaceSizeOf,
  deleteWorkspace,
  type Workspace,
  type WorkspaceFile,
} from '../../lib/workspace';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { Icon } from '../ui/Icon';
import { toast } from '../../lib/format';

interface WorkspaceMenuProps {
  currentFiles: WorkspaceFile[];
  currentSql: string;
  onRestore: (workspace: Workspace) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function WorkspaceMenu({ currentFiles, currentSql, onRestore, open: openProp, onOpenChange }: WorkspaceMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  };
  const [workspaces, setWorkspaces] = useState<Workspace[]>(loadWorkspaces);
  const [saveName, setSaveName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useEscapeKey(close, open);
  useFocusTrap(dialogRef, open);

  const sizeInfo = workspaceSizeOf(currentFiles, currentSql);
  const canSave = currentFiles.length > 0 || currentSql.trim().length > 0;

  useEffect(() => {
    if (open) {
      setWorkspaces(loadWorkspaces());
      setError(null);
      setInfo(null);
    }
  }, [open]);

  const handleSave = useCallback(() => {
    if (!canSave) {
      setError('Nothing to save — load a file or write a query first');
      return;
    }
    try {
      const entry = saveWorkspace(saveName, currentFiles, currentSql);
      setWorkspaces(loadWorkspaces());
      setSaveName('');
      setError(null);
      toast(`Saved workspace "${entry.name}"`, 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [canSave, saveName, currentFiles, currentSql]);

  const handleRestore = useCallback(
    (ws: Workspace) => {
      onRestore(ws);
      toast(`Restored workspace "${ws.name}"`, 'success');
      setOpen(false);
    },
    [onRestore],
  );

  const handleDelete = useCallback((id: string, name: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Are you sure you want to delete workspace "${name}"?`)) {
      return;
    }
    deleteWorkspace(id);
    setWorkspaces(loadWorkspaces());
    toast('Workspace deleted', 'info');
  }, []);

  const handleExport = useCallback((ws: Workspace) => {
    exportWorkspaceToFile(ws);
  }, []);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);
      setInfo(null);
      try {
        const ws = await importWorkspaceFromFile(file);
        onRestore(ws);
        toast(`Imported workspace "${ws.name}"`, 'success');
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [onRestore],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs mono text-text-secondary hover:text-accent-success"
        title="Save and restore workspaces"
      >
        <Icon name="database" size={12} />
        Workspaces
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-title"
            className="w-full max-w-lg bg-bg-1 border border-border-subtle rounded-xl overflow-hidden  flex flex-col max-h-[85vh]"
          >
            <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between gap-3 shrink-0">
              <h2 id="workspace-title" className="text-sm font-semibold text-text-primary">
                <Icon name="database" size={14} className="inline mr-1.5 -mt-0.5 text-accent-success" />
                Workspaces
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-text-tertiary hover:text-text-primary"
                aria-label="Close"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <section className="border border-border-subtle rounded-md p-3 bg-bg-0">
                <h3 className="text-[10px] mono uppercase tracking-wider text-text-tertiary mb-2">
                  Save current session
                </h3>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Workspace name (optional)"
                    maxLength={80}
                    className="flex-1 px-2 py-1 text-xs mono bg-bg-1 border border-border-subtle rounded text-text-primary focus:outline-none focus:border-accent-success"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave();
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave}
                    className="px-3 py-1 text-xs mono font-semibold rounded bg-accent-success/10 border border-accent-success/40 text-accent-success hover:bg-accent-success/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
                <p className="text-[10px] mono text-text-tertiary">
                  {currentFiles.length} file{currentFiles.length === 1 ? '' : 's'} ·{' '}
                  {currentSql.length} chars SQL ·{' '}
                  <span
                    className={
                      sizeInfo.hard
                        ? 'text-accent-danger'
                        : sizeInfo.warn
                        ? 'text-accent-warn'
                        : 'text-text-tertiary'
                    }
                  >
                    {(sizeInfo.bytes / 1024).toFixed(1)} KB
                  </span>
                  {sizeInfo.warn && !sizeInfo.hard && ' — getting large'}
                  {sizeInfo.hard && ' — over 1 MB, cannot save'}
                </p>
              </section>

              {error && (
                <p className="text-[11px] mono text-accent-danger border border-accent-danger/30 bg-accent-danger/5 rounded p-2">
                  {error}
                </p>
              )}
              {info && (
                <p className="text-[11px] mono text-accent-success border border-accent-success/30 bg-accent-success/5 rounded p-2">
                  {info}
                </p>
              )}

              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] mono uppercase tracking-wider text-text-tertiary">
                    Saved ({workspaces.length})
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleImportClick}
                      className="px-2 py-1 text-[10px] mono text-text-secondary hover:text-accent-brand"
                    >
                      Import JSON
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={handleImportFile}
                    />
                  </div>
                </div>
                {workspaces.length === 0 ? (
                  <p className="text-[11px] mono text-text-tertiary text-center py-6 border border-dashed border-border-subtle rounded">
                    No saved workspaces yet
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {workspaces.map((ws) => (
                      <li
                        key={ws.id}
                        className="border border-border-subtle rounded-md bg-bg-0 hover:bg-bg-2 transition-colors"
                      >
                        <div className="p-2 flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs mono font-semibold text-text-primary truncate">
                              {ws.name}
                            </div>
                            <div className="text-[10px] mono text-text-tertiary mt-0.5">
                              {ws.files.length} file{ws.files.length === 1 ? '' : 's'} ·{' '}
                              {ws.sql.length} chars · {formatRelativeTime(ws.updatedAt)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRestore(ws)}
                            className="px-2 py-1 text-[10px] mono font-semibold rounded text-accent-brand border border-accent-brand/30 hover:bg-accent-brand/10"
                            title="Load this workspace"
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExport(ws)}
                            className="px-2 py-1 text-[10px] mono text-text-secondary hover:text-text-primary"
                            title="Download as JSON file"
                          >
                            <Icon name="download" size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(ws.id, ws.name)}
                            className="px-2 py-1 text-[10px] mono text-text-tertiary hover:text-accent-danger"
                            title="Delete"
                            aria-label={`Delete ${ws.name}`}
                          >
                            <Icon name="trash" size={11} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <p className="text-[10px] mono text-text-tertiary leading-relaxed border-t border-border-subtle pt-2">
                File contents are never saved. On restore, drop the same files (matched by name + size) and
                QueryDrop rewrites the SQL to use the new table names automatically.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
