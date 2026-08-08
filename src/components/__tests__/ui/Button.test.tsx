/**
 * Button — variants, sizes, disabled, loading.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../../ui/Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<Button onClick={handler}>Go</Button>);
    await user.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<Button disabled onClick={handler}>Go</Button>);
    await user.click(screen.getByRole('button'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not call onClick when loading', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<Button loading onClick={handler}>Go</Button>);
    await user.click(screen.getByRole('button'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('sets aria-busy when loading', () => {
    render(<Button loading>Go</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders iconLeft and iconRight', () => {
    render(
      <Button iconLeft="play" iconRight="arrow-right">
        Run
      </Button>,
    );
    expect(screen.getByText('Run')).toBeInTheDocument();
    // SVGs are aria-hidden, query by container
    const btn = screen.getByRole('button');
    expect(btn.querySelectorAll('svg')).toHaveLength(2);
  });

  it('hides icons while loading (shows spinner instead)', () => {
    render(
      <Button loading iconLeft="play">
        Run
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn.querySelector('svg')).toBeNull();
    expect(btn.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('applies variant classes for primary', () => {
    render(<Button variant="primary">Go</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-accent-brand');
  });

  it('applies variant classes for danger', () => {
    render(<Button variant="danger">Go</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-accent-danger');
  });

  it('uses type="button" by default (no form submit)', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
