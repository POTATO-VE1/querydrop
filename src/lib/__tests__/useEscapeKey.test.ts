/**
 * useEscapeKey — listen for Escape on document, call handler, preventDefault.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEscapeKey } from '../useEscapeKey';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useEscapeKey', () => {
  it('calls the handler on Escape keydown', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler, true));
    const ev = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    document.dispatchEvent(ev);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not call the handler on other keys', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler, true));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not listen when enabled is false', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler, false));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useEscapeKey(handler, true));
    unmount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handler).not.toHaveBeenCalled();
  });
});
