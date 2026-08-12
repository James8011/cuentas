import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

type PanelProps = {
  title?: string
  children: ReactNode
  className?: string
}

export function Panel({ title, children, className }: PanelProps) {
  return (
    <section
      className={cn(
        'rounded-3xl border-t-8 border-brand-500 bg-white p-5 shadow-panel',
        className,
      )}
    >
      {title ? (
        <h2 className="mb-4 text-lg font-black text-slate-800">{title}</h2>
      ) : null}
      {children}
    </section>
  )
}
