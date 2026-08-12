import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

type AlertProps = {
  children: ReactNode
  tone?: 'info' | 'danger' | 'success'
  className?: string
}

const tones = {
  info: 'border-brand-200 bg-brand-50 text-brand-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

export function Alert({ children, tone = 'info', className }: AlertProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 text-sm font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </div>
  )
}
