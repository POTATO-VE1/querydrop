/**
 * Button — primary/secondary/ghost/danger variants
 * Solid colors, sharp edges, no glow. Mono font inherits from body.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  iconLeft?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  children?: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary: 'bg-accent-brand text-text-inverse hover:bg-accent-brand-dim font-medium',
  secondary: 'bg-bg-2 text-text-primary border border-border-default hover:border-border-strong',
  ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-2',
  danger: 'bg-accent-danger text-text-inverse hover:bg-accent-danger-dim font-medium',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2.5',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  iconLeft,
  iconRight,
  loading = false,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center rounded transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        className ?? '',
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : iconLeft ? (
        <Icon name={iconLeft} size={size === 'sm' ? 14 : 16} />
      ) : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={size === 'sm' ? 14 : 16} /> : null}
    </button>
  );
}
