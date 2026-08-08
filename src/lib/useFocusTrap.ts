/**
 * useFocusTrap — trap keyboard focus inside a container while it is active.
 * Restores focus to the previously-focused element on cleanup.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(ref, open);
 *   return <div ref={ref} role="dialog" aria-modal="true">...</div>
 *
 * Behavior:
 * - On activate: query all focusable descendants; focus the first one
 *   (or the container itself if none found, as a fallback).
 * - On Tab from the last focusable: wrap to the first.
 * - On Shift+Tab from the first: wrap to the last.
 * - On deactivate: restore focus to the element that was active before
 *   the trap engaged (if it is still in the DOM and focusable).
 * - Clicks outside the container are NOT intercepted — that's a
 *   separate concern (overlay click handler).
 */

import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export function useFocusTrap<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      );

    let addedTabindex = false;
    const focusablesNow = focusables();
    if (focusablesNow.length > 0) {
      focusablesNow[0].focus();
    } else {
      container.setAttribute('tabindex', '-1');
      addedTabindex = true;
      container.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (addedTabindex) {
        container.removeAttribute('tabindex');
      }
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [ref, active]);
}
