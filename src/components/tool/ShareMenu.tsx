/**
 * ShareMenu — modal for building a shareable URL of the current query
 * (and optionally the result preview). Encodes via src/lib/share.ts
 * (gzip + base64url) and copies to clipboard.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildShareUrlAsync,
  encodeShareResult,
  type SharePayload,
  type ShareResultPayload,
} from '../../lib/share';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { Icon } from '../ui/Icon';
import type { QueryResult } from '../../lib/duckdb/types';
import { toast } from '../../lib/format';

interface ShareMenuProps {
  sql: string;
  activeTable: string | undefined;
  lastResult: QueryResult | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MAX_PREVIEW_ROWS = 5;
const URL_WARN_LENGTH = 2000;
const URL_HARD_LIMIT = 8000;

export function ShareMenu({ sql, activeTable, lastResult, open: openProp, onOpenChange }: ShareMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  };
  const [includeResult, setIncludeResult] = useState(true);
  const [url, setUrl] = useState<string | null>(null);
  const [urlLength, setUrlLength] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useEscapeKey(close, open);
  useFocusTrap(dialogRef, open);

  const buildUrl = useCallback(async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const payload: SharePayload = { v: 1, sql };
      if (activeTable) payload.t = activeTable;

      let resultPayload: ShareResultPayload | null = null;
      if (includeResult && lastResult && lastResult.rows.length > 0) {
        const previewRows = lastResult.rows.slice(0, MAX_PREVIEW_ROWS);
        const cols = lastResult.columns.map((name, i) => ({ name, type: lastResult.columnTypes[i] ?? '' }));
        resultPayload = { v: 1, cols, rows: previewRows };
      }

      const { url: built, length } = await buildShareUrlAsync(
        window.location.origin,
        window.location.pathname,
        payload,
        resultPayload,
      );
      setUrl(built);
      setUrlLength(length);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setUrl(null);
      setUrlLength(0);
    } finally {
      setBusy(false);
    }
  }, [sql, activeTable, lastResult, includeResult]);

  useEffect(() => {
    if (open) {
      void buildUrl();
    } else {
      setUrl(null);
      setUrlLength(0);
      setError(null);
      setCopied(false);
    }
  }, [open, buildUrl]);

  const copy = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast('Share link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      setError(`Clipboard blocked: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [url]);

  const isEmpty = !sql.trim();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isEmpty}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs mono text-text-secondary hover:text-accent-brand disabled:opacity-40 disabled:cursor-not-allowed"
        title={isEmpty ? 'Write a query first' : 'Share this query as a URL'}
      >
        <Icon name="share" size={12} />
        Share
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
            aria-labelledby="share-title"
            className="w-full max-w-lg bg-bg-1 border border-border-subtle rounded-xl overflow-hidden "
          >
            <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between gap-3">
              <h2 id="share-title" className="text-sm font-semibold text-text-primary">
                <Icon name="share" size={14} className="inline mr-1.5 -mt-0.5 text-accent-brand" />
                Share query
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
            <div className="p-4 space-y-3">
              <label className="flex items-center gap-2 text-xs mono text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeResult}
                  onChange={(e) => setIncludeResult(e.target.checked)}
                  className="accent-accent-brand"
                />
                Include result preview (first {MAX_PREVIEW_ROWS} rows)
                {lastResult && (
                  <span className="text-text-tertiary">
                    · {lastResult.rows.length} row{lastResult.rows.length === 1 ? '' : 's'} available
                  </span>
                )}
              </label>

              {busy && (
                <p className="text-[11px] mono text-text-tertiary flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border border-accent-brand border-t-transparent rounded-full animate-spin" />
                  Encoding…
                </p>
              )}

              {error && (
                <p className="text-[11px] mono text-accent-danger border border-accent-danger/30 bg-accent-danger/5 rounded p-2">
                  {error}
                </p>
              )}

              {url && !busy && (
                <>
                  <div>
                    <label className="block text-[10px] mono uppercase tracking-wider text-text-tertiary mb-1">
                      URL ({urlLength.toLocaleString()} chars)
                    </label>
                    <textarea
                      readOnly
                      value={url}
                      rows={4}
                      className="w-full text-[11px] mono text-text-secondary bg-bg-0 border border-border-subtle rounded p-2 resize-none break-all"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    {urlLength > URL_HARD_LIMIT && (
                      <p className="text-[10px] mono text-accent-danger mt-1">
                        URL over 8KB — most browsers and chat apps will not accept it. Consider removing the result preview.
                      </p>
                    )}
                    {urlLength > URL_WARN_LENGTH && urlLength <= URL_HARD_LIMIT && (
                      <p className="text-[10px] mono text-accent-warn mt-1">
                        Long URL — some chat apps may truncate. Most browsers are fine.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copy()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs mono font-semibold rounded-md bg-accent-brand/10 border border-accent-brand/40 text-accent-brand hover:bg-accent-brand/20"
                    >
                      {copied ? (
                        <>
                          <Icon name="check" size={12} /> Copied!
                        </>
                      ) : (
                        <>
                          <Icon name="share" size={12} /> Copy URL
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void buildUrl()}
                      className="px-3 py-1.5 text-xs mono text-text-secondary hover:text-text-primary"
                    >
                      Regenerate
                    </button>
                  </div>
                </>
              )}

              <p className="text-[10px] mono text-text-tertiary leading-relaxed border-t border-border-subtle pt-2">
                Anyone with this link can see the query and (if included) the result preview. No data is sent to a
                server — the URL itself contains the share payload, encoded with gzip + base64url.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Re-export for any consumer that wants to compute a result preview outside
// the modal (e.g. future social-card generator).
export { encodeShareResult };
