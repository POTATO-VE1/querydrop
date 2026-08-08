/**
 * useFocusTrap — trap Tab/Shift+Tab inside an active container.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, renderHook, screen, act } from '@testing-library/react';
import { useRef } from 'react';
import { useFocusTrap } from '../useFocusTrap';

afterEach(() => {
  vi.restoreAllMocks();
});

function TrapFixture({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active);
  return (
    <div ref={ref} role="dialog">
      <button>First</button>
      <button>Middle</button>
      <button>Last</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('focuses the first element when activated', () => {
    render(<TrapFixture active={true} />);
    expect(document.activeElement?.textContent).toBe('First');
  });

  it('Tab from last wraps to first', () => {
    render(<TrapFixture active={true} />);
    const last = screen.getByText('Last');
    act(() => {
      last.focus();
    });
    expect(document.activeElement?.textContent).toBe('Last');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement?.textContent).toBe('First');
  });

  it('Shift+Tab from first wraps to last', () => {
    render(<TrapFixture active={true} />);
    const first = screen.getByText('First');
    act(() => {
      first.focus();
    });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
      );
    });
    expect(document.activeElement?.textContent).toBe('Last');
  });

  it('Tab inside middle does NOT wrap', () => {
    render(<TrapFixture active={true} />);
    const middle = screen.getByText('Middle');
    act(() => {
      middle.focus();
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement?.textContent).toBe('Middle');
  });

  it('is a no-op when active is false', () => {
    render(<TrapFixture active={false} />);
    expect(document.activeElement?.textContent).not.toBe('First');
  });

  it('cleans up listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<TrapFixture active={true} />);
    unmount();
    const events = removeSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain('keydown');
  });

  it('handles a container with no focusable children (focuses container itself)', () => {
    function EmptyTrap() {
      const ref = useRef<HTMLDivElement>(null);
      useFocusTrap(ref, true);
      return <div ref={ref}>No buttons here</div>;
    }
    render(<EmptyTrap />);
    const container = screen.getByText('No buttons here');
    expect(document.activeElement).toBe(container);
  });
});
