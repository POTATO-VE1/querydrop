/**
 * SrAnnouncer — global screen-reader live region.
 *
 * Mounts a single polite live region into the DOM. Callers obtain a
 * reference via useAnnouncer() and invoke `announce(msg)` to push text
 * into the region. The region is visually hidden (sr-only) but read
 * by assistive technology.
 *
 * Messages are appended with a small debounce so rapid successive
 * announcements (e.g. "Loading", "Loaded", "Running", "Done") don't
 * collapse into a single missed announcement.
 *
 * Usage:
 *   // In QueryPad (or any persistent root):
 *   <SrAnnouncerProvider>
 *     <QueryPad ... />
 *   </SrAnnouncerProvider>
 *
 *   // In any descendant:
 *   const announce = useAnnouncer();
 *   announce(`Query completed in ${ms} ms, ${rows} rows`);
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface AnnouncerContext {
  announce: (msg: string) => void;
}

const Ctx = createContext<AnnouncerContext | null>(null);

const ANNOUNCE_DEBOUNCE_MS = 200;

export function SrAnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const queueRef = useRef<string[]>([]);
  const isAnnouncingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processQueue = useCallback(() => {
    if (queueRef.current.length === 0) {
      isAnnouncingRef.current = false;
      return;
    }
    isAnnouncingRef.current = true;
    const next = queueRef.current.shift()!;
    setMessage('');
    timerRef.current = setTimeout(() => {
      setMessage(next);
      timerRef.current = setTimeout(processQueue, 400);
    }, 50);
  }, []);

  const announce = useCallback((msg: string) => {
    const last = queueRef.current[queueRef.current.length - 1];
    if (last === msg) return;
    queueRef.current.push(msg);
    if (!isAnnouncingRef.current) {
      isAnnouncingRef.current = true;
      timerRef.current = setTimeout(processQueue, 0);
    }
  }, [processQueue]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Ctx.Provider value={{ announce }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {message}
      </div>
    </Ctx.Provider>
  );
}

export function useAnnouncer(): (msg: string) => void {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return () => {
      // no-op when used outside provider; still safe to call
    };
  }
  return ctx.announce;
}
