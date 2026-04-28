'use client';

import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';

/* ── Card ─────────────────────────────────────────────────────────────── */
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, hover = true }, ref) => (
    <motion.div
      ref={ref}
      whileHover={
        hover
          ? { y: -3, boxShadow: '0 16px 32px -8px rgba(27,34,53,0.10)' }
          : {}
      }
      className={cn(
        'bg-white rounded-2xl border border-soft-blue p-4 sm:p-6 transition-all duration-200',
        className
      )}
    >
      {children}
    </motion.div>
  )
);
Card.displayName = 'Card';

/* ── Badge ────────────────────────────────────────────────────────────── */
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-soft-blue text-blue-600',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border border-amber-100',
    error:   'bg-rose-50 text-rose-700 border border-rose-100',
    info:    'bg-soft-blue text-blue-600 border border-blue-100',
  };

  return (
    <span
      className={cn(
        'px-2.5 py-0.5 rounded-full text-xs font-medium font-mono tracking-wide',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ── Button ───────────────────────────────────────────────────────────── */
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

interface ButtonOwnProps {
  children?: React.ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  as?: React.ElementType;
}

type ButtonProps = ButtonOwnProps &
  Omit<React.ComponentPropsWithoutRef<'button'>, keyof ButtonOwnProps> & {
    [extraProp: string]: any;
  };

export function Button({
  children,
  className,
  variant = 'primary',
  loading = false,
  as: Component = 'button',
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/10',
    secondary:
      'bg-soft-blue text-blue-600 hover:bg-blue-100',
    outline:
      'bg-transparent border border-blue-100 text-ink hover:bg-soft-blue',
    ghost:
      'bg-transparent text-brand-slate hover:bg-soft-blue',
    danger:
      'bg-rose-500 text-white hover:bg-rose-600',
  };

  return (
    <Component
      className={cn(
        'inline-flex items-center justify-center px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant as keyof typeof variants],
        className
      )}
      disabled={loading}
      {...props}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : null}
      {children}
    </Component>
  );
}

/* ── Input ────────────────────────────────────────────────────────────── */
type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-cloud border-2 border-soft-blue rounded-xl focus:border-blue-600 focus:outline-none transition-all text-sm text-ink placeholder:text-brand-slate',
        className
      )}
      {...props}
    />
  );
}
