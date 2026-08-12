import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../utils/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  leftIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, ...props }, ref) => (
    <div className="relative">
      {leftIcon ? (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {leftIcon}
        </span>
      ) : null}
      <input
        ref={ref}
        className={cn(
          'w-full rounded-full border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-200',
          leftIcon ? 'pl-12 pr-4' : 'px-4',
          className,
        )}
        {...props}
      />
    </div>
  ),
)

Input.displayName = 'Input'
