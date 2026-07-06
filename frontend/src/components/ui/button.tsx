import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asElement: Component = 'button', ...props }, ref) => {
    const variants = {
      default: 'border border-violet-600 bg-violet-600 text-white shadow-[0_10px_20px_rgba(91,50,255,0.18)] hover:border-violet-700 hover:bg-violet-700',
      destructive: 'border border-rose-500 bg-rose-500 text-white shadow-sm hover:border-rose-600 hover:bg-rose-600',
      outline: 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
      secondary: 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
      ghost: 'text-slate-600 hover:bg-slate-100',
      link: 'text-violet-600 underline-offset-4 hover:underline',
    };

    const sizes = {
      default: 'h-10 rounded-xl px-4 py-2 text-sm font-medium',
      sm: 'h-8 rounded-lg px-3 text-xs',
      lg: 'h-11 rounded-xl px-6 text-sm',
      icon: 'h-10 w-10 rounded-xl',
      xs: 'h-7 rounded-lg px-2.5 text-xs',
    };

    return (
      <Component
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
