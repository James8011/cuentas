import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

type BadgeProps = {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  className?: string
}

const tones = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-rose-100 text-rose-700',
}

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
