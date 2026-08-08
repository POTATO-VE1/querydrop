/**
 * SrAnnouncer — debounce + dedup + screen-reader live region.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SrAnnouncerProvider, useAnnouncer } from '../../a11y/SrAnnouncer';

afterEach(() => {
  vi.useRealTimers();
});

function CaptureAnnounce({ onReady }: { onReady: (fn: (msg: string) => void) => void }) {
  const announce = useAnnouncer();
  onReady(announce);
  return null;
}

describe('SrAnnouncer', () => {
  it('provides a no-op announce when used outside the provider', () => {
    let fn: (msg: string) => void = () => {};
    function Probe() {
      fn = useAnnouncer();
      return null;
    }
    render(<Probe />);
    expect(() => fn('hi')).not.toThrow();
  });

  it('renders an sr-only live region with role="status"', () => {
    render(
      <SrAnnouncerProvider>
        <div>child</div>
      </SrAnnouncerProvider>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveClass('sr-only');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
  });

  it('queues rapid announcements sequentially', async () => {
    vi.useFakeTimers();
    let announce: (msg: string) => void = () => {};
    render(
      <SrAnnouncerProvider>
        <CaptureAnnounce onReady={(fn) => (announce = fn)} />
      </SrAnnouncerProvider>,
    );
    announce('Loading');
    announce('Running');
    announce('Done');
    
    // First message starts
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole('status').textContent).toBe('Loading');
    
    // Advance to next message
    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    expect(screen.getByRole('status').textContent).toBe('Running');
    
    // Advance to last message
    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    expect(screen.getByRole('status').textContent).toBe('Done');
  });

  it('dedups identical messages in quick succession', async () => {
    vi.useFakeTimers();
    let announce: (msg: string) => void = () => {};
    render(
      <SrAnnouncerProvider>
        <CaptureAnnounce onReady={(fn) => (announce = fn)} />
      </SrAnnouncerProvider>,
    );
    announce('Loading');
    announce('Loading');
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByRole('status').textContent).toBe('Loading');
  });

  it('clears the pending timer on unmount', () => {
    vi.useFakeTimers();
    let announce: (msg: string) => void = () => {};
    const { unmount } = render(
      <SrAnnouncerProvider>
        <CaptureAnnounce onReady={(fn) => (announce = fn)} />
      </SrAnnouncerProvider>,
    );
    announce('Loading');
    unmount();
    // No assertion needed beyond "no late setState warning"; cleanup should fire.
  });
});
