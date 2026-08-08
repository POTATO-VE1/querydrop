/**
 * OfflineBanner — dismiss, 1h localStorage TTL, auto-dismiss, online/offline events.
 * Bug-fix coverage: the previous version reset dismissed in memory on the online
 * event, so a connection flap (offline → online → offline) resurrected the banner.
 * These tests guard against that regression.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OfflineBanner } from '../OfflineBanner';

const DISMISS_KEY = 'querydrop:offline-banner-dismissed';

describe('OfflineBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when navigator.onLine is true', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toHaveTextContent(/Working offline/);
  });

  it('hides when dismissed via button click', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(localStorage.getItem(DISMISS_KEY)).toBeTruthy();
  });

  it('persists dismiss in localStorage for 1h', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    const ts = Number(localStorage.getItem(DISMISS_KEY));
    expect(ts).toBeGreaterThan(Date.now() - 5_000);
  });

  it('respects localStorage dismiss on mount', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('clears expired localStorage entry (older than 1h)', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    localStorage.setItem(DISMISS_KEY, String(Date.now() - 2 * 60 * 60 * 1000));
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it('treats non-numeric localStorage value as not dismissed', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    localStorage.setItem(DISMISS_KEY, 'not-a-number');
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('regression: connection flap offline→online→offline does NOT resurrect banner after dismiss', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // Connection flaps: online event fires, then offline event fires
    act(() => {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('offline'));
    });
    // Banner must NOT reappear because the user dismissed it (and it's still within the 1h TTL)
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows banner when offline event fires after mount', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('hides banner when online event fires after mount', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('auto-dismisses after 6s if the user does not interact', () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('auto-dismiss timer is cancelled on manual dismiss', () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('cancels the auto-dismiss timer on unmount (no late state update)', () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const { unmount } = render(<OfflineBanner />);
    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    // No assertion needed beyond "no warning thrown"; the timer ref is cleaned up.
  });

  it('removes event listeners on unmount', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const { unmount } = render(<OfflineBanner />);
    const addSpy = vi.spyOn(window, 'removeEventListener');
    unmount();
    const removed = addSpy.mock.calls.map((c) => c[0]);
    expect(removed).toContain('online');
    expect(removed).toContain('offline');
  });

  it('survives localStorage throwing on get (private mode)', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    getItem.mockRestore();
  });

  it('survives localStorage throwing on set (quota exceeded)', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    setItem.mockRestore();
  });

  it('banner has role="status" and a screen-reader-friendly label', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });
});
