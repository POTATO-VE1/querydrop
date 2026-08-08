/**
 * useEscapeKey — listen for the Escape key on document.
 * Calls the provided handler (if any) and prevents default. Stops listening
 * on unmount or when the handler changes.
 *
 * Usage:
 *   useEscapeKey(() => setOpen(false), open);
 *
 * The `enabled` argument (default true) lets callers gate the listener
 * (e.g. only when a modal is actually open) so we don't have to manage
 * teardown conditionally inside the effect.
 */

import { useEffect, useRef } from 'react';

export function useEscapeKey(handler: () => void, enabled = true): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handlerRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}
