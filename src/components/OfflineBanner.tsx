/**
 * OfflineBanner — top-of-page status banner shown when the browser
 * reports `offline`. Persists dismiss for 1h in localStorage so it
 * doesn't nag the user mid-session.
 *
 * Mounted globally from Layout.astro as a client:load island so it's
 * available on every page, not just /tool.
 *
 * Bug-fix history:
 * - v1: The `online` event handler reset `dismissed` to `false` in memory,
 *   so if the connection flapped (offline → online → offline) the banner
 *   reappeared immediately after the user dismissed it. Fixed by trusting
 *   the localStorage TTL for persistence and never overwriting the in-memory
 *   dismissed state from event listeners.
 * - v1: Dismiss button was a tiny 12px X icon, easy to miss. Made it a
 *   text "Dismiss" button with a visible border.
 * - v1: Added a 6s auto-dismiss safety net so if `navigator.onLine` is
 *   incorrect in a sandboxed/dev environment, the banner still goes away.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui/Icon';

const DISMISS_KEY = 'querydrop:offline-banner-dismissed';
const DISMISS_TTL_MS = 60 * 60 * 1000;
const AUTO_DISMISS_MS = 6000;

function readDismiss(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    if (Date.now() - ts > DISMISS_TTL_MS) {
      localStorage.removeItem(DISMISS_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function OfflineBanner() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [dismissed, setDismissed] = useState(false);
  const [autoDismissed, setAutoDismissed] = useState(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDismissed(readDismiss());

    const onOnline = () => { setOnline(true); setAutoDismissed(false); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (autoTimer.current) {
      clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
    if (!online) {
      autoTimer.current = setTimeout(() => {
        setAutoDismissed(true);
      }, AUTO_DISMISS_MS);
    }
    return () => {
      if (autoTimer.current) {
        clearTimeout(autoTimer.current);
        autoTimer.current = null;
      }
    };
  }, [online]);

  if (online || dismissed || autoDismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    if (autoTimer.current) {
      clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage full / disabled — keep UI dismissed in-memory
    }
  };

  return (
    <div
      role="status"
      className="fixed top-0 left-0 right-0 z-50 bg-bg-1 border-b border-border-strong px-4 py-2 flex items-center justify-between gap-3 text-sm text-accent-warn"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon name="bolt" size={14} className="shrink-0" />
        <span className="truncate font-medium">
          Working offline — your queries and files stay local
        </span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-text-secondary hover:text-text-primary px-3 py-1 border border-border-default hover:border-border-strong rounded-md shrink-0 flex items-center gap-1.5 transition-colors"
        aria-label="Dismiss offline banner"
      >
        <span className="text-xs uppercase tracking-wider">Dismiss</span>
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}
